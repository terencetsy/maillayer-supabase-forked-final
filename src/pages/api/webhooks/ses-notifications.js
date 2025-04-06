// src/pages/api/webhooks/ses-notifications.js
import connectToDatabase from '@/lib/mongodb';
import { createTrackingModel } from '@/models/TrackingEvent';
import Contact from '@/models/Contact';
import Campaign from '@/models/Campaign';
import TransactionalTemplate from '@/models/TransactionalTemplate';
import TransactionalLog from '@/models/TransactionalLog';
import { trackTransactionalEvent } from '@/services/transactionalService';
import mongoose from 'mongoose';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Connect to database
        await connectToDatabase();

        // Parse the SNS message
        const snsMessage = JSON.parse(req.body);

        // Handle subscription confirmation
        if (snsMessage.Type === 'SubscriptionConfirmation') {
            const subscribeUrl = snsMessage.SubscribeURL;
            const response = await fetch(subscribeUrl);

            if (response.ok) {
                return res.status(200).json({ message: 'Subscription confirmed' });
            } else {
                console.error('Failed to confirm SNS subscription');
                return res.status(500).json({ message: 'Failed to confirm subscription' });
            }
        }

        // Handle notification messages
        if (snsMessage.Type === 'Notification') {
            let messageContent;

            try {
                messageContent = JSON.parse(snsMessage.Message);
            } catch (parseError) {
                console.error('Error parsing SNS message:', parseError);
                return res.status(200).json({ message: 'Notification received but could not be parsed' });
            }

            const mailData = messageContent.mail;

            if (!mailData) {
                console.log('No mail data in notification');
                return res.status(200).json({ message: 'Notification processed (no mail data)' });
            }

            // Determine if this is a campaign or transactional email
            let emailType = 'unknown';
            let campaignId, contactId, templateId, email;

            // Check tags to determine email type
            if (mailData.tags) {
                // Check if it's a campaign email
                if (mailData.tags.campaignId && mailData.tags.campaignId.length > 0) {
                    emailType = 'campaign';
                    campaignId = mailData.tags.campaignId[0];

                    if (mailData.tags.contactId && mailData.tags.contactId.length > 0) {
                        contactId = mailData.tags.contactId[0];
                    }
                }
                // Check if it's a transactional email
                else if (mailData.tags.templateId && mailData.tags.templateId.length > 0) {
                    emailType = 'transactional';
                    templateId = mailData.tags.templateId[0];

                    if (mailData.tags.type && mailData.tags.type[0] === 'transactional') {
                        // Confirm it's a transactional email
                        emailType = 'transactional';
                    }
                }
            }

            // If we couldn't determine from tags, try other methods
            if (emailType === 'unknown') {
                // Try to extract from message ID
                if (mailData.messageId) {
                    if (mailData.messageId.includes('campaign')) {
                        emailType = 'campaign';
                        const campaignMatch = mailData.messageId.match(/campaign[-_]([a-f0-9]+)/i);
                        if (campaignMatch && campaignMatch[1]) {
                            campaignId = campaignMatch[1];
                        }
                    } else if (mailData.messageId.includes('txn') || mailData.messageId.includes('transactional')) {
                        emailType = 'transactional';
                        const templateMatch = mailData.messageId.match(/t(?:xn|ransactional)[-_]([a-f0-9]+)/i);
                        if (templateMatch && templateMatch[1]) {
                            templateId = templateMatch[1];
                        }
                    }
                }
            }

            // Get email address for transactional emails where we don't have a contactId
            if (messageContent.eventType === 'Bounce' && messageContent.bounce && messageContent.bounce.bouncedRecipients && messageContent.bounce.bouncedRecipients.length > 0) {
                email = messageContent.bounce.bouncedRecipients[0].emailAddress;
            } else if (messageContent.eventType === 'Complaint' && messageContent.complaint && messageContent.complaint.complainedRecipients && messageContent.complaint.complainedRecipients.length > 0) {
                email = messageContent.complaint.complainedRecipients[0].emailAddress;
            } else if (mailData.destination && mailData.destination.length > 0) {
                email = mailData.destination[0];
            }

            // For campaign emails, try to find contact from email if contactId is missing
            if (emailType === 'campaign' && campaignId && !contactId && email) {
                try {
                    const contact = await Contact.findOne({ email: email });
                    if (contact) {
                        contactId = contact._id.toString();
                    }
                } catch (err) {
                    console.error('Error finding contact by email:', err);
                }
            }

            // Process notification based on email type and notification type
            const notificationType = messageContent.eventType;

            // Handle campaign notifications
            if (emailType === 'campaign' && campaignId) {
                // We need both campaignId and contactId for campaign tracking
                if (!contactId) {
                    console.warn('Missing contactId for campaign notification:', {
                        campaignId,
                        messageId: mailData.messageId,
                        notificationType,
                    });
                    return res.status(200).json({ message: 'Campaign notification processed (missing contactId)' });
                }

                // Handle different notification types for campaigns
                if (notificationType === 'Bounce') {
                    const bounceInfo = messageContent.bounce;
                    const recipients = bounceInfo.bouncedRecipients;
                    const bounceType = bounceInfo.bounceType; // Permanent or Transient
                    const subType = bounceInfo.bounceSubType;

                    // Only mark as unsubscribed for permanent bounces
                    const isPermanent = bounceType === 'Permanent';

                    if (isPermanent) {
                        // Update contact status directly using the contactId from tags
                        await Contact.findByIdAndUpdate(contactId, {
                            status: 'bounced',
                            isUnsubscribed: true, // For backward compatibility
                            unsubscribedAt: new Date(),
                            bouncedAt: new Date(),
                            bounceType: bounceType,
                            bounceReason: `${bounceType} - ${subType}`,
                            unsubscribeReason: `Bounce: ${bounceType} - ${subType}`,
                            unsubscribedFromCampaign: campaignId,
                        });
                    }

                    // Record the bounce event
                    const TrackingModel = createTrackingModel(campaignId);
                    const recipient = recipients[0]; // Get the first recipient

                    const trackingEvent = new TrackingModel({
                        contactId: new mongoose.Types.ObjectId(contactId),
                        campaignId: new mongoose.Types.ObjectId(campaignId),
                        email: recipient.emailAddress,
                        eventType: 'bounce',
                        timestamp: new Date(),
                        metadata: {
                            bounceType,
                            bounceSubType: subType,
                            diagnosticCode: recipient.diagnosticCode || '',
                        },
                    });

                    await trackingEvent.save();

                    // Update campaign stats
                    await Campaign.findByIdAndUpdate(campaignId, { $inc: { 'stats.bounces': 1 } });
                } else if (notificationType === 'Complaint') {
                    const complaintInfo = messageContent.complaint;
                    const recipients = complaintInfo.complainedRecipients;

                    // Update contact directly using the contactId from tags
                    await Contact.findByIdAndUpdate(contactId, {
                        status: 'complained',
                        isUnsubscribed: true, // For backward compatibility
                        unsubscribedAt: new Date(),
                        complainedAt: new Date(),
                        complaintReason: complaintInfo.complaintFeedbackType || 'Complaint',
                        unsubscribeReason: 'Complaint',
                        unsubscribedFromCampaign: campaignId,
                    });

                    // Record the complaint event
                    const TrackingModel = createTrackingModel(campaignId);
                    const recipient = recipients[0]; // Get the first recipient

                    const trackingEvent = new TrackingModel({
                        contactId: new mongoose.Types.ObjectId(contactId),
                        campaignId: new mongoose.Types.ObjectId(campaignId),
                        email: recipient.emailAddress,
                        eventType: 'complaint',
                        timestamp: new Date(),
                        metadata: {
                            complaintFeedbackType: complaintInfo.complaintFeedbackType || '',
                            userAgent: complaintInfo.userAgent || '',
                        },
                    });

                    await trackingEvent.save();

                    // Update campaign stats
                    await Campaign.findByIdAndUpdate(campaignId, { $inc: { 'stats.complaints': 1 } });
                } else if (notificationType === 'Delivery') {
                    const deliveryInfo = messageContent.delivery;

                    // Record the delivery event
                    const TrackingModel = createTrackingModel(campaignId);

                    const trackingEvent = new TrackingModel({
                        contactId: new mongoose.Types.ObjectId(contactId),
                        campaignId: new mongoose.Types.ObjectId(campaignId),
                        email: mailData.destination[0],
                        eventType: 'delivery',
                        timestamp: new Date(),
                        metadata: {
                            smtpResponse: deliveryInfo.smtpResponse || '',
                            reportingMTA: deliveryInfo.reportingMTA || '',
                        },
                    });

                    await trackingEvent.save();
                }
            }
            // Handle transactional email notifications
            else if (emailType === 'transactional' && templateId) {
                // For transactional emails, we need templateId and recipient email
                if (!email) {
                    console.warn('Missing email for transactional notification:', {
                        templateId,
                        messageId: mailData.messageId,
                        notificationType,
                    });
                    return res.status(200).json({ message: 'Transactional notification processed (missing email)' });
                }

                if (notificationType === 'Bounce') {
                    const bounceInfo = messageContent.bounce;
                    const bounceType = bounceInfo.bounceType;
                    const subType = bounceInfo.bounceSubType;

                    // Record transactional bounce event
                    await trackTransactionalEvent(templateId, 'bounce', {
                        email,
                        bounceType,
                        bounceSubType: subType,
                        timestamp: new Date(),
                    });

                    // Update template stats
                    await TransactionalTemplate.findByIdAndUpdate(templateId, {
                        $inc: { 'stats.bounces': 1 },
                    });

                    // Find and update TransactionalLog entry
                    await TransactionalLog.findOneAndUpdate(
                        { templateId: templateId, to: email, status: 'sent' },
                        {
                            status: 'failed',
                            error: `Bounce: ${bounceType} - ${subType}`,
                        }
                    );
                } else if (notificationType === 'Complaint') {
                    const complaintInfo = messageContent.complaint;
                    const complaintType = complaintInfo.complaintFeedbackType || 'unknown';

                    // Record transactional complaint event
                    await trackTransactionalEvent(templateId, 'complaint', {
                        email,
                        complaintType,
                        timestamp: new Date(),
                    });

                    // Update template stats
                    await TransactionalTemplate.findByIdAndUpdate(templateId, {
                        $inc: { 'stats.complaints': 1 },
                    });

                    // Find and update TransactionalLog entry
                    await TransactionalLog.findOneAndUpdate(
                        { templateId: templateId, to: email, status: 'sent' },
                        {
                            error: `Complaint: ${complaintType}`,
                        }
                    );
                } else if (notificationType === 'Delivery') {
                    const deliveryInfo = messageContent.delivery;

                    // Find and update TransactionalLog entry to confirm delivery
                    await TransactionalLog.findOneAndUpdate(
                        { templateId: templateId, to: email, status: 'sent' },
                        {
                            status: 'delivered',
                            metadata: {
                                ...deliveryInfo,
                                deliveredAt: new Date(),
                            },
                        }
                    );
                }
            } else {
                console.warn('Unknown email type or missing IDs in notification:', {
                    emailType,
                    campaignId: campaignId || 'missing',
                    templateId: templateId || 'missing',
                    messageId: mailData.messageId,
                    notificationType,
                });
                return res.status(200).json({ message: 'Notification processed (unknown email type)' });
            }

            return res.status(200).json({ message: 'Notification processed' });
        }

        return res.status(200).json({ message: 'Message received' });
    } catch (error) {
        console.error('Error processing SNS notification:', error);
        return res.status(500).json({ message: 'Error processing notification', error: error.message });
    }
}

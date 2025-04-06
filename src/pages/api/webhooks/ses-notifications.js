// src/pages/api/webhooks/ses-notifications.js
import connectToDatabase from '@/lib/mongodb';
import { createTrackingModel } from '@/models/TrackingEvent';
import Contact from '@/models/Contact';
import Campaign from '@/models/Campaign';
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

            // Extract campaign ID and contact ID from message tags - AWS SDK v3 format
            let campaignId, contactId;

            // Primary method: Extract from tags (SDK v3 format)
            if (mailData.tags) {
                // Format expected with SDK v3: {tags: {campaignId: ['abc123'], contactId: ['def456']}}
                if (mailData.tags.campaignId && mailData.tags.campaignId.length > 0) {
                    campaignId = mailData.tags.campaignId[0];
                }
                if (mailData.tags.contactId && mailData.tags.contactId.length > 0) {
                    contactId = mailData.tags.contactId[0];
                }
            }

            // If we couldn't find the IDs in tags, look for them in other parts of the message
            if (!campaignId || !contactId) {
                // Search in message ID
                if (mailData.messageId) {
                    const campaignMatch = mailData.messageId.match(/campaign[-_]([a-f0-9]+)/i);
                    if (campaignMatch && campaignMatch[1]) {
                        campaignId = campaignMatch[1];
                    }
                }

                // Look in destination email for encoded information
                if (mailData.destination && mailData.destination.length > 0) {
                    for (const email of mailData.destination) {
                        // Sometimes IDs are encoded in email addresses (e.g., campaign+123+456@domain.com)
                        const emailMatch = email.match(/campaign\+([a-f0-9]+)\+([a-f0-9]+)@/i);
                        if (emailMatch && emailMatch.length >= 3) {
                            campaignId = emailMatch[1];
                            contactId = emailMatch[2];
                            break;
                        }
                    }
                }
            }

            // As a last resort, if we have campaignId but not contactId,
            // try to look up the contact by email in bounce/complaint recipients
            if (campaignId && !contactId) {
                try {
                    let email = null;

                    if (messageContent.eventType === 'Bounce' && messageContent.bounce && messageContent.bounce.bouncedRecipients && messageContent.bounce.bouncedRecipients.length > 0) {
                        email = messageContent.bounce.bouncedRecipients[0].emailAddress;
                    } else if (messageContent.eventType === 'Complaint' && messageContent.complaint && messageContent.complaint.complainedRecipients && messageContent.complaint.complainedRecipients.length > 0) {
                        email = messageContent.complaint.complainedRecipients[0].emailAddress;
                    }

                    if (email) {
                        const contact = await Contact.findOne({ email: email });
                        if (contact) {
                            contactId = contact._id.toString();
                        }
                    }
                } catch (err) {
                    console.error('Error finding contact by email:', err);
                }
            }

            // Final check if we have both IDs
            if (!campaignId || !contactId) {
                console.warn('Missing campaignId or contactId in notification:', {
                    messageId: mailData.messageId,
                    foundCampaignId: campaignId || 'missing',
                    foundContactId: contactId || 'missing',
                    notificationType: messageContent.eventType,
                });
                return res.status(200).json({ message: 'Notification processed (missing IDs)' });
            }
            const notificationType = messageContent.eventType;

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

            return res.status(200).json({ message: 'Notification processed' });
        }

        return res.status(200).json({ message: 'Message received' });
    } catch (error) {
        console.error('Error processing SNS notification:', error);
        return res.status(500).json({ message: 'Error processing notification', error: error.message });
    }
}

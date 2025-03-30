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
                console.log('SNS subscription confirmed');
                return res.status(200).json({ message: 'Subscription confirmed' });
            } else {
                console.error('Failed to confirm SNS subscription');
                return res.status(500).json({ message: 'Failed to confirm subscription' });
            }
        }
        console.log(
            'Received SNS notification:',
            JSON.stringify({
                Type: snsMessage.Type,
                TopicArn: snsMessage.TopicArn,
                MessageId: snsMessage.MessageId,
            })
        );
        // Handle notification messages
        if (snsMessage.Type === 'Notification') {
            const messageContent = JSON.parse(snsMessage.Message);

            if (messageContent.mail) {
                console.log(
                    'Mail object structure:',
                    JSON.stringify({
                        messageId: messageContent.mail.messageId,
                        timestamp: messageContent.mail.timestamp,
                        source: messageContent.mail.source,
                        hasHeaders: !!messageContent.mail.headers,
                        hasTags: !!messageContent.mail.tags,
                        hasMessageTags: !!messageContent.mail.messageTags,
                        destination: messageContent.mail.destination,
                    })
                );
            }

            const mailData = messageContent.mail;

            if (!mailData) {
                return res.status(200).json({ message: 'Notification processed (no mail data)' });
            }

            // Extract campaign ID and contact ID from message tags
            let campaignId, contactId;

            if (mailData.tags) {
                if (mailData.tags.campaignId) {
                    campaignId = mailData.tags.campaignId[0];
                }
                if (mailData.tags.contactId) {
                    contactId = mailData.tags.contactId[0];
                }
            } else if (mailData.messageTags) {
                // Try the messageTag format (SES might use this format instead)
                const campaignTag = mailData.messageTag?.find((tag) => tag.name === 'campaignId');
                const contactTag = mailData.messageTag?.find((tag) => tag.name === 'contactId');

                if (campaignTag) campaignId = campaignTag.value;
                if (contactTag) contactId = contactTag.value;
            } else {
                // As a fallback, try to extract from headers or message ID
                // Common pattern is to include campaign ID in the message ID or headers
                if (mailData.commonHeaders && mailData.commonHeaders.messageId) {
                    const msgIdMatch = mailData.commonHeaders.messageId.match(/campaign[-_]([a-f0-9]+)/i);
                    if (msgIdMatch && msgIdMatch[1]) {
                        campaignId = msgIdMatch[1];
                    }
                }
            }

            if (!campaignId || !contactId) {
                console.warn('Missing campaignId or contactId in notification. Message data:', JSON.stringify(mailData));
                return res.status(200).json({ message: 'Notification processed (missing IDs)' });
            }

            const notificationType = messageContent.notificationType;

            if (notificationType === 'Bounce') {
                console.log(
                    'Bounce object structure:',
                    JSON.stringify({
                        bounceType: messageContent.bounce.bounceType,
                        bounceSubType: messageContent.bounce.bounceSubType,
                        timestamp: messageContent.bounce.timestamp,
                        feedbackId: messageContent.bounce.feedbackId,
                        reportingMTA: messageContent.bounce.reportingMTA,
                        hasRecipients: !!messageContent.bounce.bouncedRecipients,
                        recipientCount: messageContent.bounce.bouncedRecipients?.length,
                    })
                );
                const bounceInfo = messageContent.bounce;
                const recipients = bounceInfo.bouncedRecipients;
                const bounceType = bounceInfo.bounceType; // Permanent or Transient
                const subType = bounceInfo.bounceSubType;

                // Only mark as unsubscribed for permanent bounces
                const isPermanent = bounceType === 'Permanent';

                if (isPermanent) {
                    // Update contact status directly using the contactId from tags
                    await Contact.findByIdAndUpdate(contactId, {
                        isUnsubscribed: true,
                        unsubscribedAt: new Date(),
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

                console.log('Complaint received:', {
                    recipients: recipients.map((r) => r.emailAddress),
                    campaignId,
                    contactId,
                });

                // Update contact directly using the contactId from tags
                await Contact.findByIdAndUpdate(contactId, {
                    isUnsubscribed: true,
                    unsubscribedAt: new Date(),
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

                console.log('Delivery success:', {
                    email: mailData.destination[0],
                    campaignId,
                    contactId,
                });

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

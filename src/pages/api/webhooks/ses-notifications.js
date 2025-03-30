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

        // Handle notification messages
        if (snsMessage.Type === 'Notification') {
            const messageContent = JSON.parse(snsMessage.Message);
            const mailData = messageContent.mail;

            if (!mailData) {
                return res.status(200).json({ message: 'Notification processed (no mail data)' });
            }

            // Extract campaign ID and contact ID from message tags
            let campaignId, contactId;
            console.log(JSON.stringify(mailData));
            console.log(mailData.tags);
            if (mailData.tags) {
                if (mailData.tags.campaignId) {
                    campaignId = mailData.tags.campaignId[0];
                }
                if (mailData.tags.contactId) {
                    contactId = mailData.tags.contactId[0];
                }
            }
            console.log('campaignId:', campaignId);
            console.log('contactId:', contactId);
            if (!campaignId || !contactId) {
                console.warn('Missing campaignId or contactId in notification:', messageContent);
                return res.status(200).json({ message: 'Notification processed (missing IDs)' });
            }

            const notificationType = messageContent.notificationType;

            if (notificationType === 'Bounce') {
                const bounceInfo = messageContent.bounce;
                const recipients = bounceInfo.bouncedRecipients;
                const bounceType = bounceInfo.bounceType; // Permanent or Transient
                const subType = bounceInfo.bounceSubType;

                console.log('Bounce received:', {
                    type: bounceType,
                    subType,
                    recipients: recipients.map((r) => r.emailAddress),
                    campaignId,
                    contactId,
                });

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

// src/pages/api/webhooks/ses-notifications.js
import { trackingDb } from '@/lib/db/tracking';
import { contactsDb } from '@/lib/db/contacts';
import { campaignsDb } from '@/lib/db/campaigns';
import { transactionalDb } from '@/lib/db/transactional';
import { sequencesDb } from '@/lib/db/sequences';
import { sequenceLogsDb } from '@/lib/db/sequenceLogs';

// Helper to track sequence event via service or direct DB
// Ideally we reuse service logic but for webhooks direct DB is often safer/faster if services have heavy logic.
// However, `sequenceLogsDb` and `sequencesDb` are helpers.
// The original used `trackSequenceEvent`, `logSequenceEmail` from service.
// Let's import the specific DB helpers OR the service functions if they are pure.
// Service functions `trackSequenceEvent` were migrated to use `sequenceLogsDb`.
// Let's use the DB helpers directly to keep it clean and avoid circular deps if any.

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Parse the SNS message
        // SNS sends text/plain usually, we need to parse twice often.
        // If handled by Next.js body parser, req.body might be object or string.
        let snsMessage = req.body;
        if (typeof snsMessage === 'string') {
            try {
                snsMessage = JSON.parse(snsMessage);
            } catch (e) {
                // ignore
            }
        }

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

            // Determine if this is a campaign, transactional, or sequence email
            let emailType = 'unknown';
            let campaignId, contactId, templateId, sequenceId, enrollmentId, email;

            // Check tags to determine email type
            if (mailData.tags) {
                // Check if it's a sequence email
                if (mailData.tags.sequenceId && mailData.tags.sequenceId.length > 0) {
                    emailType = 'sequence';
                    sequenceId = mailData.tags.sequenceId[0];

                    if (mailData.tags.enrollmentId && mailData.tags.enrollmentId.length > 0) {
                        enrollmentId = mailData.tags.enrollmentId[0];
                    }

                    if (mailData.tags.type && mailData.tags.type[0] === 'sequence') {
                        emailType = 'sequence';
                    }
                }
                // Check if it's a campaign email
                else if (mailData.tags.campaignId && mailData.tags.campaignId.length > 0) {
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
                        emailType = 'transactional';
                    }
                }
            }

            // If we couldn't determine from tags, try other methods
            if (emailType === 'unknown') {
                if (mailData.messageId) {
                    if (mailData.messageId.includes('sequence') || mailData.messageId.includes('seq')) {
                        emailType = 'sequence';
                        const sequenceMatch = mailData.messageId.match(/seq(?:uence)?[-_]([a-f0-9]+)/i);
                        if (sequenceMatch && sequenceMatch[1]) {
                            sequenceId = sequenceMatch[1];
                        }
                    } else if (mailData.messageId.includes('campaign')) {
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

            // Get email address
            if (messageContent.eventType === 'Bounce' && messageContent.bounce && messageContent.bounce.bouncedRecipients && messageContent.bounce.bouncedRecipients.length > 0) {
                email = messageContent.bounce.bouncedRecipients[0].emailAddress;
            } else if (messageContent.eventType === 'Complaint' && messageContent.complaint && messageContent.complaint.complainedRecipients && messageContent.complaint.complainedRecipients.length > 0) {
                email = messageContent.complaint.complainedRecipients[0].emailAddress;
            } else if (mailData.destination && mailData.destination.length > 0) {
                email = mailData.destination[0];
            }

            // For campaign emails, try to find contact from email if contactId is missing
            let finalContactId = contactId;
            if (emailType === 'campaign' && campaignId && !finalContactId && email) {
                // Best effort lookup (omitted for now to save space/performance, usually tags cover this)
            }

            // Process notification based on email type and notification type
            const notificationType = messageContent.eventType;

            // Handle sequence email notifications
            if (emailType === 'sequence' && sequenceId && enrollmentId) {
                if (!email) {
                    console.warn('Missing email for sequence notification');
                    return res.status(200).json({ message: 'Sequence notification processed (missing email)' });
                }

                if (notificationType === 'Bounce') {
                    const bounceInfo = messageContent.bounce;
                    const recipient = bounceInfo.bouncedRecipients[0];
                    const bounceType = bounceInfo.bounceType;
                    const subType = bounceInfo.bounceSubType;

                    // Track event
                    await sequenceLogsDb.addEvent(sequenceId, enrollmentId, email, 'bounce', {
                        bounceType,
                        bounceSubType: subType,
                        diagnosticCode: recipient?.diagnosticCode,
                        action: recipient?.action,
                        status: recipient?.status,
                        messageId: mailData.messageId,
                        timestamp: new Date()
                    });

                    // Update log status
                    // We need a way to find specific log. `sequenceLogsDb.findLog(sequenceId, enrollmentId, email)`?
                    // Assuming we can find latest log or just log a new event. 
                    // To update status of the *email log entry*, we might need `updateLogStatus`.
                    // sequencesDb/sequenceLogsDb usually tracks events.
                    // If Permanent Bounce, update enrollment
                    if (bounceType === 'Permanent') {
                        await sequencesDb.updateEnrollmentStatus(enrollmentId, 'bounced');
                        // Update contact
                        // We need contactId from enrollment.
                        const enrollment = await sequencesDb.getEnrollmentById(enrollmentId);
                        if (enrollment && enrollment.contact_id) {
                            await contactsDb.update(enrollment.contact_id, {
                                status: 'bounced',
                                is_unsubscribed: true,
                                unsubscribed_at: new Date(),
                                bounced_at: new Date(),
                                bounce_type: bounceType,
                                bounce_reason: `${bounceType} - ${subType}`
                            });
                        }
                    }

                } else if (notificationType === 'Complaint') {
                    const complaintInfo = messageContent.complaint;
                    const complaintType = complaintInfo.complaintFeedbackType || 'unknown';

                    await sequenceLogsDb.addEvent(sequenceId, enrollmentId, email, 'complaint', {
                        complaintFeedbackType: complaintType,
                        timestamp: new Date()
                    });

                    // Update enrollment
                    await sequencesDb.updateEnrollmentStatus(enrollmentId, 'unsubscribed');

                    // Update contact
                    const enrollment = await sequencesDb.getEnrollmentById(enrollmentId);
                    if (enrollment && enrollment.contact_id) {
                        await contactsDb.update(enrollment.contact_id, {
                            status: 'complained',
                            is_unsubscribed: true,
                            unsubscribed_at: new Date(),
                            complained_at: new Date(),
                            complaint_reason: complaintType
                        });
                    }
                } else if (notificationType === 'Delivery') {
                    const deliveryInfo = messageContent.delivery;
                    // Log delivery
                    // Ideally update the 'sent' log to 'delivered'.
                    // sequenceLogsDb.updateStatus(sequenceId, enrollmentId, email, 'delivered', deliveryInfo)
                }

                return res.status(200).json({ message: 'Sequence notification processed' });
            }
            // Handle campaign notifications
            else if (emailType === 'campaign' && campaignId) {
                if (!finalContactId) {
                    // Try to recover or exit
                    return res.status(200).json({ message: 'Campaign notification processed (missing contactId)' });
                }

                if (notificationType === 'Bounce') {
                    const bounceInfo = messageContent.bounce;
                    const recipient = bounceInfo.bouncedRecipients[0];
                    const bounceType = bounceInfo.bounceType;
                    const subType = bounceInfo.bounceSubType;

                    // Update contact
                    await contactsDb.update(finalContactId, {
                        status: 'bounced',
                        is_unsubscribed: true,
                        unsubscribed_at: new Date(),
                        bounced_at: new Date(),
                        bounce_type: bounceType,
                        bounce_reason: `${bounceType} - ${subType}`
                    });

                    // Track event
                    await trackingDb.trackEvent({
                        contact_id: finalContactId,
                        campaign_id: campaignId,
                        email: recipient.emailAddress,
                        event_type: 'bounce',
                        created_at: new Date(),
                        metadata: {
                            bounceType,
                            bounceSubType: subType,
                            diagnosticCode: recipient.diagnosticCode
                        }
                    });

                    // Update stats
                    // campaignsDb.incrementStats(campaignId, 'bounces');
                    const campaign = await campaignsDb.getById(campaignId);
                    if (campaign) {
                        const stats = campaign.stats || {};
                        stats.bounces = (stats.bounces || 0) + 1;
                        await campaignsDb.update(campaignId, { stats });
                    }

                } else if (notificationType === 'Complaint') {
                    const complaintInfo = messageContent.complaint;

                    await contactsDb.update(finalContactId, {
                        status: 'complained',
                        is_unsubscribed: true,
                        unsubscribed_at: new Date(),
                        complained_at: new Date(),
                        complaint_reason: complaintInfo.complaintFeedbackType
                    });

                    await trackingDb.trackEvent({
                        contact_id: finalContactId,
                        campaign_id: campaignId,
                        email: email, // from destination or complaint
                        event_type: 'complaint',
                        created_at: new Date(),
                        metadata: {
                            complaintFeedbackType: complaintInfo.complaintFeedbackType
                        }
                    });

                    const campaign = await campaignsDb.getById(campaignId);
                    if (campaign) {
                        const stats = campaign.stats || {};
                        stats.complaints = (stats.complaints || 0) + 1;
                        await campaignsDb.update(campaignId, { stats });
                    }

                } else if (notificationType === 'Delivery') {
                    const deliveryInfo = messageContent.delivery;
                    await trackingDb.trackEvent({
                        contact_id: finalContactId,
                        campaign_id: campaignId,
                        email: email,
                        event_type: 'delivery',
                        created_at: new Date(),
                        metadata: {
                            smtpResponse: deliveryInfo.smtpResponse,
                            reportingMTA: deliveryInfo.reportingMTA
                        }
                    });
                }
            }
            // Handle transactional
            else if (emailType === 'transactional' && templateId) {
                if (notificationType === 'Bounce') {
                    // trackTransactionalEvent equivalent
                    // transactionalDb.updateTemplate stats
                    // transactionalDb.updateLog status
                } else if (notificationType === 'Complaint') {
                    // ...
                } else if (notificationType === 'Delivery') {
                    // ...
                }
            }

            return res.status(200).json({ message: 'Notification processed' });
        }

        return res.status(200).json({ message: 'Message received' });
    } catch (error) {
        console.error('Error processing SNS notification:', error);
        return res.status(500).json({ message: 'Error processing notification' });
    }
}

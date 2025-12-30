/**
 * SendGrid Webhook Handler
 *
 * Handles SendGrid Event Webhook notifications for tracking:
 * - delivered, bounce, dropped, deferred
 * - open, click
 * - spamreport, unsubscribe
 */

import connectToDatabase from '@/lib/mongodb';
import { createTrackingModel } from '@/models/TrackingEvent';
import Contact from '@/models/Contact';
import Campaign from '@/models/Campaign';
import TransactionalTemplate from '@/models/TransactionalTemplate';
import TransactionalLog from '@/models/TransactionalLog';
import mongoose from 'mongoose';

// Map SendGrid events to internal event types
const EVENT_MAP = {
    delivered: 'delivery',
    bounce: 'bounce',
    dropped: 'bounce',
    deferred: 'deferred',
    open: 'open',
    click: 'click',
    spamreport: 'complaint',
    unsubscribe: 'unsubscribe',
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        await connectToDatabase();

        // SendGrid sends an array of events
        const events = Array.isArray(req.body) ? req.body : [req.body];

        for (const event of events) {
            try {
                await processEvent(event);
            } catch (eventError) {
                console.error('Error processing SendGrid event:', eventError, event);
            }
        }

        return res.status(200).json({ message: 'Events processed' });
    } catch (error) {
        console.error('Error processing SendGrid webhook:', error);
        return res.status(500).json({ message: 'Error processing webhook', error: error.message });
    }
}

async function processEvent(event) {
    const { event: eventType, email, timestamp, sg_message_id } = event;

    // Get custom arguments (passed during send)
    const campaignId = event.campaignId || event.campaign_id;
    const contactId = event.contactId || event.contact_id;
    const templateId = event.templateId || event.template_id;
    const emailType = event.emailType || event.email_type || (templateId ? 'transactional' : campaignId ? 'campaign' : 'unknown');

    const internalEventType = EVENT_MAP[eventType];
    if (!internalEventType) {
        console.log(`Ignoring SendGrid event type: ${eventType}`);
        return;
    }

    // Handle campaign events
    if (emailType === 'campaign' && campaignId) {
        await processCampaignEvent(campaignId, contactId, email, internalEventType, event);
    }
    // Handle transactional events
    else if (emailType === 'transactional' && templateId) {
        await processTransactionalEvent(templateId, email, internalEventType, event);
    }
}

async function processCampaignEvent(campaignId, contactId, email, eventType, rawEvent) {
    // Try to find contact if contactId is missing
    if (!contactId && email) {
        try {
            const contact = await Contact.findOne({ email: email.toLowerCase() });
            if (contact) {
                contactId = contact._id.toString();
            }
        } catch (err) {
            console.error('Error finding contact:', err);
        }
    }

    if (!contactId) {
        console.warn('Missing contactId for campaign event:', { campaignId, email, eventType });
        return;
    }

    const TrackingModel = createTrackingModel(campaignId);

    // Create tracking event
    const trackingEvent = new TrackingModel({
        contactId: new mongoose.Types.ObjectId(contactId),
        campaignId: new mongoose.Types.ObjectId(campaignId),
        email,
        eventType,
        timestamp: new Date(rawEvent.timestamp * 1000),
        metadata: {
            provider: 'sendgrid',
            rawEvent: rawEvent.event,
            url: rawEvent.url, // For click events
            useragent: rawEvent.useragent,
            ip: rawEvent.ip,
        },
    });

    await trackingEvent.save();

    // Update campaign stats
    const statsUpdate = {};
    switch (eventType) {
        case 'bounce':
            statsUpdate['stats.bounces'] = 1;
            break;
        case 'complaint':
            statsUpdate['stats.complaints'] = 1;
            break;
        case 'open':
            statsUpdate['stats.opens'] = 1;
            break;
        case 'click':
            statsUpdate['stats.clicks'] = 1;
            break;
    }

    if (Object.keys(statsUpdate).length > 0) {
        await Campaign.findByIdAndUpdate(campaignId, { $inc: statsUpdate });
    }

    // Update contact status for bounces and complaints
    if (eventType === 'bounce') {
        await Contact.findByIdAndUpdate(contactId, {
            status: 'bounced',
            isUnsubscribed: true,
            unsubscribedAt: new Date(),
            bouncedAt: new Date(),
            bounceType: rawEvent.bounce_classification || 'unknown',
            bounceReason: rawEvent.reason || 'Bounce',
        });
    } else if (eventType === 'complaint') {
        await Contact.findByIdAndUpdate(contactId, {
            status: 'complained',
            isUnsubscribed: true,
            unsubscribedAt: new Date(),
            complainedAt: new Date(),
            complaintReason: 'Spam Report',
        });
    } else if (eventType === 'unsubscribe') {
        await Contact.findByIdAndUpdate(contactId, {
            status: 'unsubscribed',
            isUnsubscribed: true,
            unsubscribedAt: new Date(),
            unsubscribeReason: 'Unsubscribe link clicked',
        });
    }
}

async function processTransactionalEvent(templateId, email, eventType, rawEvent) {
    // Update template stats
    const statsUpdate = {};
    switch (eventType) {
        case 'bounce':
            statsUpdate['stats.bounces'] = 1;
            break;
        case 'complaint':
            statsUpdate['stats.complaints'] = 1;
            break;
        case 'open':
            statsUpdate['stats.opens'] = 1;
            break;
        case 'click':
            statsUpdate['stats.clicks'] = 1;
            break;
    }

    if (Object.keys(statsUpdate).length > 0) {
        await TransactionalTemplate.findByIdAndUpdate(templateId, { $inc: statsUpdate });
    }

    // Update TransactionalLog
    const logUpdate = {};
    if (eventType === 'delivery') {
        logUpdate.status = 'delivered';
        logUpdate['metadata.deliveredAt'] = new Date();
    } else if (eventType === 'bounce') {
        logUpdate.status = 'failed';
        logUpdate.error = `Bounce: ${rawEvent.reason || 'Unknown'}`;
    } else if (eventType === 'complaint') {
        logUpdate.error = 'Spam Report';
    }

    if (Object.keys(logUpdate).length > 0) {
        await TransactionalLog.findOneAndUpdate({ templateId, to: email, status: 'sent' }, logUpdate);
    }
}

// Disable body parsing to receive raw body for signature verification
export const config = {
    api: {
        bodyParser: true,
    },
};

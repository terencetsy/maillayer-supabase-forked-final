/**
 * Mailgun Webhook Handler
 *
 * Handles Mailgun webhook notifications for tracking:
 * - delivered, failed (bounce)
 * - opened, clicked
 * - complained, unsubscribed
 */

import connectToDatabase from '@/lib/mongodb';
import { createTrackingModel } from '@/models/TrackingEvent';
import Contact from '@/models/Contact';
import Campaign from '@/models/Campaign';
import TransactionalTemplate from '@/models/TransactionalTemplate';
import TransactionalLog from '@/models/TransactionalLog';
import mongoose from 'mongoose';
import crypto from 'crypto';

// Map Mailgun events to internal event types
const EVENT_MAP = {
    delivered: 'delivery',
    failed: 'bounce',
    opened: 'open',
    clicked: 'click',
    complained: 'complaint',
    unsubscribed: 'unsubscribe',
};

// Verify Mailgun webhook signature
function verifySignature(timestamp, token, signature, signingKey) {
    if (!signingKey) {
        console.warn('Mailgun signing key not configured, skipping signature verification');
        return true;
    }

    const encodedToken = crypto.createHmac('sha256', signingKey).update(timestamp + token).digest('hex');

    return encodedToken === signature;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        await connectToDatabase();

        // Mailgun sends events in different formats depending on webhook version
        const eventData = req.body['event-data'] || req.body;
        const signature = req.body.signature;

        // Verify signature if signing key is configured
        if (signature && process.env.MAILGUN_WEBHOOK_SIGNING_KEY) {
            const isValid = verifySignature(signature.timestamp, signature.token, signature.signature, process.env.MAILGUN_WEBHOOK_SIGNING_KEY);

            if (!isValid) {
                console.error('Invalid Mailgun webhook signature');
                return res.status(401).json({ message: 'Invalid signature' });
            }
        }

        await processEvent(eventData);

        return res.status(200).json({ message: 'Event processed' });
    } catch (error) {
        console.error('Error processing Mailgun webhook:', error);
        return res.status(500).json({ message: 'Error processing webhook', error: error.message });
    }
}

async function processEvent(eventData) {
    const event = eventData.event;
    const recipient = eventData.recipient;
    const timestamp = eventData.timestamp;

    // Get custom variables (passed during send via headers)
    const userVariables = eventData['user-variables'] || {};
    const campaignId = userVariables.campaignId || userVariables.campaign_id;
    const contactId = userVariables.contactId || userVariables.contact_id;
    const templateId = userVariables.templateId || userVariables.template_id;
    const emailType = userVariables.emailType || (templateId ? 'transactional' : campaignId ? 'campaign' : 'unknown');

    const internalEventType = EVENT_MAP[event];
    if (!internalEventType) {
        console.log(`Ignoring Mailgun event type: ${event}`);
        return;
    }

    // Handle campaign events
    if (emailType === 'campaign' && campaignId) {
        await processCampaignEvent(campaignId, contactId, recipient, internalEventType, eventData);
    }
    // Handle transactional events
    else if (emailType === 'transactional' && templateId) {
        await processTransactionalEvent(templateId, recipient, internalEventType, eventData);
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
            provider: 'mailgun',
            rawEvent: rawEvent.event,
            url: rawEvent.url, // For click events
            ip: rawEvent.ip,
            country: rawEvent.geolocation?.country,
            city: rawEvent.geolocation?.city,
            device: rawEvent['client-info']?.['device-type'],
            clientName: rawEvent['client-info']?.['client-name'],
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
        const severity = rawEvent.severity || 'permanent';
        const reason = rawEvent['delivery-status']?.message || rawEvent.reason || 'Bounce';

        await Contact.findByIdAndUpdate(contactId, {
            status: 'bounced',
            isUnsubscribed: severity === 'permanent',
            unsubscribedAt: severity === 'permanent' ? new Date() : undefined,
            bouncedAt: new Date(),
            bounceType: severity,
            bounceReason: reason,
        });
    } else if (eventType === 'complaint') {
        await Contact.findByIdAndUpdate(contactId, {
            status: 'complained',
            isUnsubscribed: true,
            unsubscribedAt: new Date(),
            complainedAt: new Date(),
            complaintReason: 'Spam Complaint',
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
        logUpdate.error = `Bounce: ${rawEvent['delivery-status']?.message || 'Unknown'}`;
    } else if (eventType === 'complaint') {
        logUpdate.error = 'Spam Complaint';
    }

    if (Object.keys(logUpdate).length > 0) {
        await TransactionalLog.findOneAndUpdate({ templateId, to: email, status: 'sent' }, logUpdate);
    }
}

export const config = {
    api: {
        bodyParser: true,
    },
};

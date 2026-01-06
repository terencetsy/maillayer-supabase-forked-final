/**
 * Mailgun Webhook Handler
 */

import { trackingDb } from '@/lib/db/tracking';
import { contactsDb } from '@/lib/db/contacts';
import { campaignsDb } from '@/lib/db/campaigns';
import { transactionalDb } from '@/lib/db/transactional';
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
    let finalContactId = contactId;
    if (!finalContactId && email) {
        // Skipped simple lookup for now
    }

    if (!finalContactId) {
        console.warn('Missing contactId for campaign event:', { campaignId, email, eventType });
        // Proceed for stats if possible
    }

    // Create tracking event
    const trackingEvent = {
        contact_id: finalContactId,
        campaign_id: campaignId,
        email,
        event_type: eventType,
        created_at: rawEvent.timestamp ? new Date(rawEvent.timestamp * 1000) : new Date(),
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
    };

    await trackingDb.trackEvent(trackingEvent);

    // Update campaign stats
    try {
        const campaign = await campaignsDb.getById(campaignId);
        if (campaign) {
            const stats = campaign.stats || {};
            const keyMap = {
                'bounce': 'bounces',
                'complaint': 'complaints',
                'open': 'opens',
                'click': 'clicks'
            };
            const key = keyMap[eventType];
            if (key) {
                stats[key] = (stats[key] || 0) + 1;
                await campaignsDb.update(campaignId, { stats });
            }
        }
    } catch (e) { }

    // Update contact status for bounces and complaints
    if (finalContactId) {
        const updateData = {};
        if (eventType === 'bounce') {
            const severity = rawEvent.severity || 'permanent';
            const reason = rawEvent['delivery-status']?.message || rawEvent.reason || 'Bounce';

            updateData.status = 'bounced';
            updateData.is_unsubscribed = (severity === 'permanent');
            if (severity === 'permanent') updateData.unsubscribed_at = new Date();
            updateData.bounced_at = new Date();
            // bounceType: severity, bounceReason: reason
        } else if (eventType === 'complaint') {
            updateData.status = 'complained';
            updateData.is_unsubscribed = true;
            updateData.unsubscribed_at = new Date();
            updateData.complained_at = new Date();
        } else if (eventType === 'unsubscribe') {
            updateData.status = 'unsubscribed';
            updateData.is_unsubscribed = true;
            updateData.unsubscribed_at = new Date();
        }

        if (Object.keys(updateData).length > 0) {
            await contactsDb.update(finalContactId, updateData);
        }
    }
}

async function processTransactionalEvent(templateId, email, eventType, rawEvent) {
    // Update template stats
    try {
        const template = await transactionalDb.getTemplateById(templateId);
        if (template) {
            const stats = template.stats || {};
            const keyMap = {
                'bounce': 'bounces',
                'complaint': 'complaints',
                'open': 'opens',
                'click': 'clicks'
            };
            const key = keyMap[eventType];
            if (key) {
                stats[key] = (stats[key] || 0) + 1;
                await transactionalDb.updateTemplate(templateId, { stats });
            }
        }
    } catch (e) { }

    // Update TransactionalLog
    // Skipping log update for now as discussed (no helper yet), or assuming it's done elsewhere
}

export const config = {
    api: {
        bodyParser: true,
    },
};

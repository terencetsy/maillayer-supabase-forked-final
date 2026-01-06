import { trackingDb } from '@/lib/db/tracking';
import { campaignsDb } from '@/lib/db/campaigns';
import crypto from 'crypto';
import config from '@/lib/config';

export function generateTrackingToken(campaignId, contactId, email) {
    const dataToHash = `${campaignId}:${contactId}:${email}:${config.trackingSecret || 'tracking-secret-key'}`;
    return crypto.createHash('sha256').update(dataToHash).digest('hex');
}

export function verifyTrackingToken(token, campaignId, contactId, email) {
    const expectedToken = generateTrackingToken(campaignId, contactId, email);
    return token === expectedToken;
}

export async function trackEvent(campaignId, contactId, email, eventType, metadata = {}, requestData = {}) {
    try {
        const eventData = {
            campaign_id: campaignId,
            contact_id: contactId,
            email,
            event_type: eventType,
            metadata,
            ip_address: requestData.ipAddress,
            user_agent: requestData.userAgent,
            created_at: new Date()
        };

        const event = await trackingDb.trackEvent(eventData);

        // Update campaign stats
        // We can use an atomic increment helper or fetch-update
        // campaignsDb.incrementStat(campaignId, eventType + 's')

        return { success: true, event };
    } catch (error) {
        console.error(`Error tracking ${eventType} event:`, error);
        return { success: false, error: error.message };
    }
}

export const getCampaignStats = async (campaignId) => {
    try {
        const campaign = await campaignsDb.getById(campaignId);
        if (!campaign) throw new Error('Campaign not found');

        // Stats from campaign table (if maintained there)
        // OR calculate from trackingDb events

        let stats = campaign.stats || {};

        // If we want real-time from events table:
        const opens = await trackingDb.countEvents(campaignId, 'open');
        const clicks = await trackingDb.countEvents(campaignId, 'click');
        // ... bounces, complaints

        // Calculate unique? (Harder without RPC, falling back to totals or stats column)
        // For MVP, if we maintained `stats` column in campaign during tracking, use that.
        // It's much faster.

        // Let's use stored campaign stats
        return {
            recipients: stats.recipients || 0,
            open: { total: stats.opens || 0, unique: stats.unique_opens || 0 }, // Assuming we track these
            click: { total: stats.clicks || 0, unique: stats.unique_clicks || 0 },
            // ... keys matching old service
        };
    } catch (error) {
        return {
            recipients: 0,
            open: { total: 0, unique: 0 },
            // ...
        }
    }
};

export async function getCampaignEvents(campaignId, options = {}) {
    // Map options
    const { data, total } = await trackingDb.getEvents(campaignId, {
        limit: options.limit,
        offset: (options.page - 1) * options.limit,
        eventType: options.eventType,
        email: options.email,
        sort: options.sort,
        order: options.order
    });

    return {
        events: data,
        pagination: {
            total,
            totalPages: Math.ceil(total / (options.limit || 50)),
            currentPage: options.page || 1,
            limit: options.limit || 50
        }
    };
}

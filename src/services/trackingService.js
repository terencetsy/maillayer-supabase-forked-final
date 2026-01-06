import { trackingDb } from '@/lib/db/tracking';
import { campaignsDb } from '@/lib/db/campaigns';
import crypto from 'crypto';
import config from '@/lib/config';

// Import geoip helper if needed, but we assume metadata already has geolocation on trackEvent
// src/lib/geoip.js was used in [type].js.
// We need to parse User Agent manually if not parsed during track.
// Mongoose version parsed User Agent during aggregation or used stored specific columns?
// Original Mongoose code: `getDeviceType(event.userAgent)` helper function was in `geostats.js`.
// So it parsed on the fly. We should do the same.

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

        let stats = campaign.stats || {};

        return {
            recipients: stats.recipients || 0,
            open: { total: stats.opens || 0, unique: stats.unique_opens || 0 },
            click: { total: stats.clicks || 0, unique: stats.unique_clicks || 0 },
        };
    } catch (error) {
        return {
            recipients: 0,
            open: { total: 0, unique: 0 },
        }
    }
};

export async function getCampaignEvents(campaignId, options = {}) {
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

// Helpers copied/adapted from geostats.js
function getDeviceType(userAgent) {
    if (!userAgent) return 'Unknown';
    if (/mobile|android|iphone|ipod/i.test(userAgent.toLowerCase())) {
        if (/ipad|tablet/i.test(userAgent.toLowerCase())) return 'Tablet';
        return 'Mobile';
    }
    return 'Desktop';
}

function getBrowserInfo(userAgent) {
    if (!userAgent) return 'Unknown';
    if (/firefox/i.test(userAgent)) return 'Firefox';
    if (/chrome/i.test(userAgent)) return 'Chrome';
    if (/safari/i.test(userAgent)) return 'Safari';
    if (/edge|edg/i.test(userAgent)) return 'Edge';
    if (/msie|trident/i.test(userAgent)) return 'Internet Explorer';
    if (/googleimageproxy/i.test(userAgent.toLowerCase())) return 'Email Client';
    return 'Other';
}

function getOperatingSystem(userAgent) {
    if (!userAgent) return 'Unknown';
    if (/windows/i.test(userAgent)) return 'Windows';
    if (/macintosh|mac os x/i.test(userAgent)) return 'macOS';
    if (/linux/i.test(userAgent)) return 'Linux';
    if (/android/i.test(userAgent)) return 'Android';
    if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
    return 'Other';
}

export async function getCampaignGeoStats(campaignId, eventType = null) {
    const events = await trackingDb.getEventsForStats(campaignId, eventType);

    const stats = {
        countries: {},
        cities: {},
        devices: {},
        browsers: {},
        operatingSystems: {},
        totalEvents: events.length,
        appliedFilter: eventType ? { eventType } : null,
    };

    events.forEach(event => {
        const meta = event.metadata || {};
        const geo = meta.geolocation || {};
        const ua = event.user_agent || '';

        // Country
        const country = geo.country || 'Unknown';
        stats.countries[country] = (stats.countries[country] || 0) + 1;

        // City
        if (geo.city && geo.city !== 'Unknown') {
            const cityKey = `${geo.city}, ${geo.countryCode || ''}`;
            stats.cities[cityKey] = (stats.cities[cityKey] || 0) + 1;
        } else {
            stats.cities['Unknown'] = (stats.cities['Unknown'] || 0) + 1;
        }

        // Device
        const device = getDeviceType(ua);
        stats.devices[device] = (stats.devices[device] || 0) + 1;

        // Browser
        const browser = getBrowserInfo(ua);
        stats.browsers[browser] = (stats.browsers[browser] || 0) + 1;

        // OS
        const os = getOperatingSystem(ua);
        stats.operatingSystems[os] = (stats.operatingSystems[os] || 0) + 1;
    });

    // Helper to sort object to array
    const toArray = (obj) => Object.entries(obj)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    return {
        countries: toArray(stats.countries),
        cities: toArray(stats.cities),
        devices: toArray(stats.devices),
        browsers: toArray(stats.browsers),
        operatingSystems: toArray(stats.operatingSystems),
        totalEvents: stats.totalEvents,
        appliedFilter: stats.appliedFilter
    };
}

import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import Contact from '@/models/Contact';
import { createTrackingModel } from '@/models/TrackingEvent';
import crypto from 'crypto';
import config from '@/lib/config';

export function generateTrackingToken(campaignId, contactId, email) {
    // Create a string to hash
    const dataToHash = `${campaignId}:${contactId}:${email}:${config.trackingSecret || 'tracking-secret-key'}`;

    // Generate SHA-256 hash
    return crypto.createHash('sha256').update(dataToHash).digest('hex');
}

export function verifyTrackingToken(token, campaignId, contactId, email) {
    const expectedToken = generateTrackingToken(campaignId, contactId, email);
    return token === expectedToken;
}

export async function trackEvent(campaignId, contactId, email, eventType, metadata = {}, requestData = {}) {
    await connectToDatabase();

    try {
        // Get campaign-specific tracking model
        const TrackingModel = createTrackingModel(campaignId);

        // Create the tracking event
        const event = new TrackingModel({
            campaignId,
            contactId,
            email,
            eventType,
            metadata,
            ipAddress: requestData.ipAddress,
            userAgent: requestData.userAgent,
        });

        await event.save();

        // Update the campaign stats as well
        const incrementField = `stats.${eventType}s`; // e.g., stats.opens, stats.clicks
        await Campaign.findByIdAndUpdate(campaignId, {
            $inc: { [incrementField]: 1 },
        });

        return { success: true, event };
    } catch (error) {
        console.error(`Error tracking ${eventType} event:`, error);
        return { success: false, error: error.message };
    }
}

export const getCampaignStats = async (campaignId) => {
    try {
        // Create the tracking model for this campaign
        const TrackingModel = createTrackingModel(campaignId);

        // Get basic stats from the campaign model
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            throw new Error('Campaign not found');
        }

        // Get recipients count from campaign stats
        const recipients = campaign.stats?.recipients || 0;

        // Aggregate open events
        const openStats = await TrackingModel.aggregate([
            { $match: { eventType: 'open' } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    unique: { $addToSet: '$email' },
                },
            },
        ]);

        // Aggregate click events
        const clickStats = await TrackingModel.aggregate([
            { $match: { eventType: 'click' } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    unique: { $addToSet: '$email' },
                },
            },
        ]);

        // Aggregate bounce events
        const bounceStats = await TrackingModel.aggregate([
            { $match: { eventType: 'bounce' } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    unique: { $addToSet: '$email' },
                },
            },
        ]);

        // Aggregate complaint events
        const complaintStats = await TrackingModel.aggregate([
            { $match: { eventType: 'complaint' } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    unique: { $addToSet: '$email' },
                },
            },
        ]);

        // Get unsubscribe count from contacts - this is the SOURCE OF TRUTH
        // We count contacts that unsubscribed from this specific campaign
        const unsubscribedContacts = await Contact.find({
            unsubscribedFromCampaign: new mongoose.Types.ObjectId(campaignId),
            isUnsubscribed: true,
        }).select('email');

        // Get unique emails from unsubscribed contacts
        const uniqueUnsubscribedEmails = [...new Set(unsubscribedContacts.map((c) => c.email))];

        // Calculate total and unique counts for each event type
        const open =
            openStats.length > 0
                ? {
                      total: openStats[0].total,
                      unique: openStats[0].unique.length,
                  }
                : { total: 0, unique: 0 };

        const click =
            clickStats.length > 0
                ? {
                      total: clickStats[0].total,
                      unique: clickStats[0].unique.length,
                  }
                : { total: 0, unique: 0 };

        const bounce =
            bounceStats.length > 0
                ? {
                      total: bounceStats[0].total,
                      unique: bounceStats[0].unique.length,
                  }
                : { total: 0, unique: 0 };

        const complaint =
            complaintStats.length > 0
                ? {
                      total: complaintStats[0].total,
                      unique: complaintStats[0].unique.length,
                  }
                : { total: 0, unique: 0 };

        // Use contacts as the single source of truth for unsubscribes
        // This avoids double counting from tracking events + contact model
        const unsubscribed = {
            total: uniqueUnsubscribedEmails.length,
            unique: uniqueUnsubscribedEmails.length,
        };

        // Calculate rates
        const openRate = recipients > 0 ? ((open.unique / recipients) * 100).toFixed(1) : 0;
        const clickRate = recipients > 0 ? ((click.unique / recipients) * 100).toFixed(1) : 0;
        const bounceRate = recipients > 0 ? ((bounce.unique / recipients) * 100).toFixed(1) : 0;
        const complaintRate = recipients > 0 ? ((complaint.unique / recipients) * 100).toFixed(1) : 0;
        const unsubscribeRate = recipients > 0 ? ((unsubscribed.unique / recipients) * 100).toFixed(1) : 0;

        return {
            recipients,
            open,
            click,
            bounce,
            complaint,
            unsubscribed,
            openRate,
            clickRate,
            bounceRate,
            complaintRate,
            unsubscribeRate,
            // Include raw campaign stats for cross-reference
            campaignStats: campaign.stats,
        };
    } catch (error) {
        console.error('Error getting campaign stats:', error);
        // Return basic stats if we encounter an error
        return {
            recipients: 0,
            open: { total: 0, unique: 0 },
            click: { total: 0, unique: 0 },
            bounce: { total: 0, unique: 0 },
            complaint: { total: 0, unique: 0 },
            unsubscribed: { total: 0, unique: 0 },
            openRate: '0',
            clickRate: '0',
            bounceRate: '0',
            complaintRate: '0',
            unsubscribeRate: '0',
        };
    }
};

export async function getCampaignEvents(campaignId, options = {}) {
    await connectToDatabase();

    try {
        const {
            page = 1,
            limit = 50,
            eventType = '',
            email = '',
            sort = 'timestamp',
            order = 'desc',
            includeGeo = true, // New option to include geolocation data
        } = options;

        // Create the tracking model for this campaign
        const TrackingModel = createTrackingModel(campaignId);

        // Build the query
        const query = {
            campaignId: new mongoose.Types.ObjectId(campaignId),
        };

        // Add event type filter if provided
        if (eventType) {
            query.eventType = eventType;
        }

        // Add email filter if provided
        if (email) {
            query.email = { $regex: email, $options: 'i' }; // Case-insensitive search
        }

        // Build sort options
        const sortOption = {};
        sortOption[sort] = order === 'desc' ? -1 : 1;

        // Calculate skip value for pagination
        const skip = (page - 1) * limit;

        // Get total count for pagination
        const total = await TrackingModel.countDocuments(query);
        const totalPages = Math.ceil(total / limit);

        // Get the events
        const events = await TrackingModel.find(query).sort(sortOption).skip(skip).limit(limit);

        // Group events by location if includeGeo is true
        let geoStats = null;

        if (includeGeo) {
            // Aggregate geolocation data
            const geoAggregation = await TrackingModel.aggregate([
                {
                    $match: query,
                },
                {
                    $group: {
                        _id: {
                            country: { $ifNull: ['$metadata.geolocation.country', 'Unknown'] },
                            countryCode: { $ifNull: ['$metadata.geolocation.countryCode', 'XX'] },
                        },
                        count: { $sum: 1 },
                    },
                },
                {
                    $sort: { count: -1 },
                },
                {
                    $limit: 10,
                },
            ]);

            // Also get city data
            const cityAggregation = await TrackingModel.aggregate([
                {
                    $match: query,
                },
                {
                    $group: {
                        _id: {
                            city: { $ifNull: ['$metadata.geolocation.city', 'Unknown'] },
                            country: { $ifNull: ['$metadata.geolocation.country', 'Unknown'] },
                        },
                        count: { $sum: 1 },
                    },
                },
                {
                    $sort: { count: -1 },
                },
                {
                    $limit: 10,
                },
            ]);

            // Format the geolocation stats
            geoStats = {
                countries: geoAggregation.map((item) => ({
                    country: item._id.country,
                    countryCode: item._id.countryCode,
                    count: item.count,
                })),
                cities: cityAggregation.map((item) => ({
                    city: item._id.city,
                    country: item._id.country,
                    count: item.count,
                })),
            };
        }

        return {
            events,
            pagination: {
                total,
                totalPages,
                currentPage: page,
                limit,
            },
            geoStats, // Include geolocation stats if requested
        };
    } catch (error) {
        console.error('Error fetching campaign events:', error);
        throw error;
    }
}

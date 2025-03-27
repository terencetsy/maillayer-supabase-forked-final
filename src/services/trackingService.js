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

export async function getCampaignStats(campaignId) {
    await connectToDatabase();

    try {
        const TrackingModel = createTrackingModel(campaignId);

        // Get aggregate stats
        const stats = await TrackingModel.aggregate([
            { $match: { campaignId: new mongoose.Types.ObjectId(campaignId) } },
            {
                $group: {
                    _id: '$eventType',
                    count: { $sum: 1 },
                    uniqueContacts: { $addToSet: '$contactId' },
                },
            },
            {
                $project: {
                    _id: 0,
                    eventType: '$_id',
                    count: 1,
                    uniqueCount: { $size: '$uniqueContacts' },
                },
            },
        ]);

        // Convert to a more usable format
        const formattedStats = stats.reduce((result, stat) => {
            result[stat.eventType] = {
                total: stat.count,
                unique: stat.uniqueCount,
            };
            return result;
        }, {});

        // Get the campaign to calculate rates
        const campaign = await Campaign.findById(campaignId);

        if (campaign && campaign.stats.recipients > 0) {
            // Calculate rates
            const openRate = ((formattedStats.open?.unique || 0) / campaign.stats.recipients) * 100;
            const clickRate = ((formattedStats.click?.unique || 0) / campaign.stats.recipients) * 100;

            return {
                ...formattedStats,
                recipients: campaign.stats.recipients,
                openRate: parseFloat(openRate.toFixed(2)),
                clickRate: parseFloat(clickRate.toFixed(2)),
                // Include more derived stats as needed
            };
        }

        return formattedStats;
    } catch (error) {
        console.error('Error getting campaign stats:', error);
        throw error;
    }
}

export async function getCampaignEvents(campaignId, options = {}) {
    await connectToDatabase();

    const { page = 1, limit = 50, eventType, email, sort = 'timestamp', order = 'desc' } = options;

    try {
        const TrackingModel = createTrackingModel(campaignId);

        // Build query
        const query = { campaignId: new mongoose.Types.ObjectId(campaignId) };

        if (eventType) {
            query.eventType = eventType;
        }

        if (email) {
            query.email = { $regex: email, $options: 'i' };
        }

        // Build sort options
        const sortOptions = {};
        sortOptions[sort] = order === 'desc' ? -1 : 1;

        // Get total count
        const total = await TrackingModel.countDocuments(query);

        // Get paginated results
        const events = await TrackingModel.find(query)
            .sort(sortOptions)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        return {
            events,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit),
            },
        };
    } catch (error) {
        console.error('Error getting campaign events:', error);
        throw error;
    }
}

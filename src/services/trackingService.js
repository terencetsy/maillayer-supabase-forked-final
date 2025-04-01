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

        // Get unsubscribe events - these might be stored in Contact model rather than tracking events
        // Let's check both sources
        const unsubscribeStats = await TrackingModel.aggregate([
            { $match: { eventType: 'unsubscribe' } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    unique: { $addToSet: '$email' },
                },
            },
        ]);

        // Also check contacts that unsubscribed from this campaign
        const unsubscribedContactsCount = await Contact.countDocuments({
            unsubscribedFromCampaign: mongoose.Types.ObjectId(campaignId),
            isUnsubscribed: true,
        });

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

        const unsubscribed = {
            total: (unsubscribeStats.length > 0 ? unsubscribeStats[0].total : 0) + unsubscribedContactsCount,
            unique: (unsubscribeStats.length > 0 ? unsubscribeStats[0].unique.length : 0) + unsubscribedContactsCount,
        };

        // Calculate rates
        const openRate = recipients > 0 ? ((open.unique / recipients) * 100).toFixed(1) : 0;
        const clickRate = recipients > 0 ? ((click.unique / recipients) * 100).toFixed(1) : 0;
        const bounceRate = recipients > 0 ? ((bounce.unique / recipients) * 100).toFixed(1) : 0;
        const complaintRate = recipients > 0 ? ((complaint.unique / recipients) * 100).toFixed(1) : 0;

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
        };
    }
};

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

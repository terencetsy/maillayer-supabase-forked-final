// src/services/campaignService.js

import connectToDatabase from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import mongoose from 'mongoose';

export async function createCampaign(campaignData) {
    await connectToDatabase();

    const campaign = new Campaign({
        ...campaignData,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    await campaign.save();
    return campaign;
}

export async function getCampaignsByBrandId(brandId, userId, options = {}) {
    await connectToDatabase();

    const { skip = 0, limit = 10 } = options;

    const campaigns = await Campaign.find({
        brandId,
        userId,
    })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    return campaigns;
}

export async function getCampaignsCount(brandId, userId) {
    await connectToDatabase();

    return await Campaign.countDocuments({
        brandId,
        userId,
    });
}

export async function getCampaignById(campaignId, userId) {
    await connectToDatabase();

    const campaign = await Campaign.findOne({
        _id: campaignId,
        userId,
    }).lean();

    return campaign;
}

export async function updateCampaign(campaignId, userId, updateData) {
    await connectToDatabase();

    const result = await Campaign.updateOne(
        { _id: campaignId, userId },
        {
            $set: {
                ...updateData,
                updatedAt: new Date(),
            },
        }
    );

    return result.modifiedCount > 0;
}

export async function deleteCampaign(campaignId, userId) {
    await connectToDatabase();

    const result = await Campaign.deleteOne({ _id: campaignId, userId });
    return result.deletedCount > 0;
}

// Get campaign stats summary for a brand
export async function getCampaignStatsByBrandId(brandId, userId) {
    await connectToDatabase();

    const stats = await Campaign.aggregate([
        { $match: { brandId: new mongoose.Types.ObjectId(brandId), userId: new mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: null,
                totalCampaigns: { $sum: 1 },
                totalSent: { $sum: '$stats.recipients' },
                totalOpens: { $sum: '$stats.opens' },
                totalClicks: { $sum: '$stats.clicks' },
                completedCampaigns: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'sent'] }, 1, 0],
                    },
                },
            },
        },
    ]);

    if (stats.length === 0) {
        return {
            totalCampaigns: 0,
            totalSent: 0,
            totalOpens: 0,
            totalClicks: 0,
            completedCampaigns: 0,
            openRate: 0,
            clickRate: 0,
        };
    }

    const result = stats[0];
    result.openRate = result.totalSent > 0 ? ((result.totalOpens / result.totalSent) * 100).toFixed(1) : 0;
    result.clickRate = result.totalSent > 0 ? ((result.totalClicks / result.totalSent) * 100).toFixed(1) : 0;

    return result;
}

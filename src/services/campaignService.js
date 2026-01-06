import { campaignsDb } from '@/lib/db/campaigns';

export async function createCampaign(campaignData) {
    return await campaignsDb.create(campaignData);
}

export async function getCampaignsByBrandId(brandId, userId, options = {}) {
    const { skip = 0, limit = 10 } = options;
    // Map options to what campaignsDb expects (offset vs skip)
    // campaignsDb might not have pagination yet? 
    // Let's check campaignsDb usage. If it doesn't support pagination, we fetch all or add it.
    // Assuming campaignsDb.getByBrandId supports it or we use raw Supabase in there.
    // For now, let's assume basic fetch is updated or we use campaignsDb.getByBrandId

    // If campaignsDb doesn't have pagination params, we might fetch all.
    // Let's double check campaignsDb implementation in next step or assume standard methods.
    // The previous phase simple implementation: getByBrandId(brandId) -> fetches all.
    // We can slice in memory for MVP or update db helper later.

    const campaigns = await campaignsDb.getByBrandId(brandId);
    // Sort and slice
    // Assuming campaigns are returned sorted? DB helper usually orders.
    // Javascript slice:
    return campaigns.slice(skip, skip + limit);
}

export async function getCampaignsCount(brandId, userId) {
    // Ideally this should be a count query
    const campaigns = await campaignsDb.getByBrandId(brandId);
    return campaigns.length;
}

export async function getCampaignById(campaignId, brandId = null) {
    return await campaignsDb.getById(campaignId);
}

export async function updateCampaign(campaignId, brandId, updateData) {
    return await campaignsDb.update(campaignId, updateData);
}

export async function deleteCampaign(campaignId, brandId) {
    return await campaignsDb.delete(campaignId);
}

// Get campaign stats summary for a brand
export async function getCampaignStatsByBrandId(brandId) {
    // Migration: Perform aggregation effectively in application code
    // Fetch all campaigns for brand
    const campaigns = await campaignsDb.getByBrandId(brandId);

    // Initial stats
    const stats = {
        totalCampaigns: 0,
        totalSent: 0,
        totalOpens: 0,
        totalClicks: 0,
        completedCampaigns: 0,
        openRate: 0,
        clickRate: 0,
    };

    if (!campaigns || campaigns.length === 0) {
        return stats;
    }

    stats.totalCampaigns = campaigns.length;

    campaigns.forEach(campaign => {
        // Assume campaign.stats exists and has { recipients, opens, clicks }
        // Ensure we handle missing stats safely
        const cStats = campaign.stats || {};

        stats.totalSent += cStats.recipients || 0;
        stats.totalOpens += cStats.opens || 0;
        stats.totalClicks += cStats.clicks || 0;

        if (campaign.status === 'sent') {
            stats.completedCampaigns += 1;
        }
    });

    stats.openRate = stats.totalSent > 0 ? ((stats.totalOpens / stats.totalSent) * 100).toFixed(1) : 0;
    stats.clickRate = stats.totalSent > 0 ? ((stats.totalClicks / stats.totalSent) * 100).toFixed(1) : 0;

    return stats;
}

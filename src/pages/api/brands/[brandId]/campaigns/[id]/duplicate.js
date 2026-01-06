import { getCampaignById, createCampaign } from '@/services/campaignService';
import { getBrandById } from '@/services/brandService';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';
import { getUserFromRequest } from '@/lib/supabase';

export default async function handler(req, res) {
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ message: 'Method not allowed' });
        }

        const { user, error } = await getUserFromRequest(req);
        if (error || !user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId, id } = req.query; // id is campaignId
        const newName = req.body.name;

        if (!brandId || !id) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_CAMPAIGNS);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        const campaign = await getCampaignById(id, brandId);
        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        if (campaign.brand_id && campaign.brand_id !== brandId) { // Check snake_case or camelCase depending on what getCampaignById returns
            // getCampaignById returns raw DB row (snake_case) usually, unless service maps it.
            // campaignsDb.getById returns row.
            // So use campaign.brand_id.
            if (campaign.brand_id !== brandId) return res.status(403).json({ message: 'Mismatch' });
        } else if (campaign.brandId && campaign.brandId !== brandId) {
            if (campaign.brandId !== brandId) return res.status(403).json({ message: 'Mismatch' });
        }

        // Prepare duplication data
        // Convert from source (snake_case likely) to destination (camelCase for createCampaign wrapper?)
        // createCampaign takes object and spreads it + adds keys. 
        // We should format as snake_case if campaignsDb expects it.
        // Let's assume we pass snake_case to createCampaign if campaignsDb just inserts it.

        const duplicatedCampaignData = {
            name: newName || `${campaign.name} (Copy)`,
            subject: campaign.subject,
            content: campaign.content,
            brand_id: brandId, // Direct to DB column 
            user_id: userId,
            from_name: campaign.from_name || brand.fromName || '',
            from_email: campaign.from_email || brand.fromEmail,
            reply_to: campaign.reply_to || brand.replyToEmail,
            status: 'draft',
            tracking_config: campaign.tracking_config || { trackOpens: true, trackClicks: true }
        };

        const newCampaign = await createCampaign(duplicatedCampaignData);

        return res.status(201).json(newCampaign);
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

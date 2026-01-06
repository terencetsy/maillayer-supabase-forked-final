import { getCampaignsByBrandId, getCampaignsCount, createCampaign } from '@/services/campaignService';
import { getBrandById } from '@/services/brandService';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';
import { getUserFromRequest } from '@/lib/supabase';

export default async function handler(req, res) {
    try {
        const { user, error } = await getUserFromRequest(req); // use getUserFromRequest from supabase lib which checks header primarily but here we need generic auth

        // If specific auth requirement (API token or Session)
        // brands/... usually accessed by frontend with session token (cookie or header)
        // getUserFromRequest handles both if implemented correctly (Supabase auth helper).

        if (error || !user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId } = req.query;

        if (!brandId) {
            return res.status(400).json({ message: 'Missing brand ID' });
        }

        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // GET request - get campaigns for a brand
        if (req.method === 'GET') {
            const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.VIEW_CAMPAIGNS);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }
            try {
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;
                const skip = (page - 1) * limit;

                // Pass skip/limit to service
                const campaigns = await getCampaignsByBrandId(brandId, userId, { skip, limit });
                const totalCount = await getCampaignsCount(brandId, userId);

                return res.status(200).json({
                    campaigns,
                    pagination: {
                        page,
                        limit,
                        total: totalCount,
                        totalPages: Math.ceil(totalCount / limit),
                        hasMore: page * limit < totalCount,
                    },
                });
            } catch (error) {
                console.error('Error fetching campaigns:', error);
                return res.status(500).json({ message: 'Error fetching campaigns' });
            }
        }

        // POST request - create new campaign
        if (req.method === 'POST') {
            const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_CAMPAIGNS);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }

            try {
                const { name, subject, content, fromName, fromEmail, replyTo, status, scheduleType, scheduledAt, trackingConfig } = req.body;

                if (!name || !subject) {
                    return res.status(400).json({ message: 'Missing required fields' });
                }

                const campaignData = {
                    name,
                    subject,
                    content: content || '',
                    brandId,
                    userId, // Owner
                    fromName: fromName || brand.fromName || '',
                    fromEmail: fromEmail || brand.fromEmail,
                    replyTo: replyTo || brand.replyToEmail,
                    status: status || 'draft',
                    scheduleType: scheduleType || 'send_now',
                    scheduledAt: scheduledAt || null,
                    trackingConfig: trackingConfig || { trackOpens: true, trackClicks: true },
                };

                const newCampaign = await createCampaign(campaignData);
                return res.status(201).json(newCampaign);
            } catch (error) {
                console.error('Error creating campaign:', error);
                return res.status(500).json({ message: 'Error creating campaign' });
            }
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

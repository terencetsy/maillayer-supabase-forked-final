import { getCampaignById } from '@/services/campaignService';
import { getBrandById } from '@/services/brandService';
import { getCampaignStats, getCampaignEvents } from '@/services/trackingService';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';
import { getUserFromRequest } from '@/lib/supabase';

export default async function handler(req, res) {
    try {
        const { user, error } = await getUserFromRequest(req);
        if (error || !user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId, id } = req.query;

        if (!brandId || !id) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        const brand = await getBrandById(brandId);
        if (!brand) return res.status(404).json({ message: 'Brand not found' });

        const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.VIEW_CAMPAIGNS);
        if (!authCheck.authorized) return res.status(authCheck.status).json({ message: authCheck.message });

        const campaign = await getCampaignById(id, brandId);
        if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

        if (req.method === 'GET') {
            try {
                const { events, page, limit, eventType, email, sort, order } = req.query;

                if (events === 'true') {
                    const eventData = await getCampaignEvents(id, {
                        page: parseInt(page) || 1,
                        limit: parseInt(limit) || 50,
                        eventType,
                        email,
                        sort,
                        order,
                    });
                    return res.status(200).json(eventData);
                } else {
                    const stats = await getCampaignStats(id);
                    return res.status(200).json(stats);
                }
            } catch (error) {
                console.error('Error fetching campaign stats:', error);
                return res.status(500).json({ message: 'Error fetching campaign stats' });
            }
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

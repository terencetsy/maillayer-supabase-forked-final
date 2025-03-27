import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getCampaignById } from '@/services/campaignService';
import { getBrandById } from '@/services/brandService';
import { getCampaignStats, getCampaignEvents } from '@/services/trackingService';

export default async function handler(req, res) {
    try {
        // Connect to database
        await connectToDatabase();

        // Get session directly from server
        const session = await getServerSession(req, res, authOptions);

        if (!session || !session.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = session.user.id;
        const { brandId, id } = req.query;

        if (!brandId || !id) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        // Check if the brand belongs to the user
        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        if (brand.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to access this brand' });
        }

        // Check if campaign exists and belongs to the user
        const campaign = await getCampaignById(id, userId);
        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        if (campaign.brandId.toString() !== brandId) {
            return res.status(403).json({ message: 'Campaign does not belong to this brand' });
        }

        // GET request - get campaign stats
        if (req.method === 'GET') {
            try {
                // Determine what kind of data to fetch
                const { events, page, limit, eventType, email, sort, order } = req.query;

                if (events === 'true') {
                    // Fetch detailed events with pagination
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
                    // Fetch summary stats
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

import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getCampaignsByBrandId, createCampaign } from '@/services/campaignService';
import { getBrandById } from '@/services/brandService';
import { getCampaignStats } from '@/services/trackingService';

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
        const { brandId } = req.query;

        if (!brandId) {
            return res.status(400).json({ message: 'Missing brand ID' });
        }

        // Check if the brand belongs to the user
        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        if (brand.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to access this brand' });
        }

        // GET request - get campaigns for a brand
        if (req.method === 'GET') {
            try {
                // Fetch campaigns
                const campaigns = await getCampaignsByBrandId(brandId, userId);
                // For non-draft campaigns that have been sent, fetch additional stats
                const campaignsWithStats = await Promise.all(
                    campaigns.map(async (campaign) => {
                        if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
                            try {
                                // Get detailed stats for each campaign
                                const stats = await getCampaignStats(campaign._id);
                                console.log('stats', stats);

                                // Calculate open rate
                                const openRate = stats.recipients > 0 ? (((stats.open?.unique || 0) / stats.recipients) * 100).toFixed(1) : 0;

                                // Convert campaign to plain object safely
                                const campaignObject = typeof campaign.toObject === 'function' ? campaign.toObject() : { ...campaign };

                                // Add the additional stats to the campaign object
                                return {
                                    ...campaignObject,
                                    statistics: {
                                        ...stats,
                                        openRate,
                                        unsubscribedCount: stats.unsubscribed?.total || 0,
                                        bouncedCount: stats.bounce?.total || 0,
                                    },
                                };
                            } catch (error) {
                                console.warn(`Error fetching stats for campaign ${campaign._id}:`, error);
                                // Return campaign without stats if there was an error
                                return campaign;
                            }
                        }
                        return campaign;
                    })
                );

                return res.status(200).json(campaignsWithStats);
            } catch (error) {
                console.error('Error fetching campaigns:', error);
                return res.status(500).json({ message: 'Error fetching campaigns' });
            }
        }

        // POST request - create new campaign
        if (req.method === 'POST') {
            try {
                const { name, subject, content, fromName, fromEmail, replyTo, status, scheduleType, scheduledAt } = req.body;

                if (!name || !subject) {
                    return res.status(400).json({ message: 'Missing required fields' });
                }

                const campaignData = {
                    name,
                    subject,
                    content: content || '',
                    brandId,
                    userId,
                    fromName: brand.fromName || '',
                    fromEmail: brand.fromEmail,
                    replyTo: replyTo || brand.replyToEmail,
                    status: status || 'draft',
                    scheduleType: scheduleType || 'send_now',
                    scheduledAt: scheduledAt || null,
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

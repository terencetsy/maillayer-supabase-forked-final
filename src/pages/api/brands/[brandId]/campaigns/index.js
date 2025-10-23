// src/pages/api/brands/[brandId]/campaigns/index.js

import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getCampaignsByBrandId, getCampaignsCount, createCampaign } from '@/services/campaignService';
import { getBrandById } from '@/services/brandService';

export default async function handler(req, res) {
    try {
        await connectToDatabase();

        const session = await getServerSession(req, res, authOptions);

        if (!session || !session.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = session.user.id;
        const { brandId } = req.query;

        if (!brandId) {
            return res.status(400).json({ message: 'Missing brand ID' });
        }

        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        if (brand.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to access this brand' });
        }

        // GET request - get campaigns for a brand with pagination (NO STATS)
        if (req.method === 'GET') {
            try {
                // Parse pagination params
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;
                const skip = (page - 1) * limit;

                // Fetch campaigns with pagination - WITHOUT stats
                const [campaigns, totalCount] = await Promise.all([getCampaignsByBrandId(brandId, userId, { skip, limit }), getCampaignsCount(brandId, userId)]);

                // Return paginated response without fetching live stats
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

import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getCampaignById, updateCampaign, deleteCampaign } from '@/services/campaignService';
import { getBrandById } from '@/services/brandService';

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

        // GET request - get a specific campaign
        if (req.method === 'GET') {
            try {
                const campaign = await getCampaignById(id, userId);

                if (!campaign) {
                    return res.status(404).json({ message: 'Campaign not found' });
                }

                if (campaign.brandId.toString() !== brandId) {
                    return res.status(403).json({ message: 'Campaign does not belong to this brand' });
                }

                return res.status(200).json(campaign);
            } catch (error) {
                console.error('Error fetching campaign:', error);
                return res.status(500).json({ message: 'Error fetching campaign' });
            }
        }

        // PUT request - update a campaign
        if (req.method === 'PUT') {
            try {
                const { name, subject, content, fromName, fromEmail, replyTo, status, scheduleType, scheduledAt, contactListIds } = req.body;

                const campaign = await getCampaignById(id, userId);

                if (!campaign) {
                    return res.status(404).json({ message: 'Campaign not found' });
                }

                if (campaign.brandId.toString() !== brandId) {
                    return res.status(403).json({ message: 'Campaign does not belong to this brand' });
                }

                const updateData = {};

                if (name) updateData.name = name;
                if (subject) updateData.subject = subject;
                if (content !== undefined) updateData.content = content;
                if (fromName) updateData.fromName = fromName;
                if (fromEmail) updateData.fromEmail = fromEmail;
                if (replyTo) updateData.replyTo = replyTo;
                if (status) updateData.status = status;
                if (scheduleType) updateData.scheduleType = scheduleType;
                if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt;
                if (contactListIds) updateData.contactListIds = contactListIds;

                // If the status is changing to 'sending', you might want to trigger your email sending process
                if (status === 'sending' && campaign.status !== 'sending') {
                    // Add your logic to initiate the email sending process
                    // This could be a call to your email service or adding to a queue

                    // For now, we'll just update the campaign status
                    console.log('Campaign is being sent', id);

                    // You might want to update stats here or in your sending process
                    updateData.stats = {
                        ...campaign.stats,
                        recipients: await getRecipientsCount(brandId, contactListIds),
                    };
                }

                const success = await updateCampaign(id, userId, updateData);

                if (success) {
                    return res.status(200).json({ message: 'Campaign updated successfully' });
                } else {
                    return res.status(500).json({ message: 'Failed to update campaign' });
                }
            } catch (error) {
                console.error('Error updating campaign:', error);
                return res.status(500).json({ message: 'Error updating campaign' });
            }
        }

        // Helper function to get total recipients count
        async function getRecipientsCount(brandId, contactListIds) {
            if (!contactListIds || contactListIds.length === 0) return 0;

            const ContactList = mongoose.models.ContactList;
            const lists = await ContactList.find({
                _id: { $in: contactListIds.map((id) => new mongoose.Types.ObjectId(id)) },
                brandId: new mongoose.Types.ObjectId(brandId),
            });

            return lists.reduce((total, list) => total + (list.contactCount || 0), 0);
        }

        // DELETE request - delete a campaign
        if (req.method === 'DELETE') {
            try {
                const campaign = await getCampaignById(id, userId);

                if (!campaign) {
                    return res.status(404).json({ message: 'Campaign not found' });
                }

                if (campaign.brandId.toString() !== brandId) {
                    return res.status(403).json({ message: 'Campaign does not belong to this brand' });
                }

                const success = await deleteCampaign(id, userId);

                if (success) {
                    return res.status(200).json({ message: 'Campaign deleted successfully' });
                } else {
                    return res.status(500).json({ message: 'Failed to delete campaign' });
                }
            } catch (error) {
                console.error('Error deleting campaign:', error);
                return res.status(500).json({ message: 'Error deleting campaign' });
            }
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

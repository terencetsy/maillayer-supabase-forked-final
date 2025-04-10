import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getCampaignById, updateCampaign, deleteCampaign } from '@/services/campaignService';
import { getBrandById } from '@/services/brandService';
import mongoose from 'mongoose'; // Make sure this import is present
import { emailCampaignQueue, schedulerQueue } from '@/lib/queue';

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
                if (contactListIds) updateData.contactListIds = contactListIds;
                // Sending or scheduling functionality
                if (status === 'sending' || status === 'scheduled') {
                    // Check if SES details exist in the brand
                    if (brand.status !== 'active') {
                        return res.status(400).json({ message: 'AWS SES credentials not configured for this brand' });
                    }

                    // Handle scheduled campaigns
                    if (scheduleType === 'schedule' && scheduledAt) {
                        // Set the campaign to scheduled status
                        updateData.status = 'scheduled';
                        updateData.scheduleType = scheduleType;
                        updateData.scheduledAt = new Date(scheduledAt);

                        // Create a delay until the scheduled time
                        const now = new Date();
                        const scheduledTime = new Date(scheduledAt);
                        const delay = Math.max(0, scheduledTime.getTime() - now.getTime());

                        // Add to the scheduler queue
                        await schedulerQueue.add(
                            'process-scheduled-campaign',
                            {
                                campaignId: campaign._id.toString(),
                                brandId: brandId.toString(),
                                userId: userId,
                                contactListIds: contactListIds || campaign.contactListIds,
                                fromName: fromName || campaign.fromName || brand.fromName,
                                fromEmail: fromEmail || campaign.fromEmail || brand.fromEmail,
                                replyTo: replyTo || campaign.replyTo || campaign.fromEmail,
                                subject: subject || campaign.subject,
                            },
                            {
                                delay,
                                jobId: `scheduled-campaign-${campaign._id}-${Date.now()}`,
                                attempts: 3,
                                backoff: {
                                    type: 'exponential',
                                    delay: 5000,
                                },
                                removeOnComplete: false,
                            }
                        );
                    } else if (scheduleType === 'warmup' && warmupConfig) {
                        // Set the campaign status to warmup
                        updateData.status = 'warmup';
                        updateData.scheduleType = 'warmup';

                        // Calculate total stages based on recipient count and configs
                        const totalRecipients = await getActiveRecipientsCount(brandId, contactListIds || campaign.contactListIds);

                        // Prepare warmup configuration
                        const initialBatchSize = warmupConfig.initialBatchSize || 50;
                        const incrementFactor = warmupConfig.incrementFactor || 2;
                        const incrementInterval = warmupConfig.incrementInterval || 24; // hours
                        const maxBatchSize = warmupConfig.maxBatchSize || 10000;

                        // Calculate total stages needed for warmup
                        let currentBatchSize = initialBatchSize;
                        let totalStages = 0;
                        let totalSent = 0;

                        while (totalSent < totalRecipients && currentBatchSize <= maxBatchSize) {
                            totalStages++;
                            totalSent += currentBatchSize;
                            currentBatchSize = Math.min(Math.floor(currentBatchSize * incrementFactor), maxBatchSize);
                        }

                        // Add final stage if needed
                        if (totalSent < totalRecipients) {
                            totalStages++;
                        }

                        // Set warmup configuration
                        const warmupStartDate = warmupConfig.warmupStartDate ? new Date(warmupConfig.warmupStartDate) : new Date();

                        updateData.warmupConfig = {
                            initialBatchSize,
                            incrementFactor,
                            incrementInterval,
                            maxBatchSize,
                            warmupStartDate,
                            currentWarmupStage: 0,
                            totalStages,
                            completedBatches: 0,
                            lastBatchSentAt: null,
                        };

                        // Calculate the first batch size (initial batch)
                        const firstBatchSize = Math.min(initialBatchSize, totalRecipients);

                        // Schedule the first batch
                        await schedulerQueue.add(
                            'process-warmup-batch',
                            {
                                campaignId: campaign._id.toString(),
                                brandId: brandId.toString(),
                                userId: userId,
                                contactListIds: (contactListIds || campaign.contactListIds).map((id) => id.toString()),
                                fromName: fromName || campaign.fromName || brand.fromName,
                                fromEmail: fromEmail || campaign.fromEmail || brand.fromEmail,
                                replyTo: replyTo || campaign.replyTo || campaign.fromEmail,
                                subject: subject || campaign.subject,
                                batchSize: firstBatchSize,
                                warmupStage: 0,
                            },
                            {
                                delay: warmupStartDate.getTime() - Date.now(), // Delay until start date
                                jobId: `warmup-campaign-${campaign._id}-batch-0-${Date.now()}`,
                                attempts: 3,
                                backoff: {
                                    type: 'exponential',
                                    delay: 5000,
                                },
                                removeOnComplete: false,
                            }
                        );

                        // Update total recipients
                        updateData.totalRecipients = totalRecipients;

                        // Initialize stats if needed
                        updateData.stats = {
                            ...campaign.stats,
                            recipients: totalRecipients,
                            processed: 0,
                        };
                    }

                    // Handle immediate sending
                    else if (status === 'sending') {
                        // Update status to queued
                        updateData.status = 'queued';
                        updateData.sentAt = new Date();

                        // Add to processing queue with comprehensive data
                        await emailCampaignQueue.add(
                            'send-campaign',
                            {
                                campaignId: campaign._id.toString(),
                                brandId: brandId.toString(),
                                userId: userId,
                                contactListIds: (contactListIds || campaign.contactListIds).map((id) => id.toString()),
                                fromName: fromName || campaign.fromName || brand.fromName,
                                fromEmail: fromEmail || campaign.fromEmail || brand.fromEmail,
                                replyTo: replyTo || campaign.replyTo || campaign.fromEmail,
                                subject: subject || campaign.subject,
                            },
                            {
                                jobId: `campaign-${campaign._id}-${Date.now()}`,
                                attempts: 3,
                                backoff: {
                                    type: 'exponential',
                                    delay: 5000,
                                },
                                removeOnComplete: false,
                            }
                        );
                        updateData.totalRecipients = await getActiveRecipientsCount(brandId, contactListIds || campaign.contactListIds);
                        // Update stats with recipient count
                        updateData.stats = {
                            ...campaign.stats,
                        };
                    }
                } else if (status) {
                    // For other status updates that aren't sending or scheduling
                    updateData.status = status;
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
        async function getActiveRecipientsCount(brandId, contactListIds) {
            if (!contactListIds || contactListIds.length === 0) return 0;

            const Contact = mongoose.models.Contact;

            // Count only active contacts across all selected lists
            const activeCount = await Contact.countDocuments({
                listId: { $in: contactListIds.map((id) => new mongoose.Types.ObjectId(id)) },
                brandId: new mongoose.Types.ObjectId(brandId),
                status: 'active', // Only count active contacts
            });

            return activeCount;
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

                if (campaign.status !== 'draft') {
                    return res.status(400).json({ message: 'Only draft campaigns can be deleted' });
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

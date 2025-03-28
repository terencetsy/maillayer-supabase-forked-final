// workers/campaign-manager.js
require('dotenv').config();
const mongoose = require('mongoose');
const Bull = require('bull');
const Redis = require('ioredis');

// Get Redis URL - ONLY use the Redis URL, no fallback to individual components
function getRedisUrl() {
    return process.env.REDIS_URL || 'redis://localhost:6379';
}

// Use the Redis URL directly
const redisUrl = getRedisUrl();
console.log('Campaign manager using Redis URL:', redisUrl);

// Create Redis clients for Bull with proper error handling
const createRedisClient = () => {
    const redisClient = new Redis(redisUrl);

    redisClient.on('error', (err) => {
        console.error('Campaign manager Redis client error:', err);
    });

    redisClient.on('connect', () => {
        console.log('Campaign manager Redis client connected');
    });

    return redisClient;
};

// Connect to Bull queues using the client creation function
const emailCampaignQueue = new Bull('email-campaigns', {
    createClient: (type) => createRedisClient(),
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
    },
});

// Connect to MongoDB
async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Manager connected to MongoDB');

        // Define Campaign schema for this worker
        const CampaignSchema = new mongoose.Schema({
            name: String,
            subject: String,
            status: String,
            processingMetadata: {
                lastProcessedContactIndex: Number,
                lastProcessedListIndex: Number,
                hasMoreToProcess: Boolean,
            },
        });

        // Register model
        global.Campaign = mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

// Resume a failed or paused campaign
async function resumeCampaign(campaignId) {
    try {
        const Campaign = mongoose.model('Campaign');
        const campaign = await Campaign.findById(campaignId);

        if (!campaign) {
            throw new Error('Campaign not found');
        }

        if (!['failed', 'paused'].includes(campaign.status)) {
            throw new Error(`Cannot resume campaign with status: ${campaign.status}`);
        }

        // Update campaign status to 'queued'
        campaign.status = 'queued';
        await campaign.save();

        // Add job to resume the campaign
        // We'll fetch contact lists, brand, etc. again in the worker
        const jobId = `resume-campaign-${campaignId}-${Date.now()}`;
        await emailCampaignQueue.add(
            'send-campaign',
            { campaignId: campaignId.toString() },
            {
                jobId,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
            }
        );

        return { success: true, jobId, message: 'Campaign queued for resuming' };
    } catch (error) {
        console.error(`Error resuming campaign ${campaignId}:`, error);
        throw error;
    }
}

// Handle incoming messages from parent process
process.on('message', async (message) => {
    // First connect to the database
    await connectToDatabase();

    if (message.type === 'resume-campaign' && message.campaignId) {
        try {
            const result = await resumeCampaign(message.campaignId);
            process.send({
                type: 'resume-result',
                success: true,
                campaignId: message.campaignId,
                result,
            });
        } catch (error) {
            process.send({
                type: 'resume-result',
                success: false,
                campaignId: message.campaignId,
                error: error.message,
            });
        }
    } else if (message.type === 'pause-campaign' && message.campaignId) {
        try {
            const Campaign = mongoose.model('Campaign');
            const campaign = await Campaign.findById(message.campaignId);

            if (!campaign) {
                throw new Error('Campaign not found');
            }

            if (campaign.status !== 'sending') {
                throw new Error(`Cannot pause campaign with status: ${campaign.status}`);
            }

            campaign.status = 'paused';
            await campaign.save();

            // Note: Bull doesn't directly support pausing a specific job
            // In a real implementation, you might:
            // 1. Find active campaign jobs for this campaign ID
            // 2. Try to gracefully stop them by setting a flag in Redis
            // 3. The worker process would check this flag periodically

            process.send({
                type: 'pause-result',
                success: true,
                campaignId: message.campaignId,
            });
        } catch (error) {
            process.send({
                type: 'pause-result',
                success: false,
                campaignId: message.campaignId,
                error: error.message,
            });
        }
    } else {
        process.send({
            type: 'error',
            message: 'Invalid command',
        });
    }
});

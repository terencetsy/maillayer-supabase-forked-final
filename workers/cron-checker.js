// workers/cron-checker.js
require('dotenv').config();
const Bull = require('bull');
const mongoose = require('mongoose');
const cron = require('node-cron');
const Redis = require('ioredis');

// Get Redis URL - ONLY use the Redis URL, no fallback to individual components
function getRedisUrl() {
    return process.env.REDIS_URL || 'redis://localhost:6379';
}

// Use the Redis URL directly
const redisUrl = getRedisUrl();
console.log('Cron checker using Redis URL:', redisUrl);

// Create Redis clients for Bull with proper error handling
const createRedisClient = () => {
    const redisClient = new Redis(redisUrl);

    redisClient.on('error', (err) => {
        console.error('Cron checker Redis client error:', err);
    });

    redisClient.on('connect', () => {
        console.log('Cron checker Redis client connected');
    });

    return redisClient;
};

// Create scheduler queue using the client creation function
const schedulerQueue = new Bull('campaign-scheduler', {
    createClient: (type) => createRedisClient(),
    defaultJobOptions: {
        removeOnComplete: true,
    },
});

// We need to define schemas here because the models in src/models use ES Module syntax
// which isn't compatible with CommonJS require() without special configuration
const CampaignSchema = new mongoose.Schema(
    {
        name: String,
        subject: String,
        content: String,
        brandId: mongoose.Schema.Types.ObjectId,
        userId: mongoose.Schema.Types.ObjectId,
        fromName: String,
        fromEmail: String,
        replyTo: String,
        status: {
            type: String,
            enum: ['draft', 'queued', 'scheduled', 'sending', 'sent', 'failed', 'paused'],
            default: 'draft',
        },
        contactListIds: [mongoose.Schema.Types.ObjectId],
        scheduleType: String,
        scheduledAt: Date,
        sentAt: Date,
        stats: {
            recipients: { type: Number, default: 0 },
            opens: { type: Number, default: 0 },
            clicks: { type: Number, default: 0 },
            bounces: { type: Number, default: 0 },
            complaints: { type: Number, default: 0 },
        },
    },
    {
        collection: 'campaigns', // Explicitly specify collection name
    }
);

const BrandSchema = new mongoose.Schema(
    {
        name: String,
        website: String,
        userId: mongoose.Schema.Types.ObjectId,
        awsRegion: String,
        awsAccessKey: String,
        awsSecretKey: String,
        sendingDomain: String,
        fromName: String,
        fromEmail: String,
        replyToEmail: String,
        status: {
            type: String,
            enum: ['active', 'inactive', 'pending_setup', 'pending_verification'],
            default: 'pending_setup',
        },
    },
    {
        collection: 'brands', // Explicitly specify collection name
    }
);

// Initialize models
let Campaign;
let Brand;

// Connect to MongoDB
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected');

        // Initialize models
        Campaign = mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema);
        Brand = mongoose.models.Brand || mongoose.model('Brand', BrandSchema);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

// Check for campaigns that should have been processed but weren't
async function checkScheduledCampaigns() {
    try {
        console.log('Checking for missed scheduled campaigns...');

        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

        // Find campaigns that should have been sent by now but still have 'scheduled' status
        const missedCampaigns = await Campaign.find({
            status: 'scheduled',
            scheduledAt: { $lt: now, $gt: fiveMinutesAgo },
        });

        console.log(`Found ${missedCampaigns.length} missed campaigns`);

        // Process each missed campaign
        for (const campaign of missedCampaigns) {
            console.log(`Scheduling missed campaign ${campaign._id}`);

            // Get the brand for this campaign to access SES credentials
            const brand = await Brand.findById(campaign.brandId);
            if (!brand) {
                console.error(`Brand not found for campaign ${campaign._id}`);
                continue;
            }

            // Validate brand credentials before scheduling
            if (!brand.awsRegion || !brand.awsAccessKey || !brand.awsSecretKey) {
                console.error(`AWS SES credentials not configured for brand ${brand._id}`);
                continue;
            }

            // Add to scheduler queue with minimal delay
            await schedulerQueue.add(
                'process-scheduled-campaign',
                {
                    campaignId: campaign._id.toString(),
                    brandId: campaign.brandId.toString(),
                    userId: campaign.userId.toString(),
                    contactListIds: campaign.contactListIds.map((id) => id.toString()),
                    fromName: campaign.fromName || brand.fromName,
                    fromEmail: campaign.fromEmail || brand.fromEmail,
                    replyTo: campaign.replyTo || brand.replyToEmail,
                    subject: campaign.subject,
                    // Pass AWS credentials from the brand
                    brandAwsRegion: brand.awsRegion,
                    brandAwsAccessKey: brand.awsAccessKey,
                    brandAwsSecretKey: brand.awsSecretKey,
                },
                {
                    jobId: `missed-campaign-${campaign._id}-${Date.now()}`,
                    delay: 1000, // 1 second delay to prevent immediate processing
                }
            );

            // Update campaign status to 'queued'
            campaign.status = 'queued';
            await campaign.save();

            console.log(`Campaign ${campaign._id} queued for processing`);
        }

        console.log('Finished checking for missed campaigns');
    } catch (error) {
        console.error('Error checking for missed campaigns:', error);
    }
}

// Start the cron job to run every 5 minutes
connectDB()
    .then(() => {
        console.log('Scheduler checker started');

        // Schedule the check to run every 5 minutes
        cron.schedule('*/5 * * * *', checkScheduledCampaigns);

        // Run an initial check at startup
        checkScheduledCampaigns();
    })
    .catch((error) => {
        console.error('Failed to start scheduler checker:', error);
        process.exit(1);
    });

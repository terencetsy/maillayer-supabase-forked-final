// workers/cron-checker.js
require('dotenv').config();
const Bull = require('bull');
const mongoose = require('mongoose');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

// Setup Redis connection for Bull
const redisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
};

// Create scheduler queue
const schedulerQueue = new Bull('campaign-scheduler', {
    redis: redisOptions,
    defaultJobOptions: {
        removeOnComplete: true,
    },
});

// Connect to MongoDB
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected');

        // Define campaign schema
        const CampaignSchema = new mongoose.Schema({
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
                enum: ['draft', 'queued', 'scheduled', 'sending', 'sent', 'failed'],
                default: 'draft',
            },
            contactListIds: [mongoose.Schema.Types.ObjectId],
            scheduleType: String,
            scheduledAt: Date,
            sentAt: Date,
        });

        // Register model
        Campaign = mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

// Complete checkScheduledCampaigns function for cron-checker.js
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
            const brand = await mongoose.models.Brand.findById(campaign.brandId);
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
                    fromName: campaign.fromName,
                    fromEmail: campaign.fromEmail,
                    replyTo: campaign.replyTo || campaign.fromEmail,
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

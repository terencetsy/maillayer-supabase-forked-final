// workers/email-processor-with-tracking.js
require('dotenv').config();
const Bull = require('bull');
const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const path = require('path');
const crypto = require('crypto');
const { RateLimiter } = require('limiter');
const cheerio = require('cheerio');
const config = require('../src/lib/configCommonJS');

// Setup Redis connection for Bull
const redisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
};

// Create queues
const emailCampaignQueue = new Bull('email-campaigns', {
    redis: redisOptions,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
        timeout: 3600000, // 1 hour timeout for processing
    },
});

const schedulerQueue = new Bull('campaign-scheduler', {
    redis: redisOptions,
    defaultJobOptions: {
        removeOnComplete: true,
    },
});

// These variables will hold our models after connecting to MongoDB
let Campaign;
let Contact;
let Brand;

function generateTrackingToken(campaignId, contactId, email) {
    // Create a string to hash
    const dataToHash = `${campaignId}:${contactId}:${email}:${process.env.TRACKING_SECRET || 'tracking-secret-key'}`;

    // Generate SHA-256 hash
    return crypto.createHash('sha256').update(dataToHash).digest('hex');
}

function processHtml(html, campaignId, contactId, email, trackingDomain = '') {
    // Fallback to using the API routes if tracking domain is not provided
    const domain = trackingDomain || process.env.TRACKING_DOMAIN || '';

    // Generate tracking token
    const token = generateTrackingToken(campaignId, contactId, email);

    // Base tracking parameters
    const trackingParams = `cid=${encodeURIComponent(campaignId)}&lid=${encodeURIComponent(contactId)}&e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`;

    // Parse HTML
    const $ = cheerio.load(html);

    // Process all links to add click tracking
    $('a').each(function () {
        const originalUrl = $(this).attr('href');
        if (originalUrl && !originalUrl.startsWith('mailto:') && !originalUrl.startsWith('#')) {
            const trackingUrl = `${domain}/api/tracking/click?${trackingParams}&url=${encodeURIComponent(originalUrl)}`;
            $(this).attr('href', trackingUrl);
        }
    });

    // Add tracking pixel at the end of the email
    const trackingPixel = `<img src="${domain}/api/tracking/open?${trackingParams}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;" />`;
    $('body').append(trackingPixel);

    // Return the modified HTML
    return $.html();
}

function extractTextFromHtml(html) {
    if (!html) return '';

    // Use cheerio to remove scripts, styles, and extract text
    const $ = cheerio.load(html);

    // Remove scripts and styles
    $('script, style').remove();

    // Get the text content
    let text = $('body').text();

    // Clean up white space
    text = text.replace(/\s+/g, ' ').trim();

    return text;
}

// Define schema for campaign-specific stats collections
const TrackingEventSchema = new mongoose.Schema(
    {
        contactId: mongoose.Schema.Types.ObjectId,
        campaignId: mongoose.Schema.Types.ObjectId,
        email: String,
        userAgent: String,
        ipAddress: String,
        timestamp: {
            type: Date,
            default: Date.now,
        },
        eventType: {
            type: String,
            enum: ['open', 'click', 'bounce', 'complaint', 'delivery'],
        },
        metadata: mongoose.Schema.Types.Mixed,
    },
    {
        timestamps: true,
    }
);

// Function to create or get model for campaign-specific stats
function createTrackingModel(campaignId) {
    const collectionName = `stats_${campaignId}`;
    return mongoose.models[collectionName] || mongoose.model(collectionName, TrackingEventSchema, collectionName);
}

// Connect to MongoDB
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected');

        // Define schemas
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
                    processed: { type: Number, default: 0 },
                },
                processingMetadata: {
                    lastProcessedContactIndex: { type: Number, default: 0 },
                    lastProcessedListIndex: { type: Number, default: 0 },
                    hasMoreToProcess: { type: Boolean, default: true },
                    processingStartedAt: Date,
                    processedBatches: { type: Number, default: 0 },
                },
            },
            {
                collection: 'campaigns',
            }
        );

        const ContactSchema = new mongoose.Schema(
            {
                email: String,
                firstName: String,
                lastName: String,
                phone: String,
                listId: mongoose.Schema.Types.ObjectId,
                brandId: mongoose.Schema.Types.ObjectId,
                userId: mongoose.Schema.Types.ObjectId,
                status: {
                    type: String,
                    default: 'active',
                },
            },
            {
                collection: 'contacts',
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
                collection: 'brands',
            }
        );

        // Initialize models - make sure they're properly initialized before using them
        Campaign = mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema);
        Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);
        Brand = mongoose.models.Brand || mongoose.model('Brand', BrandSchema);

        // Make sure models are defined
        console.log('Models initialized:', {
            Campaign: !!Campaign,
            Contact: !!Contact,
            Brand: !!Brand,
        });
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

// SES utility functions
function decryptData(encryptedText, secretKey) {
    try {
        if (!encryptedText) return null;

        // If it's not encrypted or contains ":", just return it as is
        if (!encryptedText.includes(':')) {
            return encryptedText;
        }

        const key = crypto.scryptSync(secretKey || process.env.ENCRYPTION_KEY || 'default-fallback-key', 'salt', 32);

        // Split the IV and encrypted content
        const parts = encryptedText.split(':');
        if (parts.length !== 2) {
            return encryptedText;
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = Buffer.from(parts[1], 'hex');

        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        return encryptedText;
    }
}

// Process campaigns from the scheduler queue (scheduled for future)
schedulerQueue.process('process-scheduled-campaign', async (job) => {
    try {
        const { campaignId, brandId, userId, contactListIds, fromName, fromEmail, replyTo, subject } = job.data;
        console.log(`Processing scheduled campaign ${campaignId}`);

        // Find the campaign
        const campaign = await Campaign.findById(campaignId);

        if (!campaign) {
            throw new Error(`Campaign not found: ${campaignId}`);
        }

        // Update status to queued
        campaign.status = 'queued';
        await campaign.save();

        job.progress(10);

        // Get brand info
        const brand = await Brand.findById(brandId);
        if (!brand) {
            throw new Error(`Brand not found: ${brandId}`);
        }

        // Add the campaign to the processing queue
        await emailCampaignQueue.add(
            'send-campaign',
            {
                campaignId,
                brandId,
                userId,
                contactListIds: Array.isArray(contactListIds) ? contactListIds : campaign.contactListIds,
                fromName: fromName || campaign.fromName || brand.fromName,
                fromEmail: fromEmail || campaign.fromEmail || brand.fromEmail,
                replyTo: replyTo || campaign.replyTo || brand.replyToEmail,
                subject: subject || campaign.subject,
                brandAwsRegion: brand.awsRegion,
                brandAwsAccessKey: brand.awsAccessKey,
                brandAwsSecretKey: brand.awsSecretKey,
            },
            {
                jobId: `campaign-${campaignId}-${Date.now()}`,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
                removeOnComplete: false,
            }
        );

        job.progress(100);

        return { success: true, message: 'Scheduled campaign moved to processing queue' };
    } catch (error) {
        console.error('Error processing scheduled campaign:', error);
        throw error;
    }
});

// Handle SES bounce and complaint notifications
async function handleSESNotification(notification) {
    if (!notification || !notification.notificationType) {
        return;
    }

    console.log('Received SES notification:', notification.notificationType);

    try {
        switch (notification.notificationType) {
            case 'Bounce': {
                const { bounce } = notification;
                if (!bounce || !bounce.bouncedRecipients) {
                    return;
                }

                // Process each bounced recipient
                for (const recipient of bounce.bouncedRecipients) {
                    if (!recipient.emailAddress) continue;

                    // Find campaigns that were sent to this email
                    const contacts = await Contact.find({ email: recipient.emailAddress });

                    for (const contact of contacts) {
                        // Use regex to find campaign ID in message ID
                        const campaignMatches = bounce.bounceSubType && bounce.bounceSubType.match(/campaign-([a-f0-9]+)/i);
                        if (campaignMatches && campaignMatches[1]) {
                            const campaignId = campaignMatches[1];

                            // Track the bounce event
                            const TrackingModel = createTrackingModel(campaignId);
                            await TrackingModel.create({
                                contactId: contact._id,
                                campaignId,
                                email: recipient.emailAddress,
                                eventType: 'bounce',
                                metadata: {
                                    bounceType: bounce.bounceType,
                                    bounceSubType: bounce.bounceSubType,
                                    diagnosticCode: recipient.diagnosticCode,
                                },
                            });

                            // Update campaign stats
                            await Campaign.updateOne({ _id: campaignId }, { $inc: { 'stats.bounces': 1 } });
                        }
                    }
                }
                break;
            }

            case 'Complaint': {
                const { complaint } = notification;
                if (!complaint || !complaint.complainedRecipients) {
                    return;
                }

                // Similar process for complaints
                for (const recipient of complaint.complainedRecipients) {
                    if (!recipient.emailAddress) continue;

                    const contacts = await Contact.find({ email: recipient.emailAddress });

                    for (const contact of contacts) {
                        // Use regex to find campaign ID in message ID
                        const campaignMatches = complaint.complaintSubType && complaint.complaintSubType.match(/campaign-([a-f0-9]+)/i);
                        if (campaignMatches && campaignMatches[1]) {
                            const campaignId = campaignMatches[1];

                            // Track the complaint event
                            const TrackingModel = createTrackingModel(campaignId);
                            await TrackingModel.create({
                                contactId: contact._id,
                                campaignId,
                                email: recipient.emailAddress,
                                eventType: 'complaint',
                                metadata: {
                                    userAgent: complaint.userAgent,
                                    complaintFeedbackType: complaint.complaintFeedbackType,
                                },
                            });

                            // Update campaign stats
                            await Campaign.updateOne({ _id: campaignId }, { $inc: { 'stats.complaints': 1 } });
                        }
                    }
                }
                break;
            }
        }
    } catch (error) {
        console.error('Error processing SES notification:', error);
    }
}

// Complete send-campaign handler with email tracking
emailCampaignQueue.process('send-campaign', async (job) => {
    const { campaignId, brandId, userId, contactListIds, fromName, fromEmail, replyTo, subject, brandAwsRegion, brandAwsAccessKey, brandAwsSecretKey } = job.data;

    try {
        console.log(`Starting to process campaign: ${campaignId}`);

        // Get campaign details - make sure Campaign model is defined
        if (!Campaign) {
            throw new Error('Campaign model is not initialized');
        }

        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            throw new Error(`Campaign not found: ${campaignId}`);
        }

        job.progress(5);

        // Update status to sending and initialize processing metadata
        campaign.status = 'sending';
        campaign.processingMetadata = {
            lastProcessedContactIndex: 0,
            lastProcessedListIndex: 0,
            hasMoreToProcess: true,
            processingStartedAt: new Date(),
            processedBatches: 0,
        };
        await campaign.save();

        job.progress(10);

        // Get brand
        if (!Brand) {
            throw new Error('Brand model is not initialized');
        }

        const brand = await Brand.findById(brandId);
        if (!brand) {
            throw new Error(`Brand not found: ${brandId}`);
        }

        // Check if brand has SES credentials
        if (!brand.awsRegion || !brand.awsAccessKey || !brand.awsSecretKey) {
            throw new Error('AWS SES credentials not configured for this brand');
        }

        // Create SES client using brand credentials directly
        const ses = new AWS.SES({
            accessKeyId: brandAwsAccessKey || brand.awsAccessKey,
            secretAccessKey: decryptData(brandAwsSecretKey || brand.awsSecretKey, process.env.ENCRYPTION_KEY),
            region: brandAwsRegion || brand.awsRegion || 'us-east-1',
        });

        job.progress(15);

        // Create tracking model for this campaign
        // This ensures the collection exists before we start sending emails
        createTrackingModel(campaignId);

        // Define tracking domain for links and pixels
        const trackingDomain = config.trackingDomain;

        // Check quota and verify connection
        try {
            const quotaResponse = await ses.getSendQuota().promise();

            // Calculate remaining quota
            const remainingQuota = quotaResponse.Max24HourSend - quotaResponse.SentLast24Hours;
            console.log(`SES Quota - Max: ${quotaResponse.Max24HourSend}, Used: ${quotaResponse.SentLast24Hours}, Remaining: ${remainingQuota}`);

            // Get an estimate of contacts to be processed
            if (!Contact) {
                throw new Error('Contact model is not initialized');
            }

            let totalContactsEstimate = 0;
            for (const listId of contactListIds) {
                const count = await Contact.countDocuments({
                    listId: listId,
                });
                totalContactsEstimate += count;
            }

            if (totalContactsEstimate > remainingQuota) {
                console.warn(`Campaign has ${totalContactsEstimate} contacts but only ${remainingQuota} remaining in quota`);
            }

            // Store the max send rate for rate limiting
            const maxSendRate = quotaResponse.MaxSendRate || 10; // Default SES rate limit is 10/sec

            job.progress(20);

            // Calculate optimal batch size based on SES send rate
            const BATCH_SIZE = Math.max(10, Math.min(100, maxSendRate * 2)); // 2x the sending rate, min 10, max 100
            console.log(`Using batch size of ${BATCH_SIZE} emails per batch`);

            // Process each contact list
            for (let listIndex = 0; listIndex < contactListIds.length; listIndex++) {
                const listId = contactListIds[listIndex];

                // Skip already processed lists based on metadata
                if (listIndex < campaign.processingMetadata.lastProcessedListIndex) {
                    console.log(`Skipping list ${listId} (already processed)`);
                    continue;
                }

                // Get contacts from this list
                const totalContacts = await Contact.countDocuments({
                    listId: listId,
                });

                console.log(`Processing list ${listId} with ${totalContacts} contacts`);

                // Process in chunks to avoid loading all contacts into memory
                const CHUNK_SIZE = 1000; // Process 1000 contacts at a time from DB
                let startIndex = 0;

                // If this is the list we were processing before, start from lastProcessedContactIndex
                if (listIndex === campaign.processingMetadata.lastProcessedListIndex) {
                    startIndex = campaign.processingMetadata.lastProcessedContactIndex;
                }

                while (startIndex < totalContacts) {
                    // Load a chunk of contacts
                    const contacts = await Contact.find({
                        listId: listId,
                    })
                        .sort({ _id: 1 }) // Ensure consistent ordering
                        .skip(startIndex)
                        .limit(CHUNK_SIZE);

                    if (contacts.length === 0) break;

                    // Process contacts in batches
                    for (let batchStart = 0; batchStart < contacts.length; batchStart += BATCH_SIZE) {
                        const batchContacts = contacts.slice(batchStart, batchStart + BATCH_SIZE);

                        // Update campaign metadata before processing the batch
                        campaign.processingMetadata.lastProcessedListIndex = listIndex;
                        campaign.processingMetadata.lastProcessedContactIndex = startIndex + batchStart;
                        await campaign.save();

                        // Create a rate limiter for this batch
                        const limiter = new RateLimiter({ tokensPerInterval: maxSendRate, interval: 'second' });

                        let successCount = 0;
                        let failureCount = 0;

                        // Track successful deliveries for the tracking collection
                        const deliveryEvents = [];

                        // Process each contact in batch
                        for (const contact of batchContacts) {
                            // Wait for rate limiter token
                            await limiter.removeTokens(1);

                            try {
                                // Add tracking to HTML content
                                const processedHtml = processHtml(campaign.content || '<p>Empty campaign content</p>', campaignId.toString(), contact._id.toString(), contact.email, trackingDomain);

                                // Extract plain text for text-only clients
                                const textContent = extractTextFromHtml(processedHtml);

                                // Send the email to this contact
                                const result = await ses
                                    .sendEmail({
                                        Source: `${fromName} <${fromEmail}>`,
                                        Destination: {
                                            ToAddresses: [contact.firstName ? `${contact.firstName} ${contact.lastName || ''} <${contact.email}>`.trim() : contact.email],
                                        },
                                        Message: {
                                            Subject: {
                                                Data: subject || campaign.subject,
                                            },
                                            Body: {
                                                Html: {
                                                    Data: processedHtml,
                                                },
                                                Text: {
                                                    Data: textContent || 'Empty campaign content',
                                                },
                                            },
                                        },
                                        ReplyToAddresses: [replyTo || fromEmail],
                                        // Configure feedback notifications
                                        ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined,
                                    })
                                    .promise();

                                // Add delivery event to be tracked
                                deliveryEvents.push({
                                    contactId: contact._id,
                                    campaignId: campaignId,
                                    email: contact.email,
                                    eventType: 'delivery',
                                    metadata: {
                                        messageId: result.MessageId,
                                    },
                                });

                                successCount++;
                            } catch (error) {
                                console.error(`Failed to send to ${contact.email}:`, error.message);
                                failureCount++;
                            }
                        }

                        // Log delivery events in bulk to campaign-specific collection
                        if (deliveryEvents.length > 0) {
                            try {
                                const TrackingModel = createTrackingModel(campaignId);
                                await TrackingModel.insertMany(deliveryEvents);
                            } catch (error) {
                                console.error('Error saving delivery events:', error);
                            }
                        }

                        // Update campaign stats for this batch
                        await Campaign.updateOne(
                            { _id: campaignId },
                            {
                                $inc: {
                                    'stats.processed': batchContacts.length,
                                    'stats.recipients': successCount,
                                    'stats.bounces': failureCount,
                                    'processingMetadata.processedBatches': 1,
                                },
                            }
                        );

                        // Report progress
                        const estimatedProgress = Math.min(95, 20 + (listIndex / contactListIds.length + (startIndex + batchStart + batchContacts.length) / totalContacts / contactListIds.length) * 80);

                        job.progress(Math.floor(estimatedProgress));
                    }

                    startIndex += CHUNK_SIZE;
                }

                // Update that we've completed this list
                campaign.processingMetadata.lastProcessedListIndex = listIndex + 1;
                campaign.processingMetadata.lastProcessedContactIndex = 0;
                await campaign.save();
            }

            job.progress(95);

            // Complete the campaign
            campaign.status = 'sent';
            campaign.sentAt = new Date();
            campaign.processingMetadata.hasMoreToProcess = false;
            await campaign.save();

            job.progress(100);

            console.log(`Campaign ${campaignId} completed successfully`);

            return {
                campaignId,
                status: 'completed',
                totalContacts: totalContactsEstimate,
                processed: campaign.stats.processed,
                sent: campaign.stats.recipients,
                failed: campaign.stats.bounces,
            };
        } catch (quotaError) {
            console.error('Error with SES service:', quotaError);
            throw new Error(`AWS SES error: ${quotaError.message}`);
        }
    } catch (error) {
        console.error(`Error processing campaign ${campaignId}:`, error);

        // Update campaign status to failed
        if (campaignId && Campaign) {
            try {
                const campaign = await Campaign.findById(campaignId);
                if (campaign) {
                    campaign.status = 'failed';
                    campaign.processingMetadata = campaign.processingMetadata || {};
                    campaign.processingMetadata.hasMoreToProcess = true; // Mark that it can be resumed
                    await campaign.save();
                }
            } catch (updateError) {
                console.error('Error updating campaign status to failed:', updateError);
            }
        }

        throw error;
    }
});

// Add a cleanup routine that runs periodically
async function cleanupOldJobs() {
    try {
        // Remove old completed jobs (older than 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        await emailCampaignQueue.clean(sevenDaysAgo.getTime(), 'completed');
        await schedulerQueue.clean(sevenDaysAgo.getTime(), 'completed');

        // Keep failed jobs longer for debugging (30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        await emailCampaignQueue.clean(thirtyDaysAgo.getTime(), 'failed');
        await schedulerQueue.clean(thirtyDaysAgo.getTime(), 'failed');

        console.log('Cleaned up old jobs');
    } catch (error) {
        console.error('Error cleaning up jobs:', error);
    }
}

// Handle queue events
emailCampaignQueue.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed with result:`, result);
});

emailCampaignQueue.on('failed', (job, error) => {
    console.error(`Job ${job.id} failed with error:`, error);
});

schedulerQueue.on('completed', (job, result) => {
    console.log(`Scheduler job ${job.id} completed with result:`, result);
});

schedulerQueue.on('failed', (job, error) => {
    console.error(`Scheduler job ${job.id} failed with error:`, error);
});

// Run cleanup once a day
setInterval(cleanupOldJobs, 24 * 60 * 60 * 1000);

// Connect to DB and start worker
connectDB()
    .then(() => {
        console.log('Email campaign worker with tracking started and ready to process jobs');
    })
    .catch((error) => {
        console.error('Failed to start worker:', error);
        process.exit(1);
    });

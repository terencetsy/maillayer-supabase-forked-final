// workers/email-processor.js
require('dotenv').config({ path: '.env.local' });
const Bull = require('bull');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { RateLimiter } = require('limiter');
const cheerio = require('cheerio');
const Redis = require('ioredis');
const { SESClient, SendRawEmailCommand, GetSendQuotaCommand } = require('@aws-sdk/client-ses');

// Load our CommonJS compatible config
const config = require('../src/lib/configCommonJS');
const { generateUnsubscribeToken } = require('../src/lib/tokenUtils');
const ProviderFactory = require('../src/lib/email-providers/ProviderFactory');

// Define all the models we need directly in this file for worker use
// This ensures they are available when we process jobs
function defineModels() {
    // Brand schema
    const BrandSchema = new mongoose.Schema(
        {
            name: {
                type: String,
                required: [true, 'Brand name is required'],
                trim: true,
            },
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: [true, 'User ID is required'],
            },
            website: {
                type: String,
                required: [true, 'Brand website is required'],
                trim: true,
            },
            awsRegion: {
                type: String,
                trim: true,
            },
            awsAccessKey: {
                type: String,
                trim: true,
            },
            awsSecretKey: {
                type: String,
                trim: true,
            },
            sendingDomain: {
                type: String,
                trim: true,
            },
            fromName: {
                type: String,
                trim: true,
                default: '',
            },
            fromEmail: {
                type: String,
                trim: true,
            },
            replyToEmail: {
                type: String,
                trim: true,
            },
            status: {
                type: String,
                enum: ['active', 'inactive', 'pending_setup', 'pending_verification'],
                default: 'pending_setup',
            },
            // Email Provider Configuration
            emailProvider: {
                type: String,
                enum: ['ses', 'sendgrid', 'mailgun'],
                default: 'ses',
            },
            emailProviderConnectionType: {
                type: String,
                enum: ['api', 'smtp'],
                default: 'api',
            },
            // SendGrid Configuration
            sendgridApiKey: {
                type: String,
                trim: true,
            },
            // Mailgun Configuration
            mailgunApiKey: {
                type: String,
                trim: true,
            },
            mailgunDomain: {
                type: String,
                trim: true,
            },
            mailgunRegion: {
                type: String,
                enum: ['us', 'eu'],
                default: 'us',
            },
            sesConfigurationSet: {
                type: String,
                trim: true,
            },
        },
        {
            timestamps: true,
            collection: 'brands',
        }
    );

    // Campaign schema
    const CampaignSchema = new mongoose.Schema(
        {
            name: {
                type: String,
                required: [true, 'Please provide a campaign name'],
                trim: true,
                maxlength: [100, 'Campaign name cannot be more than 100 characters'],
            },
            subject: {
                type: String,
                required: [true, 'Please provide an email subject'],
                trim: true,
                maxlength: [200, 'Subject cannot be more than 200 characters'],
            },
            content: {
                type: String,
                default: '',
            },
            brandId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Brand',
                required: [true, 'Campaign must belong to a brand'],
            },
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: [true, 'Campaign must belong to a user'],
            },
            fromName: {
                type: String,
                trim: true,
            },
            fromEmail: {
                type: String,
                trim: true,
            },
            replyTo: {
                type: String,
                trim: true,
            },
            status: {
                type: String,
                enum: ['draft', 'queued', 'scheduled', 'sending', 'sent', 'failed', 'paused', 'warmup'],
                default: 'draft',
            },
            contactListIds: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'ContactList',
                },
            ],
            scheduleType: {
                type: String,
                enum: ['send_now', 'schedule', 'warmup'],
                default: 'send_now',
            },
            scheduledAt: {
                type: Date,
            },
            sentAt: {
                type: Date,
            },
            stats: {
                recipients: {
                    type: Number,
                    default: 0,
                },
                opens: {
                    type: Number,
                    default: 0,
                },
                clicks: {
                    type: Number,
                    default: 0,
                },
                bounces: {
                    type: Number,
                    default: 0,
                },
                complaints: {
                    type: Number,
                    default: 0,
                },
                processed: {
                    type: Number,
                    default: 0,
                },
            },
            processingMetadata: {
                lastProcessedContactIndex: { type: Number, default: 0 },
                lastProcessedListIndex: { type: Number, default: 0 },
                hasMoreToProcess: { type: Boolean, default: true },
                processingStartedAt: Date,
                processedBatches: { type: Number, default: 0 },
            },
            warmupConfig: {
                type: {
                    initialBatchSize: { type: Number, default: 50 },
                    incrementFactor: { type: Number, default: 2 },
                    incrementInterval: { type: Number, default: 24 }, // in hours
                    maxBatchSize: { type: Number, default: 10000 },
                    warmupStartDate: { type: Date },
                    currentWarmupStage: { type: Number, default: 0 },
                    totalStages: { type: Number },
                    completedBatches: { type: Number, default: 0 },
                    lastBatchSentAt: { type: Date },
                },
                default: null,
            },
        },
        {
            timestamps: true,
            collection: 'campaigns',
        }
    );

    // Contact schema
    const ContactSchema = new mongoose.Schema(
        {
            email: {
                type: String,
                required: true,
                lowercase: true,
                trim: true,
            },
            firstName: {
                type: String,
                trim: true,
            },
            lastName: {
                type: String,
                trim: true,
            },
            phone: {
                type: String,
                trim: true,
            },
            listId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'ContactList',
                required: true,
            },
            brandId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Brand',
                required: true,
            },
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true,
            },
            status: {
                type: String,
                default: 'active',
            },
        },
        {
            timestamps: true,
            collection: 'contacts',
        }
    );

    // Tracking event schema
    const TrackingEventSchema = new mongoose.Schema(
        {
            contactId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Contact',
                required: true,
            },
            campaignId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Campaign',
                required: true,
            },
            email: {
                type: String,
                required: true,
            },
            userAgent: String,
            ipAddress: String,
            timestamp: {
                type: Date,
                default: Date.now,
            },
            eventType: {
                type: String,
                required: true,
                enum: ['open', 'click', 'bounce', 'complaint', 'delivery'],
            },
            metadata: {
                type: mongoose.Schema.Types.Mixed,
                default: {},
            },
        },
        {
            timestamps: true,
        }
    );

    // Create models only if they don't already exist
    const Brand = mongoose.models.Brand || mongoose.model('Brand', BrandSchema);
    const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema);
    const Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);
    const TrackingEvent = mongoose.models.TrackingEvent || mongoose.model('TrackingEvent', TrackingEventSchema);

    return {
        Brand,
        Campaign,
        Contact,
        TrackingEvent,
    };
}

// Function to create or get model for campaign-specific stats
function createTrackingModel(campaignId) {
    // Make sure we have the base schemas defined
    const { TrackingEvent } = getModels();

    // Now create a campaign-specific tracking model
    const collectionName = `stats_${campaignId}`;
    return mongoose.models[collectionName] || mongoose.model(collectionName, mongoose.model('TrackingEvent').schema, collectionName);
}

// Connect to MongoDB and define models
let models = null;

async function connectToDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected for email processor');

        // Define models after successful connection
        models = defineModels();

        return true;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

// Get models after they've been defined
function getModels() {
    if (!models) {
        // If models aren't defined yet, define them now
        models = defineModels();
    }
    return models;
}

// Create Redis clients with proper error handling
const createRedisClient = () => {
    // Use the Redis URL from the config
    console.log('############# config.redisURL', config.redisURL);
    const redisUrl = config.redisURL;
    console.log('Email processor using Redis URL:', redisUrl);

    // Create Redis client with specific options required by Bull
    const redisClient = new Redis(redisUrl, {
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
    });

    redisClient.on('error', (err) => {
        console.error('Email processor Redis error:', err);
    });

    redisClient.on('connect', () => {
        console.log('Email processor Redis connected');
    });

    return redisClient;
};

// Utility functions
function generateTrackingToken(campaignId, contactId, email) {
    // Create a string to hash
    const dataToHash = `${campaignId}:${contactId}:${email}:${process.env.TRACKING_SECRET || 'tracking-secret-key'}`;

    // Generate SHA-256 hash
    return crypto.createHash('sha256').update(dataToHash).digest('hex');
}

function processHtml(html, campaignId, contactId, email, trackingDomain = '', brandId, trackingConfig = null) {
    // Fallback to using the API routes if tracking domain is not provided
    const domain = trackingDomain || process.env.TRACKING_DOMAIN || '';

    // Determine if tracking is enabled (default to true for backward compatibility)
    const trackOpens = trackingConfig?.trackOpens !== false;
    const trackClicks = trackingConfig?.trackClicks !== false;

    // Generate tracking token (only if any tracking is enabled)
    const token = (trackOpens || trackClicks) ? generateTrackingToken(campaignId, contactId, email) : null;

    // Base tracking parameters
    const trackingParams = token ? `cid=${encodeURIComponent(campaignId)}&lid=${encodeURIComponent(contactId)}&e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}` : '';

    // Parse HTML
    const $ = cheerio.load(html);

    // Process all links to add click tracking (only if click tracking is enabled)
    if (trackClicks) {
        $('a').each(function () {
            const originalUrl = $(this).attr('href');
            if (originalUrl && !originalUrl.startsWith('mailto:') && !originalUrl.startsWith('#')) {
                const trackingUrl = `${domain}/api/tracking/click?${trackingParams}&url=${encodeURIComponent(originalUrl)}`;
                $(this).attr('href', trackingUrl);
            }
        });
    }

    // Add tracking pixel at the end of the email (only if open tracking is enabled)
    if (trackOpens) {
        const trackingPixel = `<img src="${domain}/api/tracking/open?${trackingParams}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;" />`;
        $('body').append(trackingPixel);
    }

    // Generate unsubscribe token
    const unsubscribeToken = generateUnsubscribeToken(contactId, brandId, campaignId);
    const unsubscribeUrl = `${config.baseUrl}/unsubscribe/${unsubscribeToken}`;

    // Create unsubscribe footer
    const unsubscribeFooter = `
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
            <p>If you no longer wish to receive emails from us, you can <a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">unsubscribe here</a>.</p>
        </div>
    `;

    // Add unsubscribe footer before the end of the body
    $('body').append(unsubscribeFooter);

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

// ===== RFC 8058 ONE-CLICK UNSUBSCRIBE HELPERS =====

// Generate List-Unsubscribe headers for RFC 8058 compliance
function generateListUnsubscribeHeaders(contactId, brandId, campaignId, baseUrl) {
    const token = generateUnsubscribeToken(contactId, brandId, campaignId);
    const oneClickUrl = `${baseUrl}/api/unsubscribe/one-click?token=${encodeURIComponent(token)}`;

    return {
        listUnsubscribe: `<${oneClickUrl}>`,
        listUnsubscribePost: 'List-Unsubscribe=One-Click',
    };
}

// Build raw MIME email with custom headers including List-Unsubscribe
function buildRawEmail({ from, to, replyTo, subject, htmlContent, textContent, listUnsubscribe, listUnsubscribePost, configurationSet, tags }) {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    // Build headers
    let rawEmail = '';
    rawEmail += `From: ${from}\r\n`;
    rawEmail += `To: ${to}\r\n`;
    rawEmail += `Reply-To: ${replyTo}\r\n`;
    rawEmail += `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\n`;
    rawEmail += `MIME-Version: 1.0\r\n`;
    rawEmail += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;

    // Add List-Unsubscribe headers for RFC 8058 compliance (Google/Yahoo requirement)
    rawEmail += `List-Unsubscribe: ${listUnsubscribe}\r\n`;
    rawEmail += `List-Unsubscribe-Post: ${listUnsubscribePost}\r\n`;

    // Add custom headers for SES tracking
    if (tags && tags.length > 0) {
        const tagString = tags.map((t) => `${t.Name}=${t.Value}`).join(', ');
        rawEmail += `X-SES-MESSAGE-TAGS: ${tagString}\r\n`;
    }

    if (configurationSet) {
        rawEmail += `X-SES-CONFIGURATION-SET: ${configurationSet}\r\n`;
    }

    rawEmail += `\r\n`;

    // Text part
    rawEmail += `--${boundary}\r\n`;
    rawEmail += `Content-Type: text/plain; charset=UTF-8\r\n`;
    rawEmail += `Content-Transfer-Encoding: 7bit\r\n`;
    rawEmail += `\r\n`;
    rawEmail += `${textContent}\r\n`;

    // HTML part
    rawEmail += `--${boundary}\r\n`;
    rawEmail += `Content-Type: text/html; charset=UTF-8\r\n`;
    rawEmail += `Content-Transfer-Encoding: 7bit\r\n`;
    rawEmail += `\r\n`;
    rawEmail += `${htmlContent}\r\n`;

    // End boundary
    rawEmail += `--${boundary}--\r\n`;

    return rawEmail;
}

// Only create queues after successful DB connection and model initialization
async function initializeQueues() {
    // Connect to database first
    await connectToDB();

    // Check that models are properly defined
    const models = getModels();
    if (!models.Campaign || !models.Brand || !models.Contact) {
        throw new Error('Models failed to initialize properly');
    }

    console.log('Creating Bull queues...');

    // Create queues with consistent Redis configuration
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
            timeout: 3600000, // 1 hour timeout for processing
        },
    });

    const schedulerQueue = new Bull('campaign-scheduler', {
        createClient: (type) => createRedisClient(),
        defaultJobOptions: {
            removeOnComplete: true,
        },
    });

    // Process campaigns from the scheduler queue (scheduled for future)
    schedulerQueue.process('process-scheduled-campaign', async (job) => {
        try {
            const { campaignId, brandId, userId, contactListIds, fromName, fromEmail, replyTo, subject } = job.data;
            console.log(`Processing scheduled campaign ${campaignId}`);

            // Get models
            const { Campaign, Brand } = getModels();

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
                    subject: campaign.subject || subject || 'No Subject',
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

    // ===== WARMUP BATCH PROCESSOR WITH ONE-CLICK UNSUBSCRIBE =====
    schedulerQueue.process('process-warmup-batch', async (job) => {
        try {
            const { campaignId, brandId, userId, contactListIds, fromName, fromEmail, replyTo, subject, batchSize, warmupStage } = job.data;

            console.log(`Processing warmup batch for campaign ${campaignId}, stage ${warmupStage}, batch size ${batchSize}`);

            // Get models
            const { Campaign, Brand, Contact } = getModels();

            // Find the campaign
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                throw new Error(`Campaign not found: ${campaignId}`);
            }

            // Skip if campaign is no longer in warmup status
            if (campaign.status !== 'warmup') {
                console.log(`Campaign ${campaignId} is no longer in warmup status. Skipping batch.`);
                return { success: false, message: 'Campaign no longer in warmup status' };
            }

            // Get brand info
            const brand = await Brand.findById(brandId);
            if (!brand) {
                throw new Error(`Brand not found: ${brandId}`);
            }

            job.progress(10);

            // Get the offset (how many contacts we've already processed)
            const offset = campaign.stats?.processed || 0;

            // Get contacts for this batch
            const contacts = await Contact.find({
                listId: { $in: contactListIds },
                brandId: brandId,
                status: 'active',
                isUnsubscribed: { $in: [false, null] },
            })
                .sort({ _id: 1 })
                .skip(offset)
                .limit(batchSize);

            if (contacts.length === 0) {
                // No more contacts to process - campaign is complete
                await Campaign.updateOne(
                    { _id: campaignId },
                    {
                        $set: {
                            status: 'sent',
                            sentAt: new Date(),
                            'warmupConfig.lastBatchSentAt': new Date(),
                        },
                    }
                );

                console.log(`Warmup campaign ${campaignId} completed. All contacts processed.`);
                return { success: true, message: 'Warmup campaign completed' };
            }

            job.progress(20);

            // Create email provider using factory
            const brandObj = brand.toObject ? brand.toObject() : brand;
            const brandWithDecryptedSecrets = {
                ...brandObj,
                awsSecretKey: decryptData(brand.awsSecretKey, process.env.ENCRYPTION_KEY),
                sendgridApiKey: decryptData(brand.sendgridApiKey, process.env.ENCRYPTION_KEY),
                mailgunApiKey: decryptData(brand.mailgunApiKey, process.env.ENCRYPTION_KEY),
            };
            const emailProvider = ProviderFactory.createProvider(brandWithDecryptedSecrets, { decryptSecrets: false });
            console.log(`Using email provider: ${emailProvider.getName()} for warmup batch`);

            // Check provider quota
            const quotaResponse = await emailProvider.getQuota();
            const maxSendRate = quotaResponse.maxSendRate || 10;

            // Process this batch
            console.log(`Sending ${contacts.length} emails for warmup batch ${warmupStage}`);

            // Create rate limiter for this batch
            const limiter = new RateLimiter({ tokensPerInterval: maxSendRate, interval: 'second' });

            let successCount = 0;
            let failureCount = 0;
            const deliveryEvents = [];

            // Define tracking domain
            const trackingDomain = config.trackingDomain;

            // Process each contact in this batch
            for (const contact of contacts) {
                // Wait for rate limiter token
                await limiter.removeTokens(1);

                try {
                    // Add tracking to HTML content (respects campaign trackingConfig)
                    const processedHtml = processHtml(campaign.content || '<p>Empty campaign content</p>', campaignId.toString(), contact._id.toString(), contact.email, trackingDomain, brandId.toString(), campaign.trackingConfig);

                    // Extract plain text
                    const textContent = extractTextFromHtml(processedHtml);

                    // Generate List-Unsubscribe headers for RFC 8058 compliance
                    const unsubscribeHeaders = generateListUnsubscribeHeaders(contact._id.toString(), brandId.toString(), campaignId.toString(), config.baseUrl);

                    // Build recipient address
                    const toAddress = contact.firstName ? `${contact.firstName} ${contact.lastName || ''} <${contact.email}>`.trim() : contact.email;

                    // Send email using provider abstraction
                    const result = await emailProvider.sendRaw({
                        from: `${fromName} <${fromEmail}>`,
                        to: toAddress,
                        replyTo: replyTo || fromEmail,
                        subject: campaign.subject || subject || 'No Subject',
                        htmlContent: processedHtml,
                        textContent: textContent || 'Empty campaign content',
                        listUnsubscribe: unsubscribeHeaders.listUnsubscribe,
                        listUnsubscribePost: unsubscribeHeaders.listUnsubscribePost,
                        configurationSet: brand.sesConfigurationSet,
                        tags: [
                            { Name: 'campaignId', Value: campaignId.toString() },
                            { Name: 'contactId', Value: contact._id.toString() },
                            { Name: 'warmupStage', Value: warmupStage.toString() },
                        ],
                    });

                    // Add delivery event
                    deliveryEvents.push({
                        contactId: contact._id,
                        campaignId: campaignId,
                        email: contact.email,
                        eventType: 'delivery',
                        metadata: {
                            messageId: result.messageId,
                            warmupStage: warmupStage,
                            hasOneClickUnsubscribe: true,
                            provider: emailProvider.getName(),
                        },
                    });

                    successCount++;
                } catch (error) {
                    console.error(`Failed to send to ${contact.email}:`, error.message);
                    failureCount++;
                }
            }

            job.progress(70);

            // Log delivery events
            if (deliveryEvents.length > 0) {
                try {
                    const TrackingModel = createTrackingModel(campaignId);
                    await TrackingModel.insertMany(deliveryEvents);
                } catch (error) {
                    console.error('Error saving delivery events:', error);
                }
            }

            // Update campaign stats
            await Campaign.updateOne(
                { _id: campaignId },
                {
                    $inc: {
                        'stats.processed': contacts.length,
                        'stats.bounces': failureCount,
                        'warmupConfig.completedBatches': 1,
                    },
                    $set: {
                        'warmupConfig.currentWarmupStage': warmupStage + 1,
                        'warmupConfig.lastBatchSentAt': new Date(),
                    },
                }
            );

            job.progress(90);

            // Calculate next batch
            const updatedCampaign = await Campaign.findById(campaignId);
            console.log(`Updated campaign stats:`, updatedCampaign);

            // Check if we have more contacts to process
            const remainingContacts = updatedCampaign.stats.recipients - updatedCampaign.stats.processed;

            if (remainingContacts > 0) {
                // Calculate next batch size
                const { initialBatchSize, incrementFactor, incrementInterval, maxBatchSize, currentWarmupStage } = updatedCampaign.warmupConfig;

                // Calculate next batch size based on the warmup formula
                let nextBatchSize = initialBatchSize * Math.pow(incrementFactor, currentWarmupStage);
                nextBatchSize = Math.min(nextBatchSize, maxBatchSize, remainingContacts);

                // Calculate next batch delay (in milliseconds)
                const nextBatchDelay = incrementInterval * 60 * 60 * 1000; // Convert hours to ms

                // Schedule next batch
                await schedulerQueue.add(
                    'process-warmup-batch',
                    {
                        campaignId: campaignId.toString(),
                        brandId: brandId.toString(),
                        userId: userId,
                        contactListIds,
                        fromName,
                        fromEmail,
                        replyTo,
                        subject,
                        batchSize: nextBatchSize,
                        warmupStage: currentWarmupStage,
                    },
                    {
                        delay: nextBatchDelay,
                        jobId: `warmup-campaign-${campaignId}-batch-${currentWarmupStage}-${Date.now()}`,
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 5000,
                        },
                        removeOnComplete: false,
                    }
                );

                console.log(`Scheduled next warmup batch ${currentWarmupStage} with size ${nextBatchSize} in ${incrementInterval} hours`);
            } else {
                // Campaign complete
                await Campaign.updateOne({ _id: campaignId }, { $set: { status: 'sent', sentAt: new Date() } });

                console.log(`Warmup campaign ${campaignId} completed. All contacts processed.`);
            }

            job.progress(100);

            return {
                success: true,
                message: 'Warmup batch processed successfully',
                batchStats: {
                    processed: contacts.length,
                    successful: successCount,
                    failed: failureCount,
                    stage: warmupStage,
                },
            };
        } catch (error) {
            console.error(`Error processing warmup batch:`, error);

            // Update campaign status to failed
            try {
                const { Campaign } = getModels();
                const campaign = await Campaign.findById(job.data.campaignId);
                if (campaign) {
                    campaign.status = 'failed';
                    await campaign.save();
                }
            } catch (updateError) {
                console.error('Error updating campaign status to failed:', updateError);
            }

            throw error;
        }
    });

    // ===== SEND CAMPAIGN PROCESSOR WITH ONE-CLICK UNSUBSCRIBE =====
    emailCampaignQueue.process('send-campaign', async (job) => {
        const { campaignId, brandId, userId, contactListIds, fromName, fromEmail, replyTo, subject } = job.data;
        try {
            console.log(`Starting to process campaign: ${campaignId}`);

            // Make sure we have models before proceeding
            const { Campaign, Contact, Brand } = getModels();

            // Double check that Campaign model exists
            if (!Campaign) {
                throw new Error('Campaign model is not initialized');
            }

            // Get campaign details
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                throw new Error(`Campaign not found: ${campaignId}`);
            }

            job.progress(5);

            // Update status to sending and initialize processing metadata
            campaign.status = 'sending';
            campaign.processingMetadata = campaign.processingMetadata || {
                lastProcessedContactIndex: 0,
                lastProcessedListIndex: 0,
                hasMoreToProcess: true,
                processingStartedAt: new Date(),
                processedBatches: 0,
            };
            await campaign.save();

            job.progress(10);

            // Get brand
            const brand = await Brand.findById(brandId);
            if (!brand) {
                throw new Error(`Brand not found: ${brandId}`);
            }

            // Check if brand has email provider credentials configured
            const provider = brand.emailProvider || 'ses';
            if (provider === 'ses' && (!brand.awsRegion || !brand.awsAccessKey || !brand.awsSecretKey)) {
                throw new Error('AWS SES credentials not configured for this brand');
            } else if (provider === 'sendgrid' && !brand.sendgridApiKey) {
                throw new Error('SendGrid API key not configured for this brand');
            } else if (provider === 'mailgun' && (!brand.mailgunApiKey || !brand.mailgunDomain)) {
                throw new Error('Mailgun credentials not configured for this brand');
            }

            // Create email provider using factory
            const brandObj = brand.toObject ? brand.toObject() : brand;
            const brandWithDecryptedSecrets = {
                ...brandObj,
                awsSecretKey: decryptData(brand.awsSecretKey, process.env.ENCRYPTION_KEY),
                sendgridApiKey: decryptData(brand.sendgridApiKey, process.env.ENCRYPTION_KEY),
                mailgunApiKey: decryptData(brand.mailgunApiKey, process.env.ENCRYPTION_KEY),
            };
            const emailProvider = ProviderFactory.createProvider(brandWithDecryptedSecrets, { decryptSecrets: false });
            console.log(`Using email provider: ${emailProvider.getName()} for brand ${brand.name}`);

            job.progress(15);

            // Create tracking model for this campaign
            createTrackingModel(campaignId);

            // Define tracking domain for links and pixels
            const trackingDomain = config.trackingDomain;

            // Check quota and verify connection
            try {
                const quotaResponse = await emailProvider.getQuota();

                // Calculate remaining quota
                const remainingQuota = quotaResponse.max24HourSend - quotaResponse.sentLast24Hours;
                console.log(`Provider Quota - Max: ${quotaResponse.max24HourSend}, Used: ${quotaResponse.sentLast24Hours}, Remaining: ${remainingQuota}`);

                // Get an estimate of contacts to be processed
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
                const maxSendRate = quotaResponse.maxSendRate || 10;

                job.progress(20);

                // Calculate optimal batch size based on SES send rate
                const BATCH_SIZE = Math.max(10, Math.min(100, maxSendRate * 2));
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
                        status: 'active',
                        isUnsubscribed: { $in: [false, null] },
                    });

                    console.log(`Processing list ${listId} with ${totalContacts} contacts`);

                    // Process in chunks to avoid loading all contacts into memory
                    const CHUNK_SIZE = 1000;
                    let startIndex = 0;

                    // If this is the list we were processing before, start from lastProcessedContactIndex
                    if (listIndex === campaign.processingMetadata.lastProcessedListIndex) {
                        startIndex = campaign.processingMetadata.lastProcessedContactIndex;
                    }

                    while (startIndex < totalContacts) {
                        // Load a chunk of contacts
                        const contacts = await Contact.find({
                            listId: listId,
                            status: 'active',
                            isUnsubscribed: { $in: [false, null] },
                        })
                            .sort({ _id: 1 })
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

                            // Track successful deliveries
                            const deliveryEvents = [];

                            // Process each contact in batch
                            for (const contact of batchContacts) {
                                // Wait for rate limiter token
                                await limiter.removeTokens(1);

                                try {
                                    // Add tracking to HTML content (respects campaign trackingConfig)
                                    const processedHtml = processHtml(campaign.content || '<p>Empty campaign content</p>', campaignId.toString(), contact._id.toString(), contact.email, trackingDomain, brandId.toString(), campaign.trackingConfig);

                                    // Extract plain text for text-only clients
                                    const textContent = extractTextFromHtml(processedHtml);

                                    // Generate List-Unsubscribe headers for RFC 8058 compliance
                                    const unsubscribeHeaders = generateListUnsubscribeHeaders(contact._id.toString(), brandId.toString(), campaignId.toString(), config.baseUrl);

                                    // Build recipient address
                                    const toAddress = contact.firstName ? `${contact.firstName} ${contact.lastName || ''} <${contact.email}>`.trim() : contact.email;

                                    // Send email using provider abstraction
                                    const result = await emailProvider.sendRaw({
                                        from: `${fromName} <${fromEmail}>`,
                                        to: toAddress,
                                        replyTo: replyTo || fromEmail,
                                        subject: campaign.subject || subject || 'No Subject',
                                        htmlContent: processedHtml,
                                        textContent: textContent || 'Empty campaign content',
                                        listUnsubscribe: unsubscribeHeaders.listUnsubscribe,
                                        listUnsubscribePost: unsubscribeHeaders.listUnsubscribePost,
                                        configurationSet: brand.sesConfigurationSet,
                                        tags: [
                                            { Name: 'campaignId', Value: campaignId.toString() },
                                            { Name: 'contactId', Value: contact._id.toString() },
                                        ],
                                    });

                                    // Add delivery event to be tracked
                                    deliveryEvents.push({
                                        contactId: contact._id,
                                        campaignId: campaignId,
                                        email: contact.email,
                                        eventType: 'delivery',
                                        metadata: {
                                            messageId: result.messageId,
                                            hasOneClickUnsubscribe: true,
                                            provider: emailProvider.getName(),
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
                            // Note: stats.recipients is already set when campaign starts sending,
                            // so we only increment processed and bounces here to avoid double counting
                            await Campaign.updateOne(
                                { _id: campaignId },
                                {
                                    $inc: {
                                        'stats.processed': batchContacts.length,
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
            if (campaignId) {
                try {
                    const { Campaign } = getModels();
                    if (Campaign) {
                        const campaign = await Campaign.findById(campaignId);
                        if (campaign) {
                            campaign.status = 'failed';
                            campaign.processingMetadata = campaign.processingMetadata || {};
                            campaign.processingMetadata.hasMoreToProcess = true;
                            await campaign.save();
                        }
                    }
                } catch (updateError) {
                    console.error('Error updating campaign status to failed:', updateError);
                }
            }

            throw error;
        }
    });

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

    // Add cleanup routine
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

    // Run cleanup once a day
    setInterval(cleanupOldJobs, 24 * 60 * 60 * 1000);

    console.log('Email campaign worker with RFC 8058 one-click unsubscribe started and ready to process jobs');
}

// Start the worker
initializeQueues().catch((error) => {
    console.error('Failed to start worker:', error);
    process.exit(1);
});

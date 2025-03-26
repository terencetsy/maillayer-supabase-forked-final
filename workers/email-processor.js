// workers/email-processor.js
require('dotenv').config();
const Bull = require('bull');
const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { RateLimiter } = require('limiter');
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
        // For large campaigns, increase timeout
        timeout: 3600000, // 1 hour timeout for processing
    },
});

const schedulerQueue = new Bull('campaign-scheduler', {
    redis: redisOptions,
    defaultJobOptions: {
        removeOnComplete: true,
    },
});

// Set up MongoDB models - we need to load them differently in CommonJS
let Campaign;
let Contact;
let Brand;
let EmailServiceAccount;
let EmailSendLog; // New model for tracking individual emails

// Connect to MongoDB
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected');

        // Load models after connection
        const modelsDir = path.join(__dirname, '../src/models');

        // Check if the directory exists
        if (fs.existsSync(modelsDir)) {
            // Define schemas for our models
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
                    processed: { type: Number, default: 0 }, // Track how many have been processed
                },
                // For large campaigns - add a tracking field for resuming after failures
                processingMetadata: {
                    lastProcessedContactIndex: { type: Number, default: 0 },
                    lastProcessedListIndex: { type: Number, default: 0 },
                    hasMoreToProcess: { type: Boolean, default: true },
                    processingStartedAt: Date,
                    processedBatches: { type: Number, default: 0 },
                },
                createdAt: { type: Date, default: Date.now },
                updatedAt: { type: Date, default: Date.now },
            });

            const ContactSchema = new mongoose.Schema({
                email: String,
                firstName: String,
                lastName: String,
                contactListId: mongoose.Schema.Types.ObjectId,
                brandId: mongoose.Schema.Types.ObjectId,
                userId: mongoose.Schema.Types.ObjectId,
                status: {
                    type: String,
                    enum: ['active', 'unsubscribed', 'bounced', 'complained'],
                    default: 'active',
                },
                attributes: {
                    type: Map,
                    of: String,
                    default: {},
                },
                createdAt: { type: Date, default: Date.now },
                updatedAt: { type: Date, default: Date.now },
            });

            const BrandSchema = new mongoose.Schema({
                name: String,
                website: String,
                userId: mongoose.Schema.Types.ObjectId,
                emailServiceProvider: String,
                emailServiceSesRegion: String,
                emailServiceSesAccessKey: String,
                emailServiceSesSecretKey: String,
                emailServiceSendgridApiKey: String,
                emailServiceSenderEmail: String,
                emailServiceSenderName: String,
                createdAt: { type: Date, default: Date.now },
                updatedAt: { type: Date, default: Date.now },
            });

            const EmailServiceAccountSchema = new mongoose.Schema({
                brandId: mongoose.Schema.Types.ObjectId,
                userId: mongoose.Schema.Types.ObjectId,
                provider: {
                    type: String,
                    enum: ['none', 'ses', 'sendgrid'],
                    default: 'none',
                },
                configurationType: {
                    type: String,
                    enum: ['email', 'domain'],
                    default: 'email',
                },
                sesRegion: String,
                sesAccessKey: String,
                sesSecretKey: String,
                sendgridApiKey: String,
                senderEmail: String,
                senderName: String,
                verified: { type: Boolean, default: false },
                verificationSentAt: Date,
                totalSent: { type: Number, default: 0 },
                totalBounces: { type: Number, default: 0 },
                totalComplaints: { type: Number, default: 0 },
                // Add sending quota info from SES
                sendingQuota: {
                    max24HourSend: { type: Number, default: 500 }, // Conservative default
                    maxSendRate: { type: Number, default: 10 }, // Default SES rate limit
                    sentLast24Hours: { type: Number, default: 0 },
                },
            });

            // New schema for tracking individual email sends
            const EmailSendLogSchema = new mongoose.Schema({
                campaignId: mongoose.Schema.Types.ObjectId,
                contactId: mongoose.Schema.Types.ObjectId,
                email: String,
                sent: Boolean,
                sentAt: Date,
                error: String,
                messageId: String, // SES message ID for tracking
            });

            const EmailTrackingLogSchema = new mongoose.Schema({
                trackingId: String,
                campaignId: mongoose.Schema.Types.ObjectId,
                contactId: mongoose.Schema.Types.ObjectId,
                email: String,
                sentAt: Date,
                opens: Number,
                clicks: Number,
                lastOpenedAt: Date,
                lastClickedAt: Date,
                unsubscribed: Boolean,
                unsubscribedAt: Date,
            });

            // Create models if they don't exist already
            Campaign = mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema);
            Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);
            Brand = mongoose.models.Brand || mongoose.model('Brand', BrandSchema);
            EmailServiceAccount = mongoose.models.EmailServiceAccount || mongoose.model('EmailServiceAccount', EmailServiceAccountSchema);
            EmailSendLog = mongoose.models.EmailSendLog || mongoose.model('EmailSendLog', EmailSendLogSchema);
            EmailTrackingLog = mongoose.models.EmailTrackingLog || mongoose.model('EmailTrackingLog', EmailTrackingLogSchema);
        } else {
            console.error('Models directory not found:', modelsDir);
            throw new Error('Models directory not found');
        }
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

// SES utility functions
function decryptData(encryptedText, secretKey) {
    try {
        const key = crypto.scryptSync(secretKey || process.env.ENCRYPTION_KEY || 'default-fallback-key', 'salt', 32);

        // Split the IV and encrypted content
        const parts = encryptedText.split(':');
        if (parts.length !== 2) {
            throw new Error('Invalid encrypted format');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = Buffer.from(parts[1], 'hex');

        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt credentials');
    }
}

async function createSESClient(emailServiceAccount) {
    try {
        // If no email service account or not SES, return null
        if (!emailServiceAccount || emailServiceAccount.provider !== 'ses') {
            return null;
        }

        // Decrypt credentials
        const accessKey = emailServiceAccount.sesAccessKey;
        const secretKey = decryptData(emailServiceAccount.sesSecretKey, process.env.ENCRYPTION_KEY);

        // Create SES client
        const ses = new AWS.SES({
            accessKeyId: accessKey,
            secretAccessKey: secretKey,
            region: emailServiceAccount.sesRegion || 'us-east-1',
        });

        return ses;
    } catch (error) {
        console.error('Error creating SES client:', error);
        throw error;
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

        // Get email service account
        const emailServiceAccount = await EmailServiceAccount.findOne({ brandId });
        if (!emailServiceAccount) {
            throw new Error('Email service account not found for this brand');
        }

        // Add the campaign to the processing queue
        await emailCampaignQueue.add(
            'send-campaign',
            {
                campaignId,
                brandId,
                userId,
                contactListIds: Array.isArray(contactListIds) ? contactListIds : campaign.contactListIds,
                fromName: fromName || campaign.fromName,
                fromEmail: fromEmail || campaign.fromEmail,
                replyTo: replyTo || campaign.replyTo || campaign.fromEmail,
                subject: subject || campaign.subject,
                emailServiceProvider: emailServiceAccount.provider,
                emailServiceAccountId: emailServiceAccount._id.toString(),
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

// Create a separate worker to process batches of a campaign
emailCampaignQueue.process('process-campaign-batch', async (job) => {
    const { campaignId, brandId, batchContacts, fromName, fromEmail, replyTo, subject, emailServiceAccountId } = job.data;

    try {
        console.log(`Processing batch of ${batchContacts.length} contacts for campaign ${campaignId}`);

        // Get campaign details
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            throw new Error(`Campaign not found: ${campaignId}`);
        }

        // Get email service account settings
        const emailServiceAccount = await EmailServiceAccount.findById(emailServiceAccountId);
        if (!emailServiceAccount || emailServiceAccount.provider === 'none') {
            throw new Error('No valid email service provider configured');
        }

        // Create email client
        let emailClient;
        if (emailServiceAccount.provider === 'ses') {
            emailClient = await createSESClient(emailServiceAccount);
            if (!emailClient) {
                throw new Error('Failed to initialize SES client');
            }
        } else if (emailServiceAccount.provider === 'sendgrid') {
            throw new Error('SendGrid implementation not completed');
        }

        // Rate limiter based on provider's send rate
        const sendRate = emailServiceAccount.sendingQuota?.maxSendRate || 10; // Default SES rate limit
        const limiter = new RateLimiter({ tokensPerInterval: sendRate, interval: 'second' });

        let successCount = 0;
        let failureCount = 0;
        let processedCount = 0;

        // Process each contact in the batch with rate limiting
        for (const contact of batchContacts) {
            // Wait for rate limiter token
            await limiter.removeTokens(1);

            try {
                // Process individual email
                const result = await sendEmailWithProvider(emailServiceAccount.provider, emailClient, {
                    toEmail: contact.email,
                    toName: contact.firstName ? `${contact.firstName} ${contact.lastName || ''}`.trim() : '',
                    fromEmail,
                    fromName,
                    replyTo,
                    subject: subject || campaign.subject,
                    content: campaign.content,
                    contactId: contact._id,
                    campaignId: campaign._id,
                });

                // Log successful send
                await EmailSendLog.create({
                    campaignId: campaign._id,
                    contactId: contact._id,
                    email: contact.email,
                    sent: true,
                    sentAt: new Date(),
                    messageId: result.MessageId,
                });

                successCount++;
            } catch (error) {
                console.error(`Failed to send to ${contact.email}:`, error.message);

                // Log failed send
                await EmailSendLog.create({
                    campaignId: campaign._id,
                    contactId: contact._id,
                    email: contact.email,
                    sent: false,
                    sentAt: new Date(),
                    error: error.message.substring(0, 500), // Limit error message length
                });

                failureCount++;
            }

            processedCount++;

            // Update progress
            job.progress(Math.floor((processedCount / batchContacts.length) * 100));
        }

        // Update campaign stats in an atomic way using $inc
        await Campaign.updateOne(
            { _id: campaignId },
            {
                $inc: {
                    'stats.processed': processedCount,
                    'stats.recipients': successCount,
                    'stats.bounces': failureCount,
                    'processingMetadata.processedBatches': 1,
                },
            }
        );

        // Update email service account stats
        await EmailServiceAccount.updateOne({ _id: emailServiceAccountId }, { $inc: { totalSent: successCount } });

        return {
            batchSize: batchContacts.length,
            sent: successCount,
            failed: failureCount,
        };
    } catch (error) {
        console.error(`Error processing batch for campaign ${campaignId}:`, error);
        throw error;
    }
});

// Complete send-campaign handler for email-processor.js
emailCampaignQueue.process('send-campaign', async (job) => {
    const { campaignId, brandId, userId, contactListIds, fromName, fromEmail, replyTo, subject, brandAwsRegion, brandAwsAccessKey, brandAwsSecretKey } = job.data;

    try {
        console.log(`Starting to process campaign: ${campaignId}`);
        job.progress(5);

        // Get campaign details
        const campaign = await Campaign.findById(campaignId);
        console.log('Campaign:', campaign);
        if (!campaign) {
            throw new Error(`Campaign not found: ${campaignId}`);
        }

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

        // Check quota and verify connection
        try {
            const quotaResponse = await ses.getSendQuota().promise();

            // Calculate remaining quota
            const remainingQuota = quotaResponse.Max24HourSend - quotaResponse.SentLast24Hours;
            console.log(`SES Quota - Max: ${quotaResponse.Max24HourSend}, Used: ${quotaResponse.SentLast24Hours}, Remaining: ${remainingQuota}`);

            // Get an estimate of contacts to be processed
            let totalContactsEstimate = 0;
            for (const listId of contactListIds) {
                const count = await Contact.countDocuments({
                    contactListId: listId,
                    status: 'active',
                });
                totalContactsEstimate += count;
            }

            if (totalContactsEstimate > remainingQuota) {
                console.warn(`Campaign has ${totalContactsEstimate} contacts but only ${remainingQuota} remaining in quota`);
                // We'll continue but should warn the user in a real app
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
                    contactListId: listId,
                    status: 'active',
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
                        contactListId: listId,
                        status: 'active',
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

                        // Process each contact in batch
                        for (const contact of batchContacts) {
                            // Wait for rate limiter token
                            await limiter.removeTokens(1);

                            try {
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
                                                    Data: campaign.content || '<p>Empty campaign content</p>',
                                                },
                                                Text: {
                                                    Data: extractTextFromHtml(campaign.content) || 'Empty campaign content',
                                                },
                                            },
                                        },
                                        ReplyToAddresses: [replyTo || fromEmail],
                                    })
                                    .promise();

                                // Log successful send
                                await new EmailSendLog({
                                    campaignId: campaign._id,
                                    contactId: contact._id,
                                    email: contact.email,
                                    sent: true,
                                    sentAt: new Date(),
                                    messageId: result.MessageId,
                                }).save();

                                successCount++;
                            } catch (error) {
                                console.error(`Failed to send to ${contact.email}:`, error.message);

                                // Log failed send
                                await new EmailSendLog({
                                    campaignId: campaign._id,
                                    contactId: contact._id,
                                    email: contact.email,
                                    sent: false,
                                    sentAt: new Date(),
                                    error: error.message.substring(0, 500), // Limit error message length
                                }).save();

                                failureCount++;
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

            // Get final stats
            const finalStats = await EmailSendLog.aggregate([
                { $match: { campaignId: campaign._id } },
                {
                    $group: {
                        _id: '$sent',
                        count: { $sum: 1 },
                    },
                },
            ]);

            const sent = finalStats.find((s) => s._id === true)?.count || 0;
            const failed = finalStats.find((s) => s._id === false)?.count || 0;

            console.log(`Campaign ${campaignId} completed: ${sent} sent, ${failed} failed`);

            return {
                campaignId,
                totalContacts: sent + failed,
                sent,
                failed,
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
                const campaign = await Campaign.findById(campaignId);
                if (campaign) {
                    campaign.status = 'failed';
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

// Function to resume a failed or paused campaign
async function resumeCampaign(campaignId) {
    try {
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            throw new Error(`Campaign not found: ${campaignId}`);
        }

        if (!campaign.processingMetadata.hasMoreToProcess) {
            throw new Error('Campaign does not need to be resumed - it is already completed');
        }

        // Get required data to restart the campaign
        const brand = await Brand.findById(campaign.brandId);
        const emailServiceAccount = await EmailServiceAccount.findOne({ brandId: campaign.brandId });

        if (!emailServiceAccount) {
            throw new Error('Email service account not found');
        }

        // Add the campaign back to the queue
        await emailCampaignQueue.add(
            'send-campaign',
            {
                campaignId: campaign._id.toString(),
                brandId: campaign.brandId.toString(),
                userId: campaign.userId.toString(),
                contactListIds: campaign.contactListIds.map((id) => id.toString()),
                fromName: campaign.fromName,
                fromEmail: campaign.fromEmail,
                replyTo: campaign.replyTo,
                subject: campaign.subject,
                emailServiceProvider: emailServiceAccount.provider,
                emailServiceAccountId: emailServiceAccount._id.toString(),
            },
            {
                jobId: `resume-campaign-${campaign._id}-${Date.now()}`,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
                removeOnComplete: false,
            }
        );

        return { success: true, message: 'Campaign resumed' };
    } catch (error) {
        console.error(`Error resuming campaign ${campaignId}:`, error);
        throw error;
    }
}

// Send individual email based on the provider
async function sendEmailWithProvider(provider, client, params) {
    const { toEmail, toName, fromEmail, fromName, replyTo, subject, content, contactId, campaignId } = params;

    // Add tracking parameters or personalization here if needed
    // This is where you'd replace personalization tags with contact data
    let personalizedContent = content;
    let personalizedSubject = subject;

    if (toName) {
        personalizedContent = personalizedContent.replace(/{{name}}/g, toName);
        personalizedSubject = personalizedSubject.replace(/{{name}}/g, toName);
    }

    personalizedContent = personalizedContent.replace(/{{email}}/g, toEmail);

    // Create a unique token for secure unsubscribe
    const unsubscribeToken = crypto
        .createHash('sha256')
        .update(`${toEmail}-${campaignId}-${process.env.UNSUBSCRIBE_SECRET || 'default-secret-key'}`)
        .digest('hex');

    // Add unsubscribe link and tracking pixels if needed
    const unsubscribeUrl = `${process.env.NEXT_PUBLIC_URL || 'https://yourapp.com'}/unsubscribe?email=${encodeURIComponent(toEmail)}&token=${unsubscribeToken}`;
    personalizedContent = personalizedContent.replace(/{{unsubscribe}}/g, unsubscribeUrl);

    // If no explicit unsubscribe tag, add link at the bottom
    if (!personalizedContent.includes('{{unsubscribe}}')) {
        const unsubscribeFooter = `
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #718096; text-align: center;">
            <p>If you no longer wish to receive these emails, you can <a href="${unsubscribeUrl}" style="color: #4a5568;">unsubscribe here</a>.</p>
        </div>
    `;

        // Add before closing body tag or at the end
        if (personalizedContent.includes('</body>')) {
            personalizedContent = personalizedContent.replace('</body>', `${unsubscribeFooter}</body>`);
        } else {
            personalizedContent = `${personalizedContent}${unsubscribeFooter}`;
        }
    }

    // Add tracking pixel for open tracking with a unique ID
    const trackingId = `${campaignId}-${contactId}-${Date.now()}`;
    const trackingPixel = `<img src="${process.env.NEXT_PUBLIC_URL || 'https://yourapp.com'}/api/tracking/open?tid=${trackingId}" width="1" height="1" alt="" style="display:none;" />`;

    // Make sure we have a closing body tag
    if (personalizedContent.includes('</body>')) {
        personalizedContent = personalizedContent.replace('</body>', `${trackingPixel}</body>`);
    } else {
        personalizedContent = `${personalizedContent}${trackingPixel}`;
    }

    // Store tracking information
    try {
        await new EmailTrackingLog({
            trackingId,
            campaignId,
            contactId,
            email: toEmail,
            sentAt: new Date(),
            opens: 0,
            lastOpenedAt: null,
        }).save();
    } catch (err) {
        console.error('Error saving tracking info:', err);
        // Continue sending the email even if tracking save fails
    }

    if (provider === 'ses') {
        // Send via Amazon SES
        const sesParams = {
            Source: `${fromName} <${fromEmail}>`,
            Destination: {
                ToAddresses: [toName ? `${toName} <${toEmail}>` : toEmail],
            },
            Message: {
                Subject: {
                    Data: personalizedSubject,
                },
                Body: {
                    Html: {
                        Data: personalizedContent,
                    },
                    Text: {
                        Data: extractTextFromHtml(personalizedContent),
                    },
                },
            },
            ReplyToAddresses: [replyTo || fromEmail],
            // Optionally add configuration set for bounce/complaint tracking
            // ConfigurationSetName: 'campaign-tracking',
        };

        return client.sendEmail(sesParams).promise();
    } else if (provider === 'sendgrid') {
        // Implement SendGrid sending here
        throw new Error('SendGrid implementation not completed');
    } else {
        throw new Error(`Unsupported email provider: ${provider}`);
    }
}

// Extract plain text from HTML for text alternatives
function extractTextFromHtml(html) {
    // Simple implementation - in production you might want a better HTML-to-text converter
    return html
        .replace(/<style[^>]*>.*?<\/style>/gs, '')
        .replace(/<script[^>]*>.*?<\/script>/gs, '')
        .replace(/<[^>]*>/gs, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Handle queue events
emailCampaignQueue.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed with result:`, result);
});

emailCampaignQueue.on('failed', (job, error) => {
    console.error(`Job ${job.id} failed with error:`, error);

    // If this was a batch job, we might want to reduce concurrency or
    // implement backoff strategy
    if (job.name === 'process-campaign-batch') {
        console.log('Batch processing job failed, implementing backoff...');
        // Here you could modify the job settings to retry with less concurrency
    }
});

schedulerQueue.on('completed', (job, result) => {
    console.log(`Scheduler job ${job.id} completed with result:`, result);
});

schedulerQueue.on('failed', (job, error) => {
    console.error(`Scheduler job ${job.id} failed with error:`, error);
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

// Add this at the bottom of the file
setInterval(cleanupOldJobs, 24 * 60 * 60 * 1000); // Run once a day
// Start worker
connectDB()
    .then(() => {
        console.log('Email campaign worker started and ready to process jobs');
    })
    .catch((error) => {
        console.error('Failed to start worker:', error);
        process.exit(1);
    });

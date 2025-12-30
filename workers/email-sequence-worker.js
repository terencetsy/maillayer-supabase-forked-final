// workers/email-sequence-worker.js
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const Bull = require('bull');
const Redis = require('ioredis');
const crypto = require('crypto');
const cheerio = require('cheerio');
const config = require('../src/lib/configCommonJS');
const { generateUnsubscribeToken } = require('../src/lib/tokenUtils');
const ProviderFactory = require('../src/lib/email-providers/ProviderFactory');

// Get Redis URL
function getRedisUrl() {
    return process.env.REDIS_URL || 'redis://localhost:6379';
}

const redisUrl = getRedisUrl();

// Create Redis client
const createRedisClient = () => {
    const redisClient = new Redis(redisUrl, {
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
    });

    redisClient.on('error', (err) => {
        console.error('Sequence worker Redis error:', err);
    });

    redisClient.on('connect', () => {
        console.log('Sequence worker Redis connected');
    });

    return redisClient;
};

// Create Bull queue
const emailSequenceQueue = new Bull('email-sequences', {
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

// Define schemas
const EmailSequenceSchema = new mongoose.Schema(
    {
        name: String,
        description: String,
        brandId: mongoose.Schema.Types.ObjectId,
        userId: mongoose.Schema.Types.ObjectId,
        triggerType: {
            type: String,
            enum: ['contact_list', 'integration', 'webhook', 'manual'],
            default: 'contact_list',
        },
        triggerConfig: {
            contactListIds: [mongoose.Schema.Types.ObjectId],
            integrationType: String,
            integrationEvent: String,
            integrationAccountId: String,
        },
        emailConfig: {
            fromName: String,
            fromEmail: String,
            replyToEmail: String,
        },
        status: {
            type: String,
            enum: ['active', 'paused', 'archived', 'draft'],
            default: 'draft',
        },
        emails: [
            {
                id: String,
                order: Number,
                subject: String,
                content: String,
                delayAmount: Number,
                delayUnit: String,
            },
        ],
        stats: {
            totalEnrolled: { type: Number, default: 0 },
            totalCompleted: { type: Number, default: 0 },
            totalActive: { type: Number, default: 0 },
        },
    },
    { timestamps: true, collection: 'emailsequences' }
);

const SequenceEnrollmentSchema = new mongoose.Schema(
    {
        sequenceId: mongoose.Schema.Types.ObjectId,
        contactId: mongoose.Schema.Types.ObjectId,
        brandId: mongoose.Schema.Types.ObjectId,
        userId: mongoose.Schema.Types.ObjectId,
        status: String,
        currentStep: Number,
        enrolledAt: Date,
        completedAt: Date,
        emailsSent: [
            {
                emailOrder: Number,
                sentAt: Date,
                messageId: String,
                status: String,
            },
        ],
    },
    { timestamps: true, collection: 'sequenceenrollments' }
);

const ContactSchema = new mongoose.Schema(
    {
        email: String,
        firstName: String,
        lastName: String,
        status: String,
        isUnsubscribed: Boolean,
        listId: mongoose.Schema.Types.ObjectId,
        brandId: mongoose.Schema.Types.ObjectId,
        userId: mongoose.Schema.Types.ObjectId,
    },
    { timestamps: true, collection: 'contacts' }
);

const BrandSchema = new mongoose.Schema(
    {
        name: String,
        userId: mongoose.Schema.Types.ObjectId,
        awsRegion: String,
        awsAccessKey: String,
        awsSecretKey: String,
        fromName: String,
        fromEmail: String,
        replyToEmail: String,
        status: String,
        sesConfigurationSet: String,
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
        sendgridApiKey: String,
        // Mailgun Configuration
        mailgunApiKey: String,
        mailgunDomain: String,
        mailgunRegion: {
            type: String,
            enum: ['us', 'eu'],
            default: 'us',
        },
    },
    { timestamps: true, collection: 'brands' }
);

// ===== SEQUENCE LOG SCHEMA (for inline logging) =====
const SequenceLogSchema = new mongoose.Schema({
    sequenceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    enrollmentId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    contactId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    brandId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    email: {
        type: String,
        required: true,
        trim: true,
    },
    emailOrder: {
        type: Number,
        required: true,
    },
    subject: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'failed'],
        default: 'sent',
    },
    messageId: String,
    error: String,
    events: [
        {
            type: {
                type: String,
                enum: ['open', 'click', 'bounce', 'complaint'],
                required: true,
            },
            timestamp: {
                type: Date,
                default: Date.now,
            },
            metadata: {
                type: mongoose.Schema.Types.Mixed,
                default: {},
            },
        },
    ],
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    ipAddress: String,
    userAgent: String,
    sentAt: {
        type: Date,
        default: Date.now,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

SequenceLogSchema.index({ sequenceId: 1, createdAt: -1 });
SequenceLogSchema.index({ enrollmentId: 1 });
SequenceLogSchema.index({ email: 1 });

// ===== HELPER FUNCTIONS FOR SEQUENCE LOGGING =====

// Dynamic model creation function for sequence-specific collections
const createSequenceLogModel = (sequenceId) => {
    const collectionName = `seq_logs_${sequenceId}`;
    return mongoose.models[collectionName] || mongoose.model(collectionName, SequenceLogSchema, collectionName);
};

// Log sequence email function
const logSequenceEmail = async (logData) => {
    try {
        const SequenceLogModel = createSequenceLogModel(logData.sequenceId);

        const log = new SequenceLogModel({
            ...logData,
            createdAt: new Date(),
        });

        await log.save();

        console.log(`Created sequence log for ${logData.email} in collection seq_logs_${logData.sequenceId}`);

        return log;
    } catch (error) {
        console.error('Error logging sequence email:', error);
        throw error;
    }
};

// Track sequence event function
const trackSequenceEvent = async (sequenceId, enrollmentId, eventType, metadata = {}) => {
    try {
        const SequenceLogModel = createSequenceLogModel(sequenceId);

        // Find the log entry and check if event already exists
        const existingLog = await SequenceLogModel.findOne({
            sequenceId: new mongoose.Types.ObjectId(sequenceId),
            enrollmentId: new mongoose.Types.ObjectId(enrollmentId),
            'events.type': eventType,
        });

        let logResult;

        if (existingLog) {
            // Update existing event
            logResult = await SequenceLogModel.findOneAndUpdate(
                {
                    sequenceId: new mongoose.Types.ObjectId(sequenceId),
                    enrollmentId: new mongoose.Types.ObjectId(enrollmentId),
                    'events.type': eventType,
                },
                {
                    $set: {
                        'events.$.timestamp': new Date(),
                        'events.$.metadata': metadata,
                    },
                }
            );
        } else {
            // Add new event
            logResult = await SequenceLogModel.findOneAndUpdate(
                {
                    sequenceId: new mongoose.Types.ObjectId(sequenceId),
                    enrollmentId: new mongoose.Types.ObjectId(enrollmentId),
                },
                {
                    $push: {
                        events: {
                            type: eventType,
                            timestamp: new Date(),
                            metadata,
                        },
                    },
                }
            );
        }

        return true;
    } catch (error) {
        console.error('Error tracking sequence event:', error);
        return false;
    }
};

// Connect to MongoDB
async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Sequence worker connected to MongoDB');

        // Register models
        global.EmailSequence = mongoose.models.EmailSequence || mongoose.model('EmailSequence', EmailSequenceSchema);
        global.SequenceEnrollment = mongoose.models.SequenceEnrollment || mongoose.model('SequenceEnrollment', SequenceEnrollmentSchema);
        global.Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);
        global.Brand = mongoose.models.Brand || mongoose.model('Brand', BrandSchema);

        return true;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

// Utility functions
function decryptData(encryptedText, secretKey) {
    try {
        if (!encryptedText || !encryptedText.includes(':')) {
            return encryptedText;
        }

        const key = crypto.scryptSync(secretKey || process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
        const parts = encryptedText.split(':');
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

function extractTextFromHtml(html) {
    if (!html) return '';
    const $ = cheerio.load(html);
    $('script, style').remove();
    return $('body').text().replace(/\s+/g, ' ').trim();
}

function generateTrackingToken(sequenceId, enrollmentId, email) {
    const dataToHash = `${sequenceId}:${enrollmentId}:${email}:${process.env.TRACKING_SECRET || 'tracking-secret-key'}`;
    return crypto.createHash('sha256').update(dataToHash).digest('hex');
}

function processHtml(html, sequenceId, enrollmentId, email, trackingDomain, brandId) {
    const domain = trackingDomain || process.env.TRACKING_DOMAIN || process.env.NEXT_PUBLIC_BASE_URL || '';
    const token = generateTrackingToken(sequenceId, enrollmentId, email);
    const trackingParams = `sid=${encodeURIComponent(sequenceId)}&eid=${encodeURIComponent(enrollmentId)}&e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`;

    const $ = cheerio.load(html);

    // Add click tracking
    $('a').each(function () {
        const originalUrl = $(this).attr('href');
        if (originalUrl && !originalUrl.startsWith('mailto:') && !originalUrl.startsWith('#')) {
            const trackingUrl = `${domain}/api/tracking/sequence-click?${trackingParams}&url=${encodeURIComponent(originalUrl)}`;
            $(this).attr('href', trackingUrl);
        }
    });

    // Add tracking pixel
    const trackingPixel = `<img src="${domain}/api/tracking/sequence-open?${trackingParams}" width="1" height="1" alt="" style="display:none;" />`;
    $('body').append(trackingPixel);

    // Add unsubscribe link in footer
    const unsubscribeToken = generateUnsubscribeToken(enrollmentId, brandId, sequenceId);
    const unsubscribeUrl = `${config.baseUrl}/unsubscribe/${unsubscribeToken}`;

    const unsubscribeFooter = `
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
            <p>If you no longer wish to receive these emails, you can <a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">unsubscribe here</a>.</p>
        </div>
    `;

    $('body').append(unsubscribeFooter);

    return $.html();
}

// ===== RFC 8058 ONE-CLICK UNSUBSCRIBE HELPERS =====

// Generate List-Unsubscribe headers for RFC 8058 compliance
function generateListUnsubscribeHeaders(enrollmentId, brandId, sequenceId, baseUrl) {
    const token = generateUnsubscribeToken(enrollmentId, brandId, sequenceId);
    const oneClickUrl = `${baseUrl}/api/unsubscribe/one-click?token=${encodeURIComponent(token)}`;

    return {
        listUnsubscribe: `<${oneClickUrl}>`,
        listUnsubscribePost: 'List-Unsubscribe=One-Click',
    };
}

// Encode content for quoted-printable (handles special characters properly)
function encodeQuotedPrintable(str) {
    if (!str) return '';

    return str
        .replace(/[^\x20-\x7E\r\n\t]/g, (char) => {
            const hex = char.charCodeAt(0).toString(16).toUpperCase();
            return '=' + (hex.length < 2 ? '0' : '') + hex;
        })
        .replace(/([^\r\n]{73})/g, '$1=\r\n'); // Soft line breaks at 76 chars
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

// ===== PROCESS SEQUENCE EMAIL FUNCTION =====
async function processSequenceEmail(job) {
    const { enrollmentId, emailOrder } = job.data;

    try {
        console.log(`Processing sequence email for enrollment ${enrollmentId}, step ${emailOrder}`);

        const SequenceEnrollment = mongoose.model('SequenceEnrollment');
        const EmailSequence = mongoose.model('EmailSequence');
        const Contact = mongoose.model('Contact');
        const Brand = mongoose.model('Brand');

        // Get enrollment
        const enrollment = await SequenceEnrollment.findById(enrollmentId);
        if (!enrollment) {
            throw new Error(`Enrollment not found: ${enrollmentId}`);
        }

        // Check enrollment status
        if (enrollment.status !== 'active') {
            console.log(`Enrollment ${enrollmentId} is not active (${enrollment.status}), skipping`);
            return { success: false, message: 'Enrollment not active' };
        }

        // Get sequence
        const sequence = await EmailSequence.findById(enrollment.sequenceId);
        if (!sequence || sequence.status !== 'active') {
            console.log(`Sequence not found or not active, skipping`);
            return { success: false, message: 'Sequence not active' };
        }

        // Get email from sequence
        const emailStep = sequence.emails.find((e) => e.order === emailOrder);
        if (!emailStep) {
            throw new Error(`Email step ${emailOrder} not found in sequence`);
        }

        // Get contact
        const contact = await Contact.findById(enrollment.contactId);
        if (!contact) {
            throw new Error(`Contact not found: ${enrollment.contactId}`);
        }

        // Check contact status
        if (contact.status !== 'active' || contact.isUnsubscribed) {
            console.log(`Contact ${contact.email} is not eligible, marking enrollment as completed`);
            enrollment.status = 'unsubscribed';
            enrollment.completedAt = new Date();
            await enrollment.save();

            await EmailSequence.updateOne(
                { _id: sequence._id },
                {
                    $inc: {
                        'stats.totalActive': -1,
                        'stats.totalCompleted': 1,
                    },
                }
            );

            return { success: false, message: 'Contact not eligible' };
        }

        // Get brand
        const brand = await Brand.findById(enrollment.brandId);
        if (!brand) {
            throw new Error(`Brand not found: ${enrollment.brandId}`);
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
        const brandWithDecryptedSecrets = {
            ...brand.toObject ? brand.toObject() : brand,
            awsSecretKey: decryptData(brand.awsSecretKey, process.env.ENCRYPTION_KEY),
            sendgridApiKey: decryptData(brand.sendgridApiKey, process.env.ENCRYPTION_KEY),
            mailgunApiKey: decryptData(brand.mailgunApiKey, process.env.ENCRYPTION_KEY),
        };
        const emailProvider = ProviderFactory.createProvider(brandWithDecryptedSecrets, { decryptSecrets: false });
        console.log(`Using email provider: ${emailProvider.getName()}`);

        // Process HTML with tracking
        const trackingDomain = config.trackingDomain;
        const processedHtml = processHtml(emailStep.content, sequence._id.toString(), enrollment._id.toString(), contact.email, trackingDomain, brand._id.toString());

        const textContent = extractTextFromHtml(processedHtml);

        // Generate List-Unsubscribe headers for RFC 8058 compliance
        const unsubscribeHeaders = generateListUnsubscribeHeaders(enrollment._id.toString(), brand._id.toString(), sequence._id.toString(), config.baseUrl);

        // Build recipient address
        const toAddress = contact.firstName ? `${contact.firstName} ${contact.lastName || ''} <${contact.email}>`.trim() : contact.email;

        // Send email using provider abstraction
        const result = await emailProvider.sendRaw({
            from: `${brand.fromName} <${brand.fromEmail}>`,
            to: toAddress,
            replyTo: brand.replyToEmail || brand.fromEmail,
            subject: emailStep.subject,
            htmlContent: processedHtml,
            textContent: textContent || 'Email content',
            listUnsubscribe: unsubscribeHeaders.listUnsubscribe,
            listUnsubscribePost: unsubscribeHeaders.listUnsubscribePost,
            configurationSet: brand.sesConfigurationSet,
            tags: [
                { Name: 'sequenceId', Value: sequence._id.toString() },
                { Name: 'enrollmentId', Value: enrollment._id.toString() },
                { Name: 'emailOrder', Value: emailOrder.toString() },
                { Name: 'type', Value: 'sequence' },
            ],
        });

        console.log(`Email sent to ${contact.email} via ${emailProvider.getName()}, MessageId: ${result.messageId}`);

        // ===== LOG THE EMAIL SEND =====
        try {
            await logSequenceEmail({
                sequenceId: sequence._id,
                enrollmentId: enrollment._id,
                contactId: contact._id,
                brandId: brand._id,
                userId: sequence.userId,
                email: contact.email,
                emailOrder: emailOrder,
                subject: emailStep.subject,
                status: 'sent',
                messageId: result.messageId,
                metadata: {
                    hasOneClickUnsubscribe: true,
                    provider: emailProvider.getName(),
                },
                sentAt: new Date(),
            });
            console.log(`Logged sequence email send for ${contact.email}`);
        } catch (logError) {
            console.error('Error logging sequence email:', logError);
            // Don't throw - we don't want to fail the job if logging fails
        }

        // Update enrollment
        enrollment.emailsSent.push({
            emailOrder,
            sentAt: new Date(),
            messageId: result.messageId,
            status: 'sent',
        });
        enrollment.currentStep = emailOrder;

        // Check if this was the last email
        const maxOrder = Math.max(...sequence.emails.map((e) => e.order));
        if (emailOrder >= maxOrder) {
            enrollment.status = 'completed';
            enrollment.completedAt = new Date();

            await EmailSequence.updateOne(
                { _id: sequence._id },
                {
                    $inc: {
                        'stats.totalActive': -1,
                        'stats.totalCompleted': 1,
                    },
                }
            );
        } else {
            // Schedule next email
            const nextEmail = sequence.emails.find((e) => e.order === emailOrder + 1);
            if (nextEmail) {
                const delay = calculateDelay(nextEmail.delayAmount, nextEmail.delayUnit);

                await emailSequenceQueue.add(
                    'send-sequence-email',
                    {
                        enrollmentId: enrollment._id.toString(),
                        emailOrder: nextEmail.order,
                    },
                    {
                        delay,
                        jobId: `sequence-${sequence._id}-enrollment-${enrollment._id}-step-${nextEmail.order}`,
                    }
                );

                console.log(`Scheduled next email (step ${nextEmail.order}) in ${delay}ms`);
            }
        }

        await enrollment.save();

        return {
            success: true,
            messageId: result.messageId,
            email: contact.email,
            step: emailOrder,
            provider: emailProvider.getName(),
        };
    } catch (error) {
        console.error(`Error processing sequence email:`, error);
        throw error;
    }
}

// Enroll new contact function
async function enrollNewContact(job) {
    const { contactId, brandId, listId, sequenceId } = job.data;

    try {
        console.log(`[Sequence Worker] Processing enrollment for contact ${contactId} in list ${listId}`);

        const EmailSequence = mongoose.model('EmailSequence');
        const SequenceEnrollment = mongoose.model('SequenceEnrollment');
        const Contact = mongoose.model('Contact');

        // Get contact
        const contact = await Contact.findById(contactId);
        if (!contact || contact.status !== 'active' || contact.isUnsubscribed) {
            console.log(`[Sequence Worker] Contact ${contactId} not eligible for enrollment`);
            return { success: false, message: 'Contact not eligible' };
        }

        // Get sequence (if sequenceId provided, use it; otherwise find all sequences for the list)
        let sequences = [];
        if (sequenceId) {
            const sequence = await EmailSequence.findById(sequenceId);
            if (sequence && sequence.status === 'active') {
                sequences.push(sequence);
            }
        } else {
            // Find all active sequences that have this list in their triggerConfig
            sequences = await EmailSequence.find({
                brandId: new mongoose.Types.ObjectId(brandId),
                status: 'active',
                triggerType: 'contact_list',
                'triggerConfig.contactListIds': new mongoose.Types.ObjectId(listId),
            });
        }

        if (sequences.length === 0) {
            console.log(`[Sequence Worker] No active sequences found for list ${listId}`);
            return { success: false, message: 'No active sequences' };
        }

        console.log(`[Sequence Worker] Found ${sequences.length} sequences to enroll contact in`);

        let enrolledCount = 0;

        for (const sequence of sequences) {
            try {
                // Check if already enrolled
                const existingEnrollment = await SequenceEnrollment.findOne({
                    sequenceId: sequence._id,
                    contactId: new mongoose.Types.ObjectId(contactId),
                });

                if (existingEnrollment) {
                    console.log(`[Sequence Worker] Contact already enrolled in sequence ${sequence.name}`);
                    continue;
                }

                // Verify sequence has emails
                if (!sequence.emails || sequence.emails.length === 0) {
                    console.log(`[Sequence Worker] Sequence ${sequence.name} has no emails, skipping`);
                    continue;
                }

                // Create enrollment
                const enrollment = new SequenceEnrollment({
                    sequenceId: sequence._id,
                    contactId: new mongoose.Types.ObjectId(contactId),
                    brandId: new mongoose.Types.ObjectId(brandId),
                    userId: sequence.userId,
                    status: 'active',
                    currentStep: 0,
                    enrolledAt: new Date(),
                    emailsSent: [],
                });

                await enrollment.save();

                // Update sequence stats
                await EmailSequence.updateOne(
                    { _id: sequence._id },
                    {
                        $inc: {
                            'stats.totalEnrolled': 1,
                            'stats.totalActive': 1,
                        },
                    }
                );

                console.log(`[Sequence Worker] Created enrollment for contact ${contact.email} in sequence ${sequence.name}`);

                // Get first email (sorted by order)
                const sortedEmails = [...sequence.emails].sort((a, b) => a.order - b.order);
                const firstEmail = sortedEmails[0];

                if (firstEmail) {
                    // Calculate delay for first email
                    const delay = calculateDelay(firstEmail.delayAmount, firstEmail.delayUnit);

                    // Schedule first email
                    await emailSequenceQueue.add(
                        'send-sequence-email',
                        {
                            enrollmentId: enrollment._id.toString(),
                            emailOrder: firstEmail.order,
                        },
                        {
                            delay,
                            jobId: `sequence-${sequence._id}-enrollment-${enrollment._id}-step-${firstEmail.order}-${Date.now()}`,
                            attempts: 3,
                            backoff: {
                                type: 'exponential',
                                delay: 5000,
                            },
                        }
                    );

                    console.log(`[Sequence Worker] Scheduled first email for ${contact.email} in ${delay}ms (${firstEmail.delayAmount} ${firstEmail.delayUnit})`);
                }

                enrolledCount++;
            } catch (sequenceError) {
                console.error(`[Sequence Worker] Error enrolling in sequence ${sequence._id}:`, sequenceError);
            }
        }

        return {
            success: true,
            enrolled: enrolledCount,
            contactEmail: contact.email,
        };
    } catch (error) {
        console.error(`[Sequence Worker] Error enrolling new contact:`, error);
        throw error;
    }
}

// Calculate delay in milliseconds
function calculateDelay(delayAmount, delayUnit) {
    const multipliers = {
        minutes: 60 * 1000,
        hours: 60 * 60 * 1000,
        days: 24 * 60 * 60 * 1000,
    };
    return delayAmount * (multipliers[delayUnit] || multipliers.days);
}

// Start worker
async function startWorker() {
    try {
        await connectToDatabase();

        // Process sequence emails
        emailSequenceQueue.process('send-sequence-email', processSequenceEmail);

        // Process new contact enrollments
        emailSequenceQueue.process('enroll-new-contact', enrollNewContact);

        // Handle events
        emailSequenceQueue.on('completed', (job, result) => {
            console.log(`Job ${job.id} completed:`, result);
        });

        emailSequenceQueue.on('failed', (job, error) => {
            console.error(`Job ${job.id} failed:`, error);
        });

        console.log('Email sequence worker started with RFC 8058 one-click unsubscribe support');
    } catch (error) {
        console.error('Failed to start sequence worker:', error);
        process.exit(1);
    }
}

startWorker();

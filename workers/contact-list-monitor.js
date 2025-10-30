// workers/contact-list-monitor.js
require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // Fallback
const mongoose = require('mongoose');
const cron = require('node-cron');
const Redis = require('ioredis');
const Bull = require('bull');

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
        console.error('Contact monitor Redis client error:', err);
    });

    redisClient.on('connect', () => {
        console.log('Contact monitor Redis client connected');
    });

    return redisClient;
};

// Create Bull queue for sequence enrollments
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

// Connect to MongoDB
async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Contact monitor worker connected to MongoDB');

        // Define schemas
        const ContactSchema = new mongoose.Schema(
            {
                email: String,
                firstName: String,
                lastName: String,
                phone: String,
                status: String,
                isUnsubscribed: Boolean,
                listId: mongoose.Schema.Types.ObjectId,
                brandId: mongoose.Schema.Types.ObjectId,
                userId: mongoose.Schema.Types.ObjectId,
                createdAt: Date,
                updatedAt: Date,
            },
            { collection: 'contacts' }
        );

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
            },
            { timestamps: true, collection: 'sequenceenrollments' }
        );

        const ContactListSchema = new mongoose.Schema(
            {
                name: String,
                description: String,
                brandId: mongoose.Schema.Types.ObjectId,
                userId: mongoose.Schema.Types.ObjectId,
                contactCount: Number,
                lastCheckedAt: Date, // Track when we last checked for new contacts
                createdAt: Date,
                updatedAt: Date,
            },
            { collection: 'contactlists' }
        );

        // Register models
        global.Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);
        global.EmailSequence = mongoose.models.EmailSequence || mongoose.model('EmailSequence', EmailSequenceSchema);
        global.SequenceEnrollment = mongoose.models.SequenceEnrollment || mongoose.model('SequenceEnrollment', SequenceEnrollmentSchema);
        global.ContactList = mongoose.models.ContactList || mongoose.model('ContactList', ContactListSchema);

        return true;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

// Check for new contacts in all lists with active sequences
async function checkForNewContacts() {
    try {
        console.log('[Contact Monitor] Starting check for new contacts...');

        const EmailSequence = mongoose.model('EmailSequence');
        const Contact = mongoose.model('Contact');
        const ContactList = mongoose.model('ContactList');
        const SequenceEnrollment = mongoose.model('SequenceEnrollment');

        // Get all active sequences with contact_list trigger type
        const activeSequences = await EmailSequence.find({
            status: 'active',
            triggerType: 'contact_list',
            'triggerConfig.contactListIds': { $exists: true, $ne: [] },
        });

        if (activeSequences.length === 0) {
            console.log('[Contact Monitor] No active sequences with contact_list triggers found');
            return;
        }

        console.log(`[Contact Monitor] Found ${activeSequences.length} active sequences`);

        // Get unique list IDs from all sequences
        const listIdsSet = new Set();
        activeSequences.forEach((seq) => {
            if (seq.triggerConfig && seq.triggerConfig.contactListIds) {
                seq.triggerConfig.contactListIds.forEach((listId) => {
                    listIdsSet.add(listId.toString());
                });
            }
        });

        const uniqueListIds = Array.from(listIdsSet);
        console.log(`[Contact Monitor] Monitoring ${uniqueListIds.length} unique contact lists`);

        let totalNewContactsFound = 0;
        let totalEnrollmentsQueued = 0;

        // Check each list for new contacts
        for (const listId of uniqueListIds) {
            try {
                // Get the contact list
                const contactList = await ContactList.findById(listId);
                if (!contactList) {
                    console.log(`[Contact Monitor] List ${listId} not found, skipping`);
                    continue;
                }

                // Determine the time window to check
                // Default to last 5 minutes if never checked, otherwise use lastCheckedAt
                const checkFrom = contactList.lastCheckedAt || new Date(Date.now() - 5 * 60 * 1000);
                const checkTo = new Date();

                console.log(`[Contact Monitor] Checking list "${contactList.name}" (${listId}) for contacts added since ${checkFrom.toISOString()}`);

                // Find new contacts added since last check
                const newContacts = await Contact.find({
                    listId: new mongoose.Types.ObjectId(listId),
                    status: 'active',
                    isUnsubscribed: { $in: [false, null] },
                    createdAt: {
                        $gte: checkFrom,
                        $lt: checkTo,
                    },
                });

                if (newContacts.length === 0) {
                    console.log(`[Contact Monitor] No new contacts in list "${contactList.name}"`);

                    // Update lastCheckedAt even if no new contacts
                    await ContactList.updateOne({ _id: listId }, { $set: { lastCheckedAt: checkTo } });

                    continue;
                }

                console.log(`[Contact Monitor] Found ${newContacts.length} new contacts in list "${contactList.name}"`);
                totalNewContactsFound += newContacts.length;

                // Find sequences that target this list
                const sequencesForList = activeSequences.filter((seq) => seq.triggerConfig && seq.triggerConfig.contactListIds && seq.triggerConfig.contactListIds.some((id) => id.toString() === listId));

                console.log(`[Contact Monitor] ${sequencesForList.length} sequences target this list`);

                // Enroll each new contact in applicable sequences
                for (const contact of newContacts) {
                    for (const sequence of sequencesForList) {
                        try {
                            // Check if already enrolled
                            const existingEnrollment = await SequenceEnrollment.findOne({
                                sequenceId: sequence._id,
                                contactId: contact._id,
                            });

                            if (existingEnrollment) {
                                console.log(`[Contact Monitor] Contact ${contact.email} already enrolled in sequence "${sequence.name}"`);
                                continue;
                            }

                            // Verify sequence has emails
                            if (!sequence.emails || sequence.emails.length === 0) {
                                console.log(`[Contact Monitor] Sequence "${sequence.name}" has no emails, skipping`);
                                continue;
                            }

                            // Queue enrollment job
                            await emailSequenceQueue.add(
                                'enroll-new-contact',
                                {
                                    contactId: contact._id.toString(),
                                    brandId: contact.brandId.toString(),
                                    listId: listId,
                                    sequenceId: sequence._id.toString(),
                                },
                                {
                                    jobId: `enroll-${contact._id}-${sequence._id}-${Date.now()}`,
                                    attempts: 3,
                                    backoff: {
                                        type: 'exponential',
                                        delay: 3000,
                                    },
                                }
                            );

                            totalEnrollmentsQueued++;
                            console.log(`[Contact Monitor] Queued enrollment for ${contact.email} in sequence "${sequence.name}"`);
                        } catch (enrollError) {
                            console.error(`[Contact Monitor] Error queueing enrollment for contact ${contact.email}:`, enrollError);
                        }
                    }
                }

                // Update lastCheckedAt for this list
                await ContactList.updateOne({ _id: listId }, { $set: { lastCheckedAt: checkTo } });

                console.log(`[Contact Monitor] Updated lastCheckedAt for list "${contactList.name}"`);
            } catch (listError) {
                console.error(`[Contact Monitor] Error processing list ${listId}:`, listError);
            }
        }

        console.log(`[Contact Monitor] Check complete. Found ${totalNewContactsFound} new contacts, queued ${totalEnrollmentsQueued} enrollments`);
    } catch (error) {
        console.error('[Contact Monitor] Error checking for new contacts:', error);
    }
}

// Start the worker
async function startWorker() {
    try {
        await connectToDatabase();

        console.log('[Contact Monitor] Worker started');

        // Run check every 1 minute (changed from 5 minutes for better responsiveness)
        // Cron format: * * * * * means "every minute"
        cron.schedule('* * * * *', async () => {
            console.log('[Contact Monitor] Running scheduled check...');
            await checkForNewContacts();
        });

        // Run an initial check on startup
        console.log('[Contact Monitor] Running initial check...');
        await checkForNewContacts();
    } catch (error) {
        console.error('[Contact Monitor] Failed to start worker:', error);
        process.exit(1);
    }
}

// Cleanup old job data
async function cleanupOldJobs() {
    try {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        await emailSequenceQueue.clean(sevenDaysAgo, 'completed');

        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        await emailSequenceQueue.clean(thirtyDaysAgo, 'failed');

        console.log('[Contact Monitor] Cleaned up old queue jobs');
    } catch (error) {
        console.error('[Contact Monitor] Error cleaning up jobs:', error);
    }
}

// Run cleanup once a day
setInterval(cleanupOldJobs, 24 * 60 * 60 * 1000);

// Start the worker
startWorker();

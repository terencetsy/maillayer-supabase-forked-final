// workers/supabase-sync-worker.js
require('dotenv').config();
const mongoose = require('mongoose');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');
const Bull = require('bull');

// Get Redis URL
function getRedisUrl() {
    return process.env.REDIS_URL || 'redis://localhost:6379';
}

// Use the Redis URL directly
const redisUrl = getRedisUrl();

// Create Redis client for Bull with proper error handling
const createRedisClient = () => {
    const redisClient = new Redis(redisUrl, {
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
    });

    redisClient.on('error', (err) => {
        console.error('Supabase sync worker Redis client error:', err);
    });

    redisClient.on('connect', () => {
        console.log('Supabase sync worker Redis client connected');
    });

    return redisClient;
};

// Create Bull queue for Supabase sync jobs
const supabaseSyncQueue = new Bull('supabase-sync', {
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
        console.log('Supabase sync worker connected to MongoDB');

        // Define schemas
        const IntegrationSchema = new mongoose.Schema(
            {
                name: String,
                type: String,
                userId: mongoose.Schema.Types.ObjectId,
                brandId: mongoose.Schema.Types.ObjectId,
                config: mongoose.Schema.Types.Mixed,
                status: String,
                createdAt: Date,
                updatedAt: Date,
            },
            { collection: 'integrations' }
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
                status: String,
                createdAt: Date,
                updatedAt: Date,
            },
            { collection: 'contacts' }
        );

        const ContactListSchema = new mongoose.Schema(
            {
                name: String,
                description: String,
                brandId: mongoose.Schema.Types.ObjectId,
                userId: mongoose.Schema.Types.ObjectId,
                contactCount: Number,
                createdAt: Date,
                updatedAt: Date,
            },
            { collection: 'contactlists' }
        );

        // Register models
        global.Integration = mongoose.models.Integration || mongoose.model('Integration', IntegrationSchema);
        global.Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);
        global.ContactList = mongoose.models.ContactList || mongoose.model('ContactList', ContactListSchema);

        return true;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

// Process a Supabase sync job
async function processSupabaseSync(job) {
    const { integrationId, syncId } = job.data;
    console.log(`Processing Supabase sync for integration ${integrationId}, sync ${syncId}`);

    try {
        // Get models
        const Integration = mongoose.model('Integration');
        const Contact = mongoose.model('Contact');
        const ContactList = mongoose.model('ContactList');

        // Get integration details
        const integration = await Integration.findById(integrationId);

        if (!integration) {
            throw new Error(`Integration not found: ${integrationId}`);
        }

        if (integration.type !== 'supabase') {
            throw new Error(`Integration is not a Supabase integration: ${integrationId}`);
        }

        // Find the table sync configuration
        const tableSync = integration.config.tableSyncs?.find((sync) => sync.id === syncId);

        if (!tableSync) {
            throw new Error(`Table sync configuration not found: ${syncId}`);
        }

        // Skip if auto-sync is not enabled
        if (!tableSync.autoSync) {
            console.log(`Auto-sync is disabled for table sync ${syncId}, skipping`);
            return { success: false, message: 'Auto-sync is disabled' };
        }

        // Get the contact list ID
        const contactListId = tableSync.contactListId;

        // Verify the list exists
        const contactList = await ContactList.findOne({
            _id: new mongoose.Types.ObjectId(contactListId),
            brandId: integration.brandId,
        });

        if (!contactList) {
            throw new Error(`Contact list not found: ${contactListId}`);
        }

        job.progress(10);

        // Create Supabase client
        const supabaseUrl = integration.config.url;
        const supabaseKey = integration.config.apiKey;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch records from Supabase table
        let { data: records, error, count } = await supabase.from(tableSync.tableName).select('*', { count: 'exact' });

        if (error) {
            throw new Error(`Error fetching data from Supabase: ${error.message}`);
        }

        if (!records) {
            records = [];
        }

        job.progress(30);

        // Initialize counters
        let importedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        // Process records in batches to avoid overwhelming the database
        const BATCH_SIZE = 100;

        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);

            // Create operations for bulk write
            const operations = batch
                .map((record) => {
                    // Skip records without email
                    const emailFieldName = tableSync.mapping.email;
                    if (!emailFieldName || !record[emailFieldName]) {
                        skippedCount++;
                        return null;
                    }

                    const email = record[emailFieldName].toString().trim().toLowerCase();

                    // Basic email validation
                    if (!email.includes('@')) {
                        skippedCount++;
                        return null;
                    }

                    // Get other fields if available
                    const firstNameFieldName = tableSync.mapping.firstName;
                    const lastNameFieldName = tableSync.mapping.lastName;
                    const phoneFieldName = tableSync.mapping.phone;

                    const firstName = firstNameFieldName && record[firstNameFieldName] ? record[firstNameFieldName].toString().trim() : '';
                    const lastName = lastNameFieldName && record[lastNameFieldName] ? record[lastNameFieldName].toString().trim() : '';
                    const phone = phoneFieldName && record[phoneFieldName] ? record[phoneFieldName].toString().trim() : '';

                    // Create contact data
                    const contactData = {
                        email,
                        firstName,
                        lastName,
                        phone,
                        status: 'active',
                        listId: new mongoose.Types.ObjectId(contactListId),
                        brandId: integration.brandId,
                        userId: integration.userId,
                        updatedAt: new Date(),
                    };

                    // Return an upsert operation
                    return {
                        updateOne: {
                            filter: {
                                email,
                                listId: new mongoose.Types.ObjectId(contactListId),
                            },
                            update: {
                                $set: contactData,
                                $setOnInsert: { createdAt: new Date() },
                            },
                            upsert: true,
                        },
                    };
                })
                .filter((op) => op !== null); // Filter out null operations (skipped records)

            // Execute the bulk operation if we have operations
            if (operations.length > 0) {
                try {
                    const bulkResult = await Contact.bulkWrite(operations);
                    importedCount += bulkResult.upsertedCount || 0;
                    updatedCount += bulkResult.modifiedCount || 0;

                    // If a document matched but wasn't modified, count it as skipped
                    skippedCount += bulkResult.matchedCount - bulkResult.modifiedCount;
                } catch (error) {
                    console.error('Error in bulk write operation:', error);
                    throw error;
                }
            }

            job.progress(30 + Math.floor((i / records.length) * 40));
        }

        job.progress(80);

        // Update the lastSyncedAt timestamp and result in the table sync configuration
        const tableSyncs = [...(integration.config.tableSyncs || [])];
        const syncIndex = tableSyncs.findIndex((sync) => sync.id === syncId);

        if (syncIndex !== -1) {
            const now = new Date();
            tableSyncs[syncIndex] = {
                ...tableSyncs[syncIndex],
                lastSyncedAt: now.toISOString(),
                lastSyncResult: {
                    importedCount,
                    updatedCount,
                    skippedCount,
                    totalCount: records.length,
                },
                status: 'success',
            };

            // Create a new config object preserving all existing properties
            const updatedConfig = {
                ...integration.config,
                tableSyncs,
            };

            await Integration.findByIdAndUpdate(integrationId, {
                $set: {
                    config: updatedConfig,
                    updatedAt: now,
                },
            });
        }

        job.progress(90);

        // Update contact count for the list
        const totalContacts = await Contact.countDocuments({
            listId: new mongoose.Types.ObjectId(contactListId),
        });

        await ContactList.updateOne(
            { _id: new mongoose.Types.ObjectId(contactListId) },
            {
                contactCount: totalContacts,
                updatedAt: new Date(),
            }
        );

        job.progress(100);

        console.log(`Supabase sync completed for integration ${integrationId}, sync ${syncId}. Imported: ${importedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`);

        return {
            success: true,
            syncId,
            listId: contactListId.toString(),
            importedCount,
            updatedCount,
            skippedCount,
            totalCount: records.length,
        };
    } catch (error) {
        console.error(`Error processing Supabase sync for integration ${integrationId}, sync ${syncId}:`, error);
        throw error;
    }
}

// Find and queue auto-sync jobs for all Supabase integrations
async function queueSupabaseSyncJobs() {
    try {
        console.log('Checking for Supabase integrations with auto-sync enabled...');

        const Integration = mongoose.model('Integration');

        // Find all Supabase integrations
        const integrations = await Integration.find({
            type: 'supabase',
            status: 'active',
        });

        console.log(`Found ${integrations.length} Supabase integrations`);
        let syncJobsCount = 0;

        // Check each integration for auto-sync configurations
        for (const integration of integrations) {
            const tableSyncs = integration.config.tableSyncs || [];

            // Filter syncs with auto-sync enabled
            const autoSyncs = tableSyncs.filter((sync) => sync.autoSync);

            console.log(`Integration ${integration._id} has ${autoSyncs.length} auto-sync configurations`);

            // Add each auto-sync to the queue
            for (const sync of autoSyncs) {
                console.log(`Queueing sync job for integration ${integration._id}, sync ${sync.id}`);

                await supabaseSyncQueue.add(
                    'sync-supabase',
                    {
                        integrationId: integration._id.toString(),
                        syncId: sync.id,
                    },
                    {
                        jobId: `supabase-sync-${integration._id}-${sync.id}-${Date.now()}`,
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 5000,
                        },
                    }
                );

                syncJobsCount++;
            }
        }

        console.log(`Queued ${syncJobsCount} Supabase sync jobs`);
    } catch (error) {
        console.error('Error queueing Supabase sync jobs:', error);
    }
}

// Start the worker
async function startWorker() {
    try {
        // Connect to database
        await connectToDatabase();

        // Process jobs in the queue
        supabaseSyncQueue.process('sync-supabase', processSupabaseSync);

        // Handle job events
        supabaseSyncQueue.on('completed', (job, result) => {
            console.log(`Supabase sync job ${job.id} completed:`, result);
        });

        supabaseSyncQueue.on('failed', (job, error) => {
            console.error(`Supabase sync job ${job.id} failed:`, error);
        });

        console.log('Supabase sync worker started');

        // Schedule the cron job to run every hour
        cron.schedule('0 * * * *', async () => {
            console.log('Running scheduled Supabase sync...');
            await queueSupabaseSyncJobs();
        });

        // Run an initial check at startup
        await queueSupabaseSyncJobs();
    } catch (error) {
        console.error('Failed to start Supabase sync worker:', error);
        process.exit(1);
    }
}

// Add cleanup routine
async function cleanupOldJobs() {
    try {
        // Remove old completed jobs (older than 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        await supabaseSyncQueue.clean(sevenDaysAgo.getTime(), 'completed');

        // Keep failed jobs longer for debugging (30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        await supabaseSyncQueue.clean(thirtyDaysAgo.getTime(), 'failed');

        console.log('Cleaned up old Supabase sync jobs');
    } catch (error) {
        console.error('Error cleaning up Supabase sync jobs:', error);
    }
}

// Run cleanup once a day
setInterval(cleanupOldJobs, 24 * 60 * 60 * 1000);

// Start the worker
startWorker().catch((error) => {
    console.error('Failed to start worker:', error);
    process.exit(1);
});

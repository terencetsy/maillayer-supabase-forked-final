// workers/google-sheets-sync-worker.js
require('dotenv').config();
const mongoose = require('mongoose');
const cron = require('node-cron');
const { google } = require('googleapis');
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
        console.error('Google Sheets sync worker Redis client error:', err);
    });

    redisClient.on('connect', () => {
        console.log('Google Sheets sync worker Redis client connected');
    });

    return redisClient;
};

// Create Bull queue for Google Sheets sync jobs
const sheetsSyncQueue = new Bull('google-sheets-sync', {
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
        console.log('Google Sheets sync worker connected to MongoDB');

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

// Process a Google Sheets sync job
async function processSheetSync(job) {
    const { integrationId, syncId } = job.data;
    console.log(`Processing Google Sheets sync for integration ${integrationId}, sync ${syncId}`);

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

        if (integration.type !== 'google_sheets') {
            throw new Error(`Integration is not a Google Sheets integration: ${integrationId}`);
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

        // Create Google Sheets API client
        const serviceAccount = integration.config.serviceAccount;
        const auth = new google.auth.JWT({
            email: serviceAccount.client_email,
            key: serviceAccount.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Get sheet information
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: tableSync.spreadsheetId,
            fields: 'sheets.properties',
        });

        const sheet = spreadsheet.data.sheets.find((s) => s.properties.sheetId.toString() === tableSync.sheetId);

        if (!sheet) {
            throw new Error(`Sheet not found in spreadsheet ${tableSync.spreadsheetId}`);
        }

        const sheetTitle = sheet.properties.title;

        job.progress(20);

        // Get all values from the sheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: tableSync.spreadsheetId,
            range: sheetTitle,
        });

        const rows = response.data.values || [];

        if (rows.length === 0) {
            throw new Error('Sheet is empty');
        }

        // Get the header row
        const headerRowIndex = tableSync.headerRow - 1;
        if (headerRowIndex >= rows.length) {
            throw new Error(`Header row ${tableSync.headerRow} does not exist in the sheet`);
        }

        const headers = rows[headerRowIndex];

        job.progress(30);

        // Get column indices for the mapped fields
        const emailColumnIndex = headers.findIndex((header) => header === tableSync.mapping.email);
        const firstNameColumnIndex = tableSync.mapping.firstName ? headers.findIndex((header) => header === tableSync.mapping.firstName) : -1;
        const lastNameColumnIndex = tableSync.mapping.lastName ? headers.findIndex((header) => header === tableSync.mapping.lastName) : -1;
        const phoneColumnIndex = tableSync.mapping.phone ? headers.findIndex((header) => header === tableSync.mapping.phone) : -1;

        if (emailColumnIndex === -1) {
            throw new Error(`Email column '${tableSync.mapping.email}' not found in the sheet`);
        }

        // Process rows
        const dataRows = tableSync.skipHeader ? rows.slice(headerRowIndex + 1) : rows.filter((_, index) => index !== headerRowIndex);

        let importedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        job.progress(40);

        // Process rows in batches to avoid overwhelming the database
        const BATCH_SIZE = 100;

        for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
            const batch = dataRows.slice(i, i + BATCH_SIZE);

            // Create operations for bulk write
            const operations = batch
                .map((row) => {
                    // Skip rows without email
                    if (!row[emailColumnIndex]) {
                        skippedCount++;
                        return null;
                    }

                    const email = row[emailColumnIndex].toString().trim().toLowerCase();

                    // Basic email validation
                    if (!email.includes('@')) {
                        skippedCount++;
                        return null;
                    }

                    // Get other fields if available
                    const firstName = firstNameColumnIndex >= 0 && row[firstNameColumnIndex] ? row[firstNameColumnIndex].toString().trim() : '';
                    const lastName = lastNameColumnIndex >= 0 && row[lastNameColumnIndex] ? row[lastNameColumnIndex].toString().trim() : '';
                    const phone = phoneColumnIndex >= 0 && row[phoneColumnIndex] ? row[phoneColumnIndex].toString().trim() : '';

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
                .filter((op) => op !== null); // Filter out null operations (skipped rows)

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

            job.progress(40 + Math.floor((i / dataRows.length) * 40));
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
                    totalCount: dataRows.length,
                },
            };

            await Integration.findByIdAndUpdate(integrationId, {
                $set: {
                    config: {
                        ...integration.config,
                        tableSyncs,
                    },
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

        console.log(`Google Sheets sync completed for integration ${integrationId}, sync ${syncId}. Imported: ${importedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`);

        return {
            success: true,
            syncId,
            listId: contactListId.toString(),
            importedCount,
            updatedCount,
            skippedCount,
            totalCount: dataRows.length,
        };
    } catch (error) {
        console.error(`Error processing Google Sheets sync for integration ${integrationId}, sync ${syncId}:`, error);
        throw error;
    }
}

// Find and queue auto-sync jobs for all Google Sheets integrations
async function queueSheetsSyncJobs() {
    try {
        console.log('Checking for Google Sheets integrations with auto-sync enabled...');

        const Integration = mongoose.model('Integration');

        // Find all Google Sheets integrations
        const integrations = await Integration.find({
            type: 'google_sheets',
            status: 'active',
        });

        console.log(`Found ${integrations.length} Google Sheets integrations`);
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

                await sheetsSyncQueue.add(
                    'sync-sheets',
                    {
                        integrationId: integration._id.toString(),
                        syncId: sync.id,
                    },
                    {
                        jobId: `sheets-sync-${integration._id}-${sync.id}-${Date.now()}`,
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

        console.log(`Queued ${syncJobsCount} Google Sheets sync jobs`);
    } catch (error) {
        console.error('Error queueing Google Sheets sync jobs:', error);
    }
}

// Start the worker
async function startWorker() {
    try {
        // Connect to database
        await connectToDatabase();

        // Process jobs in the queue
        sheetsSyncQueue.process('sync-sheets', processSheetSync);

        // Handle job events
        sheetsSyncQueue.on('completed', (job, result) => {
            console.log(`Google Sheets sync job ${job.id} completed:`, result);
        });

        sheetsSyncQueue.on('failed', (job, error) => {
            console.error(`Google Sheets sync job ${job.id} failed:`, error);
        });

        console.log('Google Sheets sync worker started');

        // Schedule the cron job to run every hour
        cron.schedule('0 * * * *', async () => {
            console.log('Running scheduled Google Sheets sync...');
            await queueSheetsSyncJobs();
        });

        // Run an initial check at startup
        await queueSheetsSyncJobs();
    } catch (error) {
        console.error('Failed to start Google Sheets sync worker:', error);
        process.exit(1);
    }
}

// Add cleanup routine
async function cleanupOldJobs() {
    try {
        // Remove old completed jobs (older than 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        await sheetsSyncQueue.clean(sevenDaysAgo.getTime(), 'completed');

        // Keep failed jobs longer for debugging (30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        await sheetsSyncQueue.clean(thirtyDaysAgo.getTime(), 'failed');

        console.log('Cleaned up old Google Sheets sync jobs');
    } catch (error) {
        console.error('Error cleaning up Google Sheets sync jobs:', error);
    }
}

// Run cleanup once a day
setInterval(cleanupOldJobs, 24 * 60 * 60 * 1000);

// Start the worker
startWorker().catch((error) => {
    console.error('Failed to start worker:', error);
    process.exit(1);
});

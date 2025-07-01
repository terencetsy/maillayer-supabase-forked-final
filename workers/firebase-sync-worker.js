// workers/firebase-sync-worker.js
require('dotenv').config();
const mongoose = require('mongoose');
const cron = require('node-cron');
const firebaseAdmin = require('firebase-admin');
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
        console.error('Firebase sync worker Redis client error:', err);
    });

    redisClient.on('connect', () => {
        console.log('Firebase sync worker Redis client connected');
    });

    return redisClient;
};

// Create Bull queue for Firebase sync jobs
const firebaseSyncQueue = new Bull('firebase-auth-sync', {
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
        console.log('Firebase sync worker connected to MongoDB');

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

// Firebase apps cache to avoid reinitializing the same app multiple times
const firebaseApps = {};

// Get or initialize Firebase admin app for a specific brand
function getFirebaseApp(brandId, serviceAccount) {
    const appName = `brand-${brandId}`;

    if (firebaseApps[appName]) {
        return firebaseApps[appName];
    }

    try {
        // Try to get existing app
        const app = firebaseAdmin.app(appName);
        firebaseApps[appName] = app;
        return app;
    } catch (error) {
        // App doesn't exist, initialize it
        try {
            const app = firebaseAdmin.initializeApp(
                {
                    credential: firebaseAdmin.credential.cert(serviceAccount),
                    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
                },
                appName
            );

            firebaseApps[appName] = app;
            return app;
        } catch (initError) {
            console.error(`Error initializing Firebase app for brand ${brandId}:`, initError);
            throw initError;
        }
    }
}

// Function to fetch all Firebase Auth users
async function fetchAllFirebaseUsers(auth) {
    const users = [];
    let pageToken;

    try {
        // Firebase returns users in batches with a max of 1000 users per batch
        do {
            const listUsersResult = await auth.listUsers(1000, pageToken);
            users.push(...listUsersResult.users);
            pageToken = listUsersResult.pageToken;
        } while (pageToken);

        return users;
    } catch (error) {
        console.error('Error fetching Firebase users:', error);
        throw error;
    }
}

// Function to sync Firebase users to a contact list
async function syncUsersToContacts(users, listId, brandId, userId, lastSyncedAt) {
    const Contact = mongoose.model('Contact');
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Process users in batches to avoid overwhelming the database
    const BATCH_SIZE = 100;

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE);

        // Process each user in the batch
        const operations = batch
            .map((user) => {
                // Skip users without email
                if (!user.email) {
                    skippedCount++;
                    return null;
                }

                // Skip users that haven't been updated since last sync (if lastSyncedAt exists)
                if (lastSyncedAt && user.metadata && user.metadata.lastRefreshTime) {
                    const lastRefreshTime = new Date(user.metadata.lastRefreshTime);
                    if (lastRefreshTime <= lastSyncedAt) {
                        skippedCount++;
                        return null;
                    }
                }

                // Parse name from displayName
                let firstName = '';
                let lastName = '';

                if (user.displayName) {
                    const nameParts = user.displayName.split(' ');
                    firstName = nameParts[0] || '';
                    lastName = nameParts.slice(1).join(' ') || '';
                }

                // Create base contact data WITHOUT status to preserve existing status
                const baseContactData = {
                    email: user.email.toLowerCase(),
                    firstName,
                    lastName,
                    phone: user.phoneNumber || '',
                    listId: new mongoose.Types.ObjectId(listId),
                    brandId: new mongoose.Types.ObjectId(brandId),
                    userId: new mongoose.Types.ObjectId(userId),
                    updatedAt: new Date(),
                };

                // Build update operations - preserve existing status for existing contacts
                const updateOps = {
                    $set: baseContactData, // Don't include status here to preserve existing values
                    $setOnInsert: {
                        createdAt: new Date(),
                        status: 'active', // Only set status to 'active' for NEW contacts
                    },
                };

                // Only override status in specific cases where Firebase state should take precedence
                if (user.disabled) {
                    // If Firebase user is disabled, mark contact as inactive
                    // This is a legitimate status change we should sync
                    updateOps.$set.status = 'inactive';
                } else if (user.emailVerified === false) {
                    // Optional: You might want to handle unverified emails differently
                    // Uncomment the line below if you want unverified emails to be marked as pending
                    // updateOps.$set.status = 'pending';
                }

                // Return an upsert operation
                return {
                    updateOne: {
                        filter: {
                            email: user.email.toLowerCase(),
                            listId: new mongoose.Types.ObjectId(listId),
                        },
                        update: updateOps,
                        upsert: true,
                    },
                };
            })
            .filter((op) => op !== null); // Filter out null operations (skipped users)

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
    }

    return { importedCount, updatedCount, skippedCount };
}

// Process a single Firebase sync job
async function processFirebaseSync(job) {
    const { integrationId } = job.data;
    console.log(`Processing Firebase sync for integration ${integrationId}`);

    try {
        // Get models
        const Integration = mongoose.model('Integration');
        const ContactList = mongoose.model('ContactList');

        // Get integration details
        const integration = await Integration.findById(integrationId);

        if (!integration) {
            throw new Error(`Integration not found: ${integrationId}`);
        }

        if (integration.type !== 'firebase') {
            throw new Error(`Integration is not a Firebase integration: ${integrationId}`);
        }

        if (!integration.config || !integration.config.serviceAccount) {
            throw new Error(`Firebase service account not found for integration: ${integrationId}`);
        }

        const { serviceAccount, autoSyncEnabled, autoSyncListId, createNewList, newListName, lastSyncedAt } = integration.config;

        // Skip if auto-sync is not enabled
        if (!autoSyncEnabled) {
            console.log(`Auto-sync is disabled for integration ${integrationId}, skipping`);
            return { success: false, message: 'Auto-sync is disabled' };
        }

        // Determine which list to use
        let contactListId;
        let newList = null;

        if (createNewList && newListName) {
            // Create a new contact list
            const contactList = new ContactList({
                name: newListName,
                description: 'Auto-created list for Firebase Auth users',
                brandId: integration.brandId,
                userId: integration.userId,
                contactCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await contactList.save();
            contactListId = contactList._id;
            newList = contactList;

            // Update the integration config to use this list from now on
            integration.config.autoSyncListId = contactListId.toString();
            integration.config.createNewList = false;
            await integration.save();

            console.log(`Created new contact list for Firebase sync: ${contactListId}`);
        } else if (autoSyncListId) {
            // Use existing list
            contactListId = autoSyncListId;

            // Verify the list exists
            const contactList = await ContactList.findOne({
                _id: new mongoose.Types.ObjectId(autoSyncListId),
                brandId: integration.brandId,
            });

            if (!contactList) {
                throw new Error(`Contact list not found: ${autoSyncListId}`);
            }
        } else {
            throw new Error('No contact list specified for sync');
        }

        // Initialize Firebase Admin
        const firebaseApp = getFirebaseApp(integration.brandId, serviceAccount);
        const auth = firebaseAdmin.auth(firebaseApp);

        // Fetch users from Firebase
        const users = await fetchAllFirebaseUsers(auth);
        console.log(`Fetched ${users.length} users from Firebase Auth`);

        job.progress(50);

        // Parse last synced timestamp if available
        const lastSyncTimestamp = lastSyncedAt ? new Date(lastSyncedAt) : null;

        // Sync users to the contact list
        const { importedCount, updatedCount, skippedCount } = await syncUsersToContacts(users, contactListId, integration.brandId, integration.userId, lastSyncTimestamp);

        job.progress(90);

        // Update the lastSyncedAt timestamp in the integration
        const now = new Date();
        integration.config.lastSyncedAt = now;
        await integration.save();

        // Update contact count for the list
        const Contact = mongoose.model('Contact');
        const totalContacts = await Contact.countDocuments({
            listId: contactListId,
        });

        await ContactList.updateOne(
            { _id: contactListId },
            {
                contactCount: totalContacts,
                updatedAt: now,
            }
        );

        job.progress(100);

        console.log(`Firebase Auth sync completed for integration ${integrationId}. Imported: ${importedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`);

        return {
            success: true,
            listId: contactListId.toString(),
            newList: newList
                ? {
                      _id: newList._id.toString(),
                      name: newList.name,
                      contactCount: totalContacts,
                  }
                : null,
            importedCount,
            updatedCount,
            skippedCount,
            totalCount: users.length,
            syncedAt: now,
        };
    } catch (error) {
        console.error(`Error processing Firebase sync for integration ${integrationId}:`, error);
        throw error;
    }
}

// Find and queue auto-sync jobs for all Firebase integrations with auto-sync enabled
async function queueFirebaseSyncJobs() {
    try {
        console.log('Checking for Firebase integrations with auto-sync enabled...');

        const Integration = mongoose.model('Integration');

        // Find all firebase integrations with auto-sync enabled
        const integrations = await Integration.find({
            type: 'firebase',
            'config.autoSyncEnabled': true,
            status: 'active',
        });

        console.log(`Found ${integrations.length} Firebase integrations with auto-sync enabled`);

        // Add each integration to the queue
        for (const integration of integrations) {
            console.log(`Queueing sync job for integration ${integration._id}`);

            await firebaseSyncQueue.add(
                'sync-firebase-auth',
                {
                    integrationId: integration._id.toString(),
                },
                {
                    jobId: `firebase-sync-${integration._id}-${Date.now()}`,
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 5000,
                    },
                }
            );
        }

        console.log('Finished queueing Firebase sync jobs');
    } catch (error) {
        console.error('Error queueing Firebase sync jobs:', error);
    }
}

// Start the worker
async function startWorker() {
    try {
        // Connect to database
        await connectToDatabase();

        // Process jobs in the queue
        firebaseSyncQueue.process('sync-firebase-auth', processFirebaseSync);

        // Handle job events
        firebaseSyncQueue.on('completed', (job, result) => {
            console.log(`Firebase sync job ${job.id} completed:`, result);
        });

        firebaseSyncQueue.on('failed', (job, error) => {
            console.error(`Firebase sync job ${job.id} failed:`, error);
        });

        console.log('Firebase Auth sync worker started');

        // Schedule the cron job to run every hour
        cron.schedule('0 * * * *', async () => {
            console.log('Running scheduled Firebase Auth sync...');
            await queueFirebaseSyncJobs();
        });

        // Run an initial check at startup
        await queueFirebaseSyncJobs();
    } catch (error) {
        console.error('Failed to start Firebase sync worker:', error);
        process.exit(1);
    }
}

// Add cleanup routine
async function cleanupOldJobs() {
    try {
        // Remove old completed jobs (older than 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        await firebaseSyncQueue.clean(sevenDaysAgo.getTime(), 'completed');

        // Keep failed jobs longer for debugging (30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        await firebaseSyncQueue.clean(thirtyDaysAgo.getTime(), 'failed');

        console.log('Cleaned up old Firebase sync jobs');
    } catch (error) {
        console.error('Error cleaning up Firebase sync jobs:', error);
    }
}

// Run cleanup once a day
setInterval(cleanupOldJobs, 24 * 60 * 60 * 1000);

// Start the worker
startWorker().catch((error) => {
    console.error('Failed to start worker:', error);
    process.exit(1);
});

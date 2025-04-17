// src/pages/api/brands/[id]/integrations/firebase/sync.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getIntegrationByType, updateIntegration } from '@/services/integrationService';
import { admin } from '@/lib/firebase-admin';
import connectToDatabase from '@/lib/mongodb';
import Contact from '@/models/Contact';
import ContactList from '@/models/ContactList';
import mongoose from 'mongoose';

export default async function handler(req, res) {
    // Check if method is POST
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Authenticate the user
        const session = await getServerSession(req, res, authOptions);
        if (!session) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { brandId } = req.query;
        const { integrationId, listId, createNewList, newListName } = req.body;

        // Validate the request
        if (!brandId) {
            return res.status(400).json({ message: 'Brand ID is required' });
        }

        // Connect to database
        await connectToDatabase();

        // Get the integration
        const integration = await getIntegrationByType('firebase', brandId, session.user.id);

        if (!integration) {
            return res.status(404).json({ message: 'Firebase integration not found' });
        }

        // Initialize Firebase Admin SDK with the service account
        const serviceAccount = integration.config.serviceAccount;
        if (!serviceAccount) {
            return res.status(400).json({ message: 'Firebase service account configuration is missing' });
        }

        // Initialize Firebase Admin
        let firebaseApp;
        let auth;

        try {
            // Try to get the existing app
            firebaseApp = admin.app(`brand-${brandId}`);
            auth = admin.auth(firebaseApp);
        } catch (error) {
            // App doesn't exist, initialize it
            try {
                firebaseApp = admin.initializeApp(
                    {
                        credential: admin.credential.cert(serviceAccount),
                        databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
                    },
                    `brand-${brandId}`
                );

                auth = admin.auth(firebaseApp);
            } catch (initError) {
                console.error('Error initializing Firebase app:', initError);
                return res.status(500).json({ message: 'Failed to initialize Firebase: ' + initError.message });
            }
        }

        // Determine which list to use - create new or use existing
        let contactListId;
        let newList = null;

        if (createNewList && newListName) {
            // Create a new contact list
            const contactList = new ContactList({
                name: newListName,
                description: 'Auto-created list for Firebase Auth users',
                brandId: new mongoose.Types.ObjectId(brandId),
                userId: new mongoose.Types.ObjectId(session.user.id),
                contactCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await contactList.save();
            contactListId = contactList._id;
            newList = contactList;
        } else if (listId) {
            // Use existing list
            contactListId = listId;

            // Verify the list exists and belongs to this brand
            const contactList = await ContactList.findOne({
                _id: new mongoose.Types.ObjectId(listId),
                brandId: new mongoose.Types.ObjectId(brandId),
                userId: new mongoose.Types.ObjectId(session.user.id),
            });

            if (!contactList) {
                return res.status(404).json({ message: 'Contact list not found' });
            }
        } else {
            return res.status(400).json({ message: 'Either listId or createNewList with newListName must be provided' });
        }

        // Check if we have a last synced timestamp to only get new/updated users
        const lastSyncedAt = integration.config.lastSyncedAt ? new Date(integration.config.lastSyncedAt) : null;

        // Fetch users from Firebase
        const users = await fetchAllFirebaseUsers(auth);

        // Sync users to the contact list
        const { importedCount, updatedCount, skippedCount } = await syncUsersToContacts(users, contactListId, brandId, session.user.id, lastSyncedAt);

        // Update the lastSyncedAt timestamp in the integration
        const now = new Date();
        await updateIntegration(integration._id, brandId, session.user.id, {
            config: {
                ...integration.config,
                lastSyncedAt: now,
                // Store auto-sync configuration if it's a manual sync from the UI
                autoSyncEnabled: integration.config.autoSyncEnabled ?? false,
                autoSyncListId: contactListId.toString(),
                createNewList: false,
                newListName: '',
            },
        });

        // Update contact count for the list
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

        // Return success response
        return res.status(200).json({
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
        });
    } catch (error) {
        console.error('Error syncing Firebase users:', error);
        return res.status(500).json({ message: 'Server error: ' + error.message });
    }
}

// Function to fetch all users from Firebase Auth
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

// Function to sync Firebase users to contact list
async function syncUsersToContacts(users, listId, brandId, userId, lastSyncedAt) {
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

                // Parse name from displayName
                let firstName = '';
                let lastName = '';

                if (user.displayName) {
                    const nameParts = user.displayName.split(' ');
                    firstName = nameParts[0] || '';
                    lastName = nameParts.slice(1).join(' ') || '';
                }

                // Create contact data
                const contactData = {
                    email: user.email.toLowerCase(),
                    firstName,
                    lastName,
                    phone: user.phoneNumber || '',
                    status: user.disabled ? 'inactive' : 'active',
                    listId: new mongoose.Types.ObjectId(listId),
                    brandId: new mongoose.Types.ObjectId(brandId),
                    userId: new mongoose.Types.ObjectId(userId),
                    updatedAt: new Date(),
                };

                // Return an upsert operation
                return {
                    updateOne: {
                        filter: {
                            email: user.email.toLowerCase(),
                            listId: new mongoose.Types.ObjectId(listId),
                        },
                        update: contactData,
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

import { getUserFromRequest } from '@/lib/supabase';
import { getIntegrationByType, updateIntegration } from '@/services/integrationService';
import { admin } from '@/lib/firebase-admin';
import { contactsDb } from '@/lib/db/contacts';
import { contactListsDb } from '@/lib/db/contactLists';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    // Check if method is POST
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { user } = await getUserFromRequest(req, res);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { brandId } = req.query;
        const { integrationId, listId, createNewList, newListName } = req.body;

        // Validate the request
        if (!brandId) {
            return res.status(400).json({ message: 'Brand ID is required' });
        }

        // Check permission
        const authCheck = await checkBrandPermission(brandId, user.id, PERMISSIONS.EDIT_INTEGRATIONS);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        // Get the integration
        const integration = await getIntegrationByType('firebase', brandId, user.id);

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
            newList = await contactListsDb.create(brandId, user.id, {
                name: newListName,
                description: 'Auto-created list for Firebase Auth users',
            });
            contactListId = newList.id;
        } else if (listId) {
            // Use existing list
            contactListId = listId;

            // Verify the list exists and belongs to this brand
            const contactList = await contactListsDb.getById(listId);
            if (!contactList || contactList.brand_id !== brandId) {
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
        const { importedCount, updatedCount, skippedCount } = await syncUsersToContacts(users, contactListId, brandId, user.id, lastSyncedAt);

        // Update the lastSyncedAt timestamp in the integration
        const now = new Date();
        await updateIntegration(integration.id, brandId, user.id, {
            config: {
                ...integration.config,
                lastSyncedAt: now,
                // Store auto-sync configuration if it's a manual sync from the UI
                autoSyncEnabled: integration.config.autoSyncEnabled ?? false,
                autoSyncListId: contactListId,
                createNewList: false,
                newListName: '',
            },
        });

        // Update contact count for the list
        const totalContacts = await contactsDb.countByListId(contactListId);
        await contactListsDb.update(contactListId, { contact_count: totalContacts });

        // Return success response
        return res.status(200).json({
            success: true,
            listId: contactListId.toString(),
            newList: newList
                ? {
                    id: newList.id,
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
        const contactsToUpsert = [];

        batch.forEach((user) => {
            // Skip users without email
            if (!user.email) {
                skippedCount++;
                return;
            }

            // Parse name from displayName
            let firstName = '';
            let lastName = '';

            if (user.displayName) {
                const nameParts = user.displayName.split(' ');
                firstName = nameParts[0] || '';
                lastName = nameParts.slice(1).join(' ') || '';
            }

            const contactData = {
                brand_id: brandId,
                email: user.email.toLowerCase(),
                first_name: firstName,
                last_name: lastName,
                phone: user.phoneNumber || '',
                user_id: userId,
                updated_at: new Date(),
                status: user.disabled ? 'unsubscribed' : 'active'
            };

            contactsToUpsert.push(contactData);
        });

        if (contactsToUpsert.length > 0) {
            const upsertedData = await contactsDb.bulkUpsert(contactsToUpsert);
            if (upsertedData) {
                const contactIds = upsertedData.map(c => c.id);
                importedCount += contactIds.length;
                await contactsDb.bulkAddToList(contactIds, listId);
            }
        }
    }

    return { importedCount, updatedCount, skippedCount };
}

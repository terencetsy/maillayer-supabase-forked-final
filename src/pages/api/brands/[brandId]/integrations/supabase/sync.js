import { getUserFromRequest } from '@/lib/supabase';
import { getIntegrationByType, updateIntegration } from '@/services/integrationService';
import { createClient } from '@supabase/supabase-js';
import { contactsDb } from '@/lib/db/contacts';
import { contactListsDb } from '@/lib/db/contactLists';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { user } = await getUserFromRequest(req, res);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { brandId } = req.query;
        const { syncId } = req.body;

        // Validate input
        if (!syncId) {
            return res.status(400).json({ message: 'Sync ID is required' });
        }

        // Check permission
        const authCheck = await checkBrandPermission(brandId, user.id, PERMISSIONS.EDIT_INTEGRATIONS);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        // Get the Supabase integration
        const integration = await getIntegrationByType('supabase', brandId, user.id);
        if (!integration) {
            return res.status(404).json({ message: 'Supabase integration not found' });
        }

        // Find the table sync configuration
        const tableSync = integration.config.tableSyncs?.find((sync) => sync.id === syncId);

        if (!tableSync) {
            return res.status(404).json({ message: 'Table sync configuration not found' });
        }

        // Initialize counters
        let importedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        // Handle creating a new list if needed
        let contactListId;
        let newList = null;

        if (tableSync.createNewList && tableSync.newListName) {
            // Create a new contact list
            newList = await contactListsDb.create(brandId, user.id, {
                name: tableSync.newListName,
                description: `Auto-created list for Supabase sync: ${tableSync.name}`,
            });
            contactListId = newList.id;

            // Update the sync config to use this list from now on
            const tableSyncs = [...(integration.config.tableSyncs || [])];
            const syncIndex = tableSyncs.findIndex((sync) => sync.id === syncId);

            if (syncIndex !== -1) {
                tableSyncs[syncIndex] = {
                    ...tableSyncs[syncIndex],
                    contactListId: contactListId,
                    createNewList: false,
                    newListName: '',
                };

                // Create a new config object preserving all existing properties
                const updatedConfig = {
                    ...integration.config,
                    tableSyncs,
                };

                await updateIntegration(integration.id, brandId, user.id, {
                    config: updatedConfig,
                });
            }
        } else {
            contactListId = tableSync.contactListId;

            // Verify the list exists
            const contactList = await contactListsDb.getById(contactListId);
            if (!contactList || contactList.brand_id !== brandId) {
                return res.status(404).json({ message: 'Contact list not found' });
            }
        }

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

        // Process records in batches to avoid overwhelming the database
        const BATCH_SIZE = 100;
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);
            const contactsToUpsert = [];

            batch.forEach((record) => {
                // Skip records without email
                const emailFieldName = tableSync.mapping.email;
                if (!emailFieldName || !record[emailFieldName]) {
                    skippedCount++;
                    return;
                }

                const email = record[emailFieldName].toString().trim().toLowerCase();

                // Basic email validation
                if (!email.includes('@')) {
                    skippedCount++;
                    return;
                }

                // Get other fields if available
                const firstNameFieldName = tableSync.mapping.firstName;
                const lastNameFieldName = tableSync.mapping.lastName;
                const phoneFieldName = tableSync.mapping.phone;

                const firstName = firstNameFieldName && record[firstNameFieldName] ? record[firstNameFieldName].toString().trim() : '';
                const lastName = lastNameFieldName && record[lastNameFieldName] ? record[lastNameFieldName].toString().trim() : '';
                const phone = phoneFieldName && record[phoneFieldName] ? record[phoneFieldName].toString().trim() : '';

                contactsToUpsert.push({
                    brand_id: brandId,
                    email: email,
                    first_name: firstName,
                    last_name: lastName,
                    phone: phone,
                    user_id: user.id,
                    updated_at: new Date(),
                    status: 'active'
                });
            });

            if (contactsToUpsert.length > 0) {
                const upsertedData = await contactsDb.bulkUpsert(contactsToUpsert);
                if (upsertedData) {
                    const contactIds = upsertedData.map(c => c.id);
                    importedCount += contactIds.length;

                    await contactsDb.bulkAddToList(contactIds, contactListId);
                }
            }
        }

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
                    updatedCount: 0,
                    skippedCount,
                    totalCount: records.length,
                },
                status: 'success', // Make sure we update the status
            };

            // Create a new config object preserving all existing properties
            const updatedConfig = {
                ...integration.config,
                tableSyncs,
            };

            await updateIntegration(integration.id, brandId, user.id, {
                config: updatedConfig,
            });
        }

        // Update contact count for the list
        const totalContacts = await contactsDb.countByListId(contactListId);
        await contactListsDb.update(contactListId, { contact_count: totalContacts });

        return res.status(200).json({
            success: true,
            syncId,
            listId: contactListId,
            newList: newList ? {
                id: newList.id,
                name: newList.name,
                contactCount: totalContacts
            } : null,
            importedCount,
            updatedCount: 0,
            skippedCount,
            totalCount: records.length
        });

    } catch (error) {
        console.error('Error syncing Supabase data:', error);
        return res.status(500).json({ message: 'Error syncing data: ' + error.message });
    }
}

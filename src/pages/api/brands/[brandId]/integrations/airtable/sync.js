import { getUserFromRequest } from '@/lib/supabase';
import { getIntegrationByType, updateIntegration } from '@/services/integrationService';
import axios from 'axios';
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

        if (!brandId || !syncId) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        // Check permission - sync is an edit action on integrations/contacts
        const authCheck = await checkBrandPermission(brandId, user.id, PERMISSIONS.EDIT_INTEGRATIONS);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        // Get the Airtable integration
        const integration = await getIntegrationByType('airtable', brandId, user.id);
        if (!integration) {
            return res.status(404).json({ message: 'Airtable integration not found' });
        }

        // Get the API key
        const apiKey = integration.config.apiKey;
        if (!apiKey) {
            return res.status(400).json({ message: 'Airtable API key not configured' });
        }

        // Find the table sync configuration
        const tableSync = integration.config.tableSyncs?.find((sync) => sync.id === syncId);

        if (!tableSync) {
            return res.status(404).json({ message: 'Table sync configuration not found' });
        }

        // Initialize counters
        let importedCount = 0;
        let updatedCount = 0; // Hard to track exact updates vs inserts in simple upsert, will approximate
        let skippedCount = 0;

        // Handle creating a new list if needed
        let contactListId;
        let newList = null;

        if (tableSync.createNewList && tableSync.newListName) {
            // Create a new contact list
            newList = await contactListsDb.create(brandId, user.id, {
                name: tableSync.newListName,
                description: `Auto-created list for Airtable sync: ${tableSync.name}`,
            });

            contactListId = newList.id;

            // Update the sync config to use this list from now on
            const syncIndex = integration.config.tableSyncs.findIndex((sync) => sync.id === syncId);

            if (syncIndex !== -1) {
                // Update in memory
                tableSync.contactListId = contactListId;
                tableSync.createNewList = false;
                tableSync.newListName = '';
                integration.config.tableSyncs[syncIndex] = tableSync;

                // Update integration in DB
                // We use updateIntegration service which handles config merge?
                // The service we saw earlier does a shallow merge or replacement of updateData.
                // We should be careful. `updateIntegration` in service spreads updates.
                // We should pass the FULL updated config.
                await updateIntegration(integration.id, brandId, user.id, {
                    config: integration.config
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

        // Fetch records from Airtable
        let allRecords = [];
        let offset = null;

        do {
            const url = `https://api.airtable.com/v0/${tableSync.baseId}/${tableSync.tableId}`;
            const params = {
                pageSize: 100,
                returnFieldsByFieldId: true,
            };

            if (offset) {
                params.offset = offset;
            }

            const response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                params,
            });
            allRecords = [...allRecords, ...response.data.records];
            offset = response.data.offset || null;
        } while (offset);

        // Process records in batches
        const BATCH_SIZE = 100;
        for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
            const batch = allRecords.slice(i, i + BATCH_SIZE);
            const contactsToUpsert = [];

            batch.forEach((record) => {
                const fields = record.fields;

                // Skip records without email
                const emailField = tableSync.mapping.email;
                if (!emailField || !fields[emailField]) {
                    skippedCount++;
                    return;
                }

                const email = fields[emailField].toString().trim().toLowerCase();

                // Basic email validation
                if (!email.includes('@')) {
                    skippedCount++;
                    return;
                }

                // Get other fields
                const firstNameField = tableSync.mapping.firstName;
                const lastNameField = tableSync.mapping.lastName;
                const phoneField = tableSync.mapping.phone;

                const firstName = firstNameField && fields[firstNameField] ? fields[firstNameField].toString().trim() : '';
                const lastName = lastNameField && fields[lastNameField] ? fields[lastNameField].toString().trim() : '';
                const phone = phoneField && fields[phoneField] ? fields[phoneField].toString().trim() : '';

                contactsToUpsert.push({
                    brand_id: brandId,
                    email: email,
                    first_name: firstName,
                    last_name: lastName,
                    phone: phone,
                    user_id: user.id,
                    updated_at: new Date(),
                    status: 'active' // Default status
                });
            });

            if (contactsToUpsert.length > 0) {
                // Upsert contacts
                const upsertedData = await contactsDb.bulkUpsert(contactsToUpsert);

                if (upsertedData) {
                    const contactIds = upsertedData.map(c => c.id);
                    importedCount += contactIds.length; // Approximate

                    // Add to list
                    await contactsDb.bulkAddToList(contactIds, contactListId);
                }
            }
        }

        // Update sync status
        const syncIndex = integration.config.tableSyncs.findIndex((sync) => sync.id === syncId);
        const now = new Date();

        if (syncIndex !== -1) {
            integration.config.tableSyncs[syncIndex].lastSyncedAt = now.toISOString();
            integration.config.tableSyncs[syncIndex].status = 'success';
            integration.config.tableSyncs[syncIndex].lastSyncResult = {
                importedCount,
                updatedCount: 0, // Supabase upsert makes it hard to distinguish update vs insert without more logic
                skippedCount,
                totalCount: allRecords.length
            };

            await updateIntegration(integration.id, brandId, user.id, {
                config: integration.config
            });
        }

        // Update list count
        // We can just trigger a recalc or let the UI fetch it.
        // Assuming we rely on `countByListId` helper or similar.
        // If we want to store it:
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
            totalCount: allRecords.length
        });

    } catch (error) {
        console.error('Error syncing Airtable data:', error);
        return res.status(500).json({ message: 'Error syncing data: ' + error.message });
    }
}

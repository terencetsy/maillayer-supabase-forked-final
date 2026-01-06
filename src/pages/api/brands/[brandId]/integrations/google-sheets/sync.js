import { getUserFromRequest } from '@/lib/supabase';
import { getIntegrationByType, updateIntegration } from '@/services/integrationService';
import { google } from 'googleapis';
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

        // Get the Google Sheets integration
        const integration = await getIntegrationByType('google_sheets', brandId, user.id);
        if (!integration) {
            return res.status(404).json({ message: 'Google Sheets integration not found' });
        }

        // Find the table sync configuration
        const tableSync = integration.config.tableSyncs?.find((sync) => sync.id === syncId);

        if (!tableSync) {
            return res.status(404).json({ message: 'Table sync configuration not found' });
        }

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
            return res.status(404).json({ message: 'Sheet not found' });
        }

        const sheetTitle = sheet.properties.title;

        // Get all values from the sheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: tableSync.spreadsheetId,
            range: sheetTitle,
        });

        const rows = response.data.values || [];

        if (rows.length === 0) {
            return res.status(400).json({ message: 'Sheet is empty' });
        }

        // Get the header row
        const headerRowIndex = tableSync.headerRow - 1;
        if (headerRowIndex >= rows.length) {
            return res.status(400).json({ message: `Header row ${tableSync.headerRow} does not exist in the sheet` });
        }

        const headers = rows[headerRowIndex];

        // Get column indices for the mapped fields
        const emailColumnIndex = headers.findIndex((header) => header === tableSync.mapping.email);
        const firstNameColumnIndex = tableSync.mapping.firstName ? headers.findIndex((header) => header === tableSync.mapping.firstName) : -1;
        const lastNameColumnIndex = tableSync.mapping.lastName ? headers.findIndex((header) => header === tableSync.mapping.lastName) : -1;
        const phoneColumnIndex = tableSync.mapping.phone ? headers.findIndex((header) => header === tableSync.mapping.phone) : -1;

        if (emailColumnIndex === -1) {
            return res.status(400).json({ message: `Email column '${tableSync.mapping.email}' not found in the sheet` });
        }

        // Process rows
        const dataRows = tableSync.skipHeader ? rows.slice(headerRowIndex + 1) : rows.filter((_, index) => index !== headerRowIndex);

        // Initialize counters
        let importedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        // Handle creating a new list if needed
        let contactListId;
        let newList = null;

        if (tableSync.createNewList && tableSync.newListName) {
            console.log('### creating new contact list...');
            // Create a new contact list
            newList = await contactListsDb.create(brandId, user.id, {
                name: tableSync.newListName,
                description: `Auto-created list for Google Sheets sync: ${tableSync.name}`,
            });
            contactListId = newList.id;
            console.log('Created new contact list with ID:', contactListId);

            // Update the sync config using updateIntegration
            const syncIndex = integration.config.tableSyncs.findIndex((sync) => sync.id === syncId);
            console.log('Sync index:', syncIndex);

            if (syncIndex !== -1) {
                // Update in memory
                tableSync.contactListId = contactListId;
                tableSync.createNewList = false;
                tableSync.newListName = '';
                integration.config.tableSyncs[syncIndex] = tableSync;

                // Update integration in DB
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

        // Process rows in batches to avoid overwhelming the database
        const BATCH_SIZE = 100;

        for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
            const batch = dataRows.slice(i, i + BATCH_SIZE);
            const contactsToUpsert = [];

            batch.forEach((row) => {
                // Skip rows without email
                if (!row || !row[emailColumnIndex]) {
                    skippedCount++;
                    return;
                }

                const email = row[emailColumnIndex].toString().trim().toLowerCase();

                // Basic email validation
                if (!email.includes('@')) {
                    skippedCount++;
                    return;
                }

                // Get other fields if available
                const firstName = firstNameColumnIndex >= 0 && row[firstNameColumnIndex] ? row[firstNameColumnIndex].toString().trim() : '';
                const lastName = lastNameColumnIndex >= 0 && row[lastNameColumnIndex] ? row[lastNameColumnIndex].toString().trim() : '';
                const phone = phoneColumnIndex >= 0 && row[phoneColumnIndex] ? row[phoneColumnIndex].toString().trim() : '';

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
        const now = new Date();

        // Find the sync index again to make sure we have the latest info
        const syncIndex = integration.config.tableSyncs.findIndex((sync) => sync.id === syncId);

        if (syncIndex !== -1) {
            integration.config.tableSyncs[syncIndex].lastSyncedAt = now.toISOString();
            integration.config.tableSyncs[syncIndex].status = 'success';
            integration.config.tableSyncs[syncIndex].lastSyncResult = {
                importedCount,
                updatedCount: 0,
                skippedCount,
                totalCount: dataRows.length
            };

            await updateIntegration(integration.id, brandId, user.id, {
                config: integration.config
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
            totalCount: dataRows.length
        });

    } catch (error) {
        console.error('Error syncing Google Sheets data:', error);
        return res.status(500).json({ message: 'Error syncing data: ' + error.message });
    }
}

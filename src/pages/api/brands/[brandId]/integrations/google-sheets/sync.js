// src/pages/api/brands/[id]/integrations/google-sheets/sync.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getIntegrationByType } from '@/services/integrationService';
import { google } from 'googleapis';
import connectToDatabase from '@/lib/mongodb';
import Contact from '@/models/Contact';
import ContactList from '@/models/ContactList';
import mongoose from 'mongoose';
import Integration from '@/models/Integration'; // Add this import

export default async function handler(req, res) {
    // Only allow POST requests
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
        const { syncId } = req.body;

        // Validate input
        if (!syncId) {
            return res.status(400).json({ message: 'Sync ID is required' });
        }

        // Connect to database
        await connectToDatabase();

        // Get the Google Sheets integration
        const integration = await getIntegrationByType('google_sheets', brandId, session.user.id);
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
            const contactList = new ContactList({
                name: tableSync.newListName,
                description: `Auto-created list for Google Sheets sync: ${tableSync.name}`,
                brandId: new mongoose.Types.ObjectId(brandId),
                userId: new mongoose.Types.ObjectId(session.user.id),
                contactCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await contactList.save();
            contactListId = contactList._id;
            newList = contactList;
            console.log('Created new contact list with ID:', contactListId.toString());

            // Update the sync config using direct MongoDB update
            const syncIndex = integration.config.tableSyncs.findIndex((sync) => sync.id === syncId);
            console.log('Sync index:', syncIndex);

            if (syncIndex !== -1) {
                // Create the update path for this specific sync in the array
                const updatePath = `config.tableSyncs.${syncIndex}`;

                // Create a copy of the sync with updated values
                const updatedSync = {
                    ...integration.config.tableSyncs[syncIndex],
                    contactListId: contactListId.toString(),
                    createNewList: false,
                    newListName: '',
                };

                console.log('Updated sync:', updatedSync);

                try {
                    // Perform direct MongoDB update
                    const updateResult = await Integration.updateOne({ _id: integration._id }, { $set: { [updatePath]: updatedSync } });

                    console.log('MongoDB update result:', updateResult);

                    if (updateResult.modifiedCount === 0) {
                        console.log('WARNING: Integration update did not modify any documents');
                    }
                } catch (updateError) {
                    console.error('Error updating integration with new contact list:', updateError);
                    // Continue with the sync even if the update fails
                }
            }
        } else {
            contactListId = tableSync.contactListId;

            // Verify the list exists
            const contactList = await ContactList.findOne({
                _id: new mongoose.Types.ObjectId(contactListId),
                brandId: new mongoose.Types.ObjectId(brandId),
                userId: new mongoose.Types.ObjectId(session.user.id),
            });

            if (!contactList) {
                return res.status(404).json({ message: 'Contact list not found' });
            }
        }

        // Process rows in batches to avoid overwhelming the database
        const BATCH_SIZE = 100;

        for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
            const batch = dataRows.slice(i, i + BATCH_SIZE);

            // Create operations for bulk write
            const operations = batch
                .map((row) => {
                    // Skip rows without email
                    if (!row || !row[emailColumnIndex]) {
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
                        brandId: new mongoose.Types.ObjectId(brandId),
                        userId: new mongoose.Types.ObjectId(session.user.id),
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
        }

        // Update the lastSyncedAt timestamp and result in the table sync configuration
        const now = new Date();

        // Find the sync index again to make sure we have the latest info
        const syncIndex = integration.config.tableSyncs.findIndex((sync) => sync.id === syncId);

        if (syncIndex !== -1) {
            // Create the update path for this specific sync in the array
            const updatePath = `config.tableSyncs.${syncIndex}`;

            // Update the sync status and results
            const updateData = {
                [`${updatePath}.lastSyncedAt`]: now.toISOString(),
                [`${updatePath}.status`]: 'success',
                [`${updatePath}.lastSyncResult`]: {
                    importedCount,
                    updatedCount,
                    skippedCount,
                    totalCount: dataRows.length,
                },
            };

            // Update the integration with sync results
            console.log('Updating integration with sync results:', JSON.stringify(updateData));

            try {
                const updateResult = await Integration.updateOne({ _id: integration._id }, { $set: updateData });

                console.log('Sync results update result:', updateResult);
            } catch (updateError) {
                console.error('Error updating integration with sync results:', updateError);
                // Continue with the response even if the update fails
            }
        }

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

        return res.status(200).json({
            success: true,
            syncId,
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
            totalCount: dataRows.length,
        });
    } catch (error) {
        console.error('Error syncing Google Sheets data:', error);
        return res.status(500).json({ message: 'Error syncing data: ' + error.message });
    }
}

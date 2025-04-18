// src/pages/api/brands/[id]/integrations/airtable/sync.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getIntegrationByType, updateIntegration } from '@/services/integrationService';
import axios from 'axios';
import connectToDatabase from '@/lib/mongodb';
import Contact from '@/models/Contact';
import ContactList from '@/models/ContactList';
import mongoose from 'mongoose';

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

        // Get the Airtable integration
        const integration = await getIntegrationByType('airtable', brandId, session.user.id);
        if (!integration) {
            return res.status(404).json({ message: 'Airtable integration not found' });
        }

        // Get the API key from the integration
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
        let updatedCount = 0;
        let skippedCount = 0;

        // Handle creating a new list if needed
        let contactListId;
        let newList = null;
        console.log(tableSync);
        if (tableSync.createNewList && tableSync.newListName) {
            // Create a new contact list
            const contactList = new ContactList({
                name: tableSync.newListName,
                description: `Auto-created list for Airtable sync: ${tableSync.name}`,
                brandId: new mongoose.Types.ObjectId(brandId),
                userId: new mongoose.Types.ObjectId(session.user.id),
                contactCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await contactList.save();
            contactListId = contactList._id;
            newList = contactList;

            // Update the sync config to use this list from now on
            const tableSyncs = [...(integration.config.tableSyncs || [])];
            const syncIndex = tableSyncs.findIndex((sync) => sync.id === syncId);

            if (syncIndex !== -1) {
                tableSyncs[syncIndex] = {
                    ...tableSyncs[syncIndex],
                    contactListId: contactList._id.toString(),
                    createNewList: false,
                    newListName: '',
                };

                // Create a new config object preserving all existing properties
                const updatedConfig = {
                    ...integration.config,
                    tableSyncs,
                };

                await updateIntegration(integration._id, brandId, session.user.id, {
                    config: updatedConfig,
                });
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

        // Fetch records from Airtable
        // Note: Airtable API has a limit of 100 records per request, so we need to paginate
        let allRecords = [];
        let offset = null;

        do {
            const url = `https://api.airtable.com/v0/${tableSync.baseId}/${tableSync.tableId}`;
            const params = {
                pageSize: 100, // Max page size for Airtable
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

        // Process records in batches to avoid overwhelming the database
        const BATCH_SIZE = 100;
        console.log('allRecords', allRecords);
        for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
            const batch = allRecords.slice(i, i + BATCH_SIZE);

            // Create operations for bulk write
            const operations = batch
                .map((record) => {
                    const fields = record.fields;

                    // Skip records without email
                    const emailField = tableSync.mapping.email;
                    if (!emailField || !fields[emailField]) {
                        skippedCount++;
                        return null;
                    }

                    const email = fields[emailField].toString().trim().toLowerCase();

                    // Basic email validation
                    if (!email.includes('@')) {
                        skippedCount++;
                        return null;
                    }

                    // Get other fields if available
                    const firstNameField = tableSync.mapping.firstName;
                    const lastNameField = tableSync.mapping.lastName;
                    const phoneField = tableSync.mapping.phone;

                    const firstName = firstNameField && fields[firstNameField] ? fields[firstNameField].toString().trim() : '';
                    const lastName = lastNameField && fields[lastNameField] ? fields[lastNameField].toString().trim() : '';
                    const phone = phoneField && fields[phoneField] ? fields[phoneField].toString().trim() : '';

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
                    updatedCount,
                    skippedCount,
                    totalCount: allRecords.length,
                },
                status: 'success', // Make sure we update the status
            };

            // Create a new config object preserving all existing properties
            const updatedConfig = {
                ...integration.config,
                tableSyncs,
            };

            await updateIntegration(integration._id, brandId, session.user.id, {
                config: updatedConfig,
            });
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
            totalCount: allRecords.length,
        });
    } catch (error) {
        console.error('Error syncing Airtable data:', error);
        return res.status(500).json({ message: 'Error syncing data: ' + error.message });
    }
}

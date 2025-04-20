// src/pages/api/brands/[brandId]/integrations/google-sheets/remove-sync.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getIntegrationByType } from '@/services/integrationService';
import connectToDatabase from '@/lib/mongodb';
import Contact from '@/models/Contact';
import Integration from '@/models/Integration';
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
        const { syncId, removeData = false } = req.body;

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

        // Optionally remove the synced contacts if removeData is true
        if (removeData && tableSync.contactListId) {
            console.log(`Removing contacts for sync ${syncId} from list ${tableSync.contactListId}`);

            // Delete contacts from this sync (matching the list ID)
            const deleteResult = await Contact.deleteMany({
                listId: new mongoose.Types.ObjectId(tableSync.contactListId),
                brandId: new mongoose.Types.ObjectId(brandId),
                userId: new mongoose.Types.ObjectId(session.user.id),
            });

            console.log(`Deleted ${deleteResult.deletedCount} contacts`);
        }

        // Remove the sync configuration from the integration
        const updatedTableSyncs = integration.config.tableSyncs.filter((sync) => sync.id !== syncId);

        // Update the integration with the filtered syncs array
        const updateResult = await Integration.updateOne(
            { _id: integration._id },
            {
                $set: {
                    'config.tableSyncs': updatedTableSyncs,
                    updatedAt: new Date(),
                },
            }
        );

        console.log('Integration update result:', updateResult);

        // Return success
        return res.status(200).json({
            success: true,
            message: `Sync configuration removed successfully${removeData ? ' along with associated contacts' : ''}`,
            syncId,
        });
    } catch (error) {
        console.error('Error removing sync configuration:', error);
        return res.status(500).json({ message: 'Error removing sync: ' + error.message });
    }
}

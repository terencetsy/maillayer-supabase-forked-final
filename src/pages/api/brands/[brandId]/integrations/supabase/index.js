import { getUserFromRequest } from '@/lib/supabase';
import { createIntegration, getIntegrationByType, updateIntegration } from '@/services/integrationService';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    const { brandId } = req.query;

    const { user } = await getUserFromRequest(req, res);
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    // Handle GET request to fetch integration
    if (req.method === 'GET') {
        try {
            // Check permission
            // const authCheck = await checkBrandPermission(brandId, user.id, PERMISSIONS.VIEW_INTEGRATIONS);
            // ...

            // Fetch the integration
            const integration = await getIntegrationByType('supabase', brandId, user.id);

            // If integration exists, return it
            if (integration) {
                return res.status(200).json(integration);
            }

            // If no integration found, return null
            return res.status(200).json(null);
        } catch (error) {
            console.error('Error fetching Supabase integration:', error);
            return res.status(500).json({ message: 'Server error' });
        }
    }

    // Handle POST request to create or update integration
    if (req.method === 'POST') {
        try {
            // Permission for edit
            const authCheck = await checkBrandPermission(brandId, user.id, PERMISSIONS.EDIT_INTEGRATIONS);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }

            const { name, url, apiKey, tableSyncs, autoSyncConfig } = req.body;

            // Validate input
            if (!name) {
                return res.status(400).json({ message: 'Name is required' });
            }

            if (!url) {
                return res.status(400).json({ message: 'Supabase URL is required' });
            }

            if (!apiKey) {
                return res.status(400).json({ message: 'Supabase API key is required' });
            }

            // Extract auto-sync configuration if provided
            const autoSyncSettings = autoSyncConfig || {};

            // Check if integration already exists
            const existingIntegration = await getIntegrationByType('supabase', brandId, user.id);

            if (existingIntegration) {
                // Ensure tableSyncs is an array and log it for debugging
                const updatedTableSyncs = Array.isArray(tableSyncs) ? tableSyncs : [];

                // Update existing integration with explicit config structure
                const updatedConfig = {
                    url,
                    apiKey,
                    projectId: url.split('.')[0].replace('https://', ''),
                    tableSyncs: updatedTableSyncs,
                    // Include auto-sync configuration
                    autoSyncEnabled: autoSyncSettings.autoSyncEnabled !== undefined ? autoSyncSettings.autoSyncEnabled : existingIntegration.config.autoSyncEnabled || false,
                    autoSyncListId: autoSyncSettings.autoSyncListId || existingIntegration.config.autoSyncListId || '',
                    createNewList: autoSyncSettings.createNewList !== undefined ? autoSyncSettings.createNewList : existingIntegration.config.createNewList || false,
                    newListName: autoSyncSettings.newListName || existingIntegration.config.newListName || 'Supabase Users',
                    lastSyncedAt: existingIntegration.config.lastSyncedAt || null,
                };

                const updatedIntegration = await updateIntegration(existingIntegration.id, brandId, user.id, {
                    name,
                    config: updatedConfig,
                    status: 'active',
                });

                return res.status(200).json(updatedIntegration);
            } else {
                // Ensure tableSyncs is an array
                const initialTableSyncs = Array.isArray(tableSyncs) ? tableSyncs : [];

                // Create new integration with explicit config structure
                const config = {
                    url,
                    apiKey,
                    projectId: url.split('.')[0].replace('https://', ''),
                    tableSyncs: initialTableSyncs,
                    // Include auto-sync configuration
                    autoSyncEnabled: autoSyncSettings.autoSyncEnabled || false,
                    autoSyncListId: autoSyncSettings.autoSyncListId || '',
                    createNewList: autoSyncSettings.createNewList || false,
                    newListName: autoSyncSettings.newListName || 'Supabase Users',
                    lastSyncedAt: null,
                };

                const newIntegration = await createIntegration({
                    name,
                    type: 'supabase',
                    userId: user.id,
                    brandId,
                    config,
                    status: 'active',
                });

                return res.status(201).json(newIntegration);
            }
        } catch (error) {
            console.error('Error creating/updating Supabase integration:', error);
            return res.status(500).json({ message: 'Server error: ' + error.message });
        }
    }

    // If method is not supported
    return res.status(405).json({ message: 'Method not allowed' });
}

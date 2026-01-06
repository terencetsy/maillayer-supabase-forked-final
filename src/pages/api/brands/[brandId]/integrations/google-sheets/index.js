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
            const integration = await getIntegrationByType('google_sheets', brandId, user.id);

            // If integration exists, return it
            if (integration) {
                return res.status(200).json(integration);
            }

            // If no integration found, return empty object
            return res.status(200).json(null);
        } catch (error) {
            console.error('Error fetching Google Sheets integration:', error);
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

            const { name, serviceAccountJson, tableSyncs } = req.body;

            // Validate input
            if (!name) {
                return res.status(400).json({ message: 'Name is required' });
            }

            if (!serviceAccountJson) {
                return res.status(400).json({ message: 'Service account JSON is required' });
            }

            let serviceAccount;

            try {
                // Parse the service account JSON
                serviceAccount = JSON.parse(serviceAccountJson);
            } catch (error) {
                return res.status(400).json({ message: 'Invalid service account JSON' });
            }

            // Basic validation for required fields
            if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
                return res.status(400).json({ message: 'Invalid service account JSON: missing required fields' });
            }

            // Check if integration already exists
            const existingIntegration = await getIntegrationByType('google_sheets', brandId, user.id);

            if (existingIntegration) {
                // Ensure tableSyncs is an array and log it for debugging
                const updatedTableSyncs = Array.isArray(tableSyncs) ? tableSyncs : [];
                console.log('Updating integration with tableSyncs:', JSON.stringify(updatedTableSyncs));

                // Update existing integration with explicit config structure
                const updatedConfig = {
                    serviceAccount,
                    projectId: serviceAccount.project_id,
                    tableSyncs: updatedTableSyncs,
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
                console.log('Creating integration with tableSyncs:', JSON.stringify(initialTableSyncs));

                // Create new integration with explicit config structure
                const config = {
                    serviceAccount,
                    projectId: serviceAccount.project_id,
                    tableSyncs: initialTableSyncs,
                };

                const newIntegration = await createIntegration({
                    name,
                    type: 'google_sheets',
                    userId: user.id,
                    brandId,
                    config,
                    status: 'active',
                });

                return res.status(201).json(newIntegration);
            }
        } catch (error) {
            console.error('Error creating/updating Google Sheets integration:', error);
            return res.status(500).json({ message: 'Server error' });
        }
    }

    // If method is not supported
    return res.status(405).json({ message: 'Method not allowed' });
}

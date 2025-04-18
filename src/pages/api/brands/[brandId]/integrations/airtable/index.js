// src/pages/api/brands/[id]/integrations/airtable.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { createIntegration, getIntegrationByType, updateIntegration } from '@/services/integrationService';

export default async function handler(req, res) {
    const { brandId } = req.query;

    // Handle GET request to fetch integration
    if (req.method === 'GET') {
        try {
            // Authenticate the user
            const session = await getServerSession(req, res, authOptions);
            if (!session) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            // Fetch the integration
            const integration = await getIntegrationByType('airtable', brandId, session.user.id);

            // If integration exists, return it
            if (integration) {
                return res.status(200).json(integration);
            }

            // If no integration found, return empty object
            return res.status(200).json(null);
        } catch (error) {
            console.error('Error fetching Airtable integration:', error);
            return res.status(500).json({ message: 'Server error' });
        }
    }

    // Handle POST request to create or update integration
    if (req.method === 'POST') {
        try {
            // Authenticate the user
            const session = await getServerSession(req, res, authOptions);
            if (!session) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const { name, apiKey, tableSyncs } = req.body;

            // Validate input
            if (!name) {
                return res.status(400).json({ message: 'Name is required' });
            }

            if (!apiKey) {
                return res.status(400).json({ message: 'API key is required' });
            }

            // Ensure tableSyncs is an array and log it for debugging
            const updatedTableSyncs = Array.isArray(tableSyncs) ? tableSyncs : [];
            console.log('Updating integration with tableSyncs:', JSON.stringify(updatedTableSyncs));

            // Check if integration already exists
            const existingIntegration = await getIntegrationByType('airtable', brandId, session.user.id);

            if (existingIntegration) {
                // Update existing integration with explicit config structure
                const updatedConfig = {
                    apiKey,
                    tableSyncs: updatedTableSyncs,
                };

                const updatedIntegration = await updateIntegration(existingIntegration._id, brandId, session.user.id, {
                    name,
                    config: updatedConfig,
                    status: 'active',
                });

                return res.status(200).json(updatedIntegration);
            } else {
                // Create new integration with explicit config structure
                const config = {
                    apiKey,
                    tableSyncs: updatedTableSyncs,
                };

                const newIntegration = await createIntegration({
                    name,
                    type: 'airtable',
                    userId: session.user.id,
                    brandId,
                    config,
                    status: 'active',
                });

                return res.status(201).json(newIntegration);
            }
        } catch (error) {
            console.error('Error creating/updating Airtable integration:', error);
            return res.status(500).json({ message: 'Server error: ' + error.message });
        }
    }

    // If method is not supported
    return res.status(405).json({ message: 'Method not allowed' });
}

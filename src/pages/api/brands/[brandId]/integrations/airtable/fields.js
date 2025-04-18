// src/pages/api/brands/[id]/integrations/airtable/fields.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getIntegrationByType } from '@/services/integrationService';
import axios from 'axios';

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
        const { baseId } = req.body;

        // Validate input
        if (!baseId) {
            return res.status(400).json({ message: 'Base ID is required' });
        }

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

        // Fetch table schema to get fields
        const tableResponse = await axios.get(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        // Format the fields into a simpler structure
        const fields = tableResponse.data.tables.map((field) => ({
            id: field.id,
            name: field.name,
            type: field.type,
        }));

        return res.status(200).json(tableResponse.data.tables);
    } catch (error) {
        console.error('Error fetching Airtable table fields:', error);
        return res.status(500).json({ message: 'Error fetching Airtable table fields: ' + error.message });
    }
}

// src/pages/api/brands/[id]/integrations/airtable/bases.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getIntegrationByType } from '@/services/integrationService';
import axios from 'axios';

export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Authenticate the user
        const session = await getServerSession(req, res, authOptions);
        if (!session) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { brandId } = req.query;

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
        console.log('API Key:', apiKey); // Debugging line to check API key
        // Fetch bases from Airtable API
        const basesResponse = await axios.get('https://api.airtable.com/v0/meta/bases', {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        // Process the response to get base information
        const bases = await Promise.all(
            basesResponse.data.bases.map(async (base) => {
                try {
                    // Fetch tables (called "tables" in Airtable terminology) for each base
                    const tablesResponse = await axios.get(`https://api.airtable.com/v0/meta/bases/${base.id}/tables`, {
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                    });

                    // Map tables to a simpler format
                    const tables = tablesResponse.data.tables.map((table) => ({
                        id: table.id,
                        name: table.name,
                    }));

                    return {
                        id: base.id,
                        name: base.name,
                        url: `https://airtable.com/${base.id}`,
                        tables,
                    };
                } catch (error) {
                    console.error(`Error fetching tables for base ${base.id}:`, error);
                    return {
                        id: base.id,
                        name: base.name,
                        url: `https://airtable.com/${base.id}`,
                        tables: [],
                        error: error.message,
                    };
                }
            })
        );

        return res.status(200).json({ bases });
    } catch (error) {
        console.error('Error fetching Airtable bases:', error);
        return res.status(500).json({ message: 'Error fetching Airtable bases: ' + error.message });
    }
}

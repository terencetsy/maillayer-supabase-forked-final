// src/pages/api/brands/[brandId]/integrations/supabase/test.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getIntegrationByType } from '@/services/integrationService';
import { createClient } from '@supabase/supabase-js';

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

        // Get the Supabase integration
        const integration = await getIntegrationByType('supabase', brandId, session.user.id);

        if (!integration) {
            return res.status(404).json({ message: 'Supabase integration not found' });
        }

        // Create Supabase client
        const supabaseUrl = integration.config.url;
        const supabaseKey = integration.config.apiKey;

        const supabase = createClient(supabaseUrl, supabaseKey);

        try {
            // Test the connection by checking if we can access the service
            const { data, error } = await supabase.auth.getSession();

            if (error) {
                throw error;
            }

            // Get a list of tables
            const { data: tableData, error: tableError } = await supabase.from('pg_tables').select('tablename, schemaname').eq('schemaname', 'public').order('tablename', { ascending: true });

            if (tableError) {
                throw tableError;
            }

            const tables = tableData || [];

            return res.status(200).json({
                success: true,
                tables,
                message: `Successfully connected to Supabase. Found ${tables.length} tables.`,
            });
        } catch (supabaseError) {
            console.error('Supabase API error:', supabaseError);

            // If there's a permission issue, provide a more specific message
            if (supabaseError.status === 403) {
                return res.status(403).json({
                    message: 'Permission denied: The API key does not have sufficient permissions.',
                });
            }

            throw supabaseError;
        }
    } catch (error) {
        console.error('Error testing Supabase connection:', error);
        return res.status(500).json({ message: 'Error connecting to Supabase: ' + error.message });
    }
}

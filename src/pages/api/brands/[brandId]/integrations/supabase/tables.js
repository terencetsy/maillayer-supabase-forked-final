// src/pages/api/brands/[brandId]/integrations/supabase/tables.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getIntegrationByType } from '@/services/integrationService';
import { createClient } from '@supabase/supabase-js';

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

        // Get the Supabase integration
        const integration = await getIntegrationByType('supabase', brandId, session.user.id);

        if (!integration) {
            return res.status(404).json({ message: 'Supabase integration not found' });
        }

        // Create Supabase client
        const supabaseUrl = integration.config.url;
        const supabaseKey = integration.config.apiKey;

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get list of tables
        const { data: tablesData, error: tablesError } = await supabase.from('pg_tables').select('tablename, schemaname').eq('schemaname', 'public').order('tablename', { ascending: true });

        if (tablesError) {
            throw tablesError;
        }

        // Format tables data
        const tables = await Promise.all(
            (tablesData || []).map(async (table) => {
                try {
                    // For each table, get column information
                    const { data: columnsData, error: columnsError } = await supabase.from('information_schema.columns').select('column_name, data_type, is_nullable').eq('table_schema', 'public').eq('table_name', table.tablename).order('ordinal_position', { ascending: true });

                    if (columnsError) {
                        throw columnsError;
                    }

                    // Format column data
                    const columns = (columnsData || []).map((column) => ({
                        name: column.column_name,
                        type: column.data_type,
                        nullable: column.is_nullable === 'YES',
                    }));

                    return {
                        id: table.tablename,
                        name: table.tablename,
                        schema: table.schemaname,
                        columns,
                    };
                } catch (error) {
                    console.error(`Error fetching columns for table ${table.tablename}:`, error);
                    return {
                        id: table.tablename,
                        name: table.tablename,
                        schema: table.schemaname,
                        columns: [],
                        error: error.message,
                    };
                }
            })
        );

        return res.status(200).json({ tables });
    } catch (error) {
        console.error('Error fetching Supabase tables:', error);
        return res.status(500).json({ message: 'Error fetching Supabase tables: ' + error.message });
    }
}

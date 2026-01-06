
import { supabaseAdmin } from '@/lib/supabase';
import { google } from 'googleapis';

export const googleSheetsSyncService = {
    async processSync(jobData) {
        const { integrationId, syncId } = jobData;
        const { data: integration } = await supabaseAdmin.from('integrations').select('*').eq('id', integrationId).single();
        if (!integration || integration.type !== 'google_sheets') return;

        const tableSync = integration.config.tableSyncs?.find(s => s.id === syncId);
        if (!tableSync) return;

        // Google Sheets Logic
        const auth = new google.auth.JWT({
            email: integration.config.serviceAccount.client_email,
            key: integration.config.serviceAccount.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });

        // Fetch rows
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: tableSync.spreadsheetId,
            range: `${tableSync.sheetName || 'Sheet1'}!A:Z` // Simplified range logic, ideally fetch sheet props
        });

        const rows = response.data.values;
        if (!rows || rows.length < 2) return; // Header + Data

        const headers = rows[0]; // Assuming row 1 is header or use tableSync.headerRow
        const dataRows = rows.slice(1);

        const mapping = tableSync.mapping;
        const contacts = [];

        // Reconstruct field indices
        const emailIdx = headers.indexOf(mapping.email);
        if (emailIdx === -1) return;

        const firstIdx = mapping.firstName ? headers.indexOf(mapping.firstName) : -1;
        const lastIdx = mapping.lastName ? headers.indexOf(mapping.lastName) : -1;

        dataRows.forEach(row => {
            if (row[emailIdx]) {
                contacts.push({
                    email: row[emailIdx].toLowerCase(),
                    first_name: firstIdx > -1 ? row[firstIdx] : '',
                    last_name: lastIdx > -1 ? row[lastIdx] : '',
                    list_id: tableSync.contactListId,
                    brand_id: integration.brand_id,
                    user_id: integration.user_id,
                    status: 'active'
                });
            }
        });

        // Bulk upsert
        let successCount = 0;
        for (let i = 0; i < contacts.length; i += 100) {
            const batch = contacts.slice(i, i + 100);
            const { error } = await supabaseAdmin.from('contacts').upsert(batch, { onConflict: 'email,brand_id,list_id' });
            if (!error) successCount += batch.length;
        }

        // Update stats
        const now = new Date();
        const updatedConfig = {
            ...integration.config,
            tableSyncs: integration.config.tableSyncs.map(s => s.id === syncId ? { ...s, lastSyncedAt: now } : s)
        };
        await supabaseAdmin.from('integrations').update({ config: updatedConfig }).eq('id', integrationId);

        return { success: true, count: successCount };
    }
};

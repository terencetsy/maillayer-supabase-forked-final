
import { supabaseAdmin } from '@/lib/supabase';
import axios from 'axios';

export const airtableSyncService = {
    async processSync(jobData) {
        const { integrationId, syncId } = jobData;
        const { data: integration } = await supabaseAdmin.from('integrations').select('*').eq('id', integrationId).single();
        if (!integration || integration.type !== 'airtable') return;

        const tableSync = integration.config.tableSyncs?.find(s => s.id === syncId);
        if (!tableSync) return;

        // Airtable Logic
        let records = [];
        let offset = null;
        const apiKey = integration.config.apiKey;
        const baseId = tableSync.baseId;
        const tableId = tableSync.tableId;

        do {
            const url = `https://api.airtable.com/v0/${baseId}/${tableId}?pageSize=100${offset ? `&offset=${offset}` : ''}`;
            const res = await axios.get(url, { headers: { Authorization: `Bearer ${apiKey}` } });
            records.push(...res.data.records);
            offset = res.data.offset;
        } while (offset);

        const contacts = records.map(r => {
            const fields = r.fields;
            const mapping = tableSync.mapping;
            if (!fields[mapping.email]) return null;
            return {
                email: fields[mapping.email].toLowerCase(),
                first_name: fields[mapping.firstName] || '',
                last_name: fields[mapping.lastName] || '',
                phone: fields[mapping.phone] || '',
                list_id: tableSync.contactListId,
                brand_id: integration.brand_id,
                user_id: integration.user_id,
                status: 'active'
            };
        }).filter(c => c);

        // Bulk upsert
        let successCount = 0;
        for (let i = 0; i < contacts.length; i += 100) {
            const batch = contacts.slice(i, i + 100);
            const { error } = await supabaseAdmin.from('contacts').upsert(batch, { onConflict: 'email,brand_id,list_id' });
            if (!error) successCount += batch.length;
        }

        const now = new Date();
        const updatedConfig = {
            ...integration.config,
            tableSyncs: integration.config.tableSyncs.map(s => s.id === syncId ? { ...s, lastSyncedAt: now } : s)
        };
        await supabaseAdmin.from('integrations').update({ config: updatedConfig }).eq('id', integrationId);

        return { success: true, count: successCount };
    }
};

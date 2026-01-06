
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { contactsDb } from '@/lib/db/contacts';
import { createClient } from '@supabase/supabase-js';

export const supabaseSyncService = {
    async processSync(jobData) {
        const { integrationId, syncId } = jobData;

        // Get Integration
        const { data: integration } = await supabaseAdmin
            .from('integrations')
            .select('*')
            .eq('id', integrationId)
            .single();

        if (!integration || integration.type !== 'supabase') return;

        const tableSync = integration.config.tableSyncs?.find(s => s.id === syncId);
        if (!tableSync) return;

        // Connect to external Supabase
        const external = createClient(integration.config.url, integration.config.apiKey);

        // Fetch data
        const { data: rows } = await external
            .from(tableSync.tableName)
            .select('*');

        if (!rows || rows.length === 0) return { success: true, count: 0 };

        // Map and Upsert
        const mapping = tableSync.mapping;
        const listId = tableSync.contactListId; // Ensure this is snake_case in saved config or handle both? Mongoose schema had camelCase. `tableSync` is JSONB.

        const contacts = rows
            .filter(r => r[mapping.email])
            .map(r => ({
                email: r[mapping.email].toLowerCase(),
                first_name: mapping.firstName ? r[mapping.firstName] : null,
                last_name: mapping.lastName ? r[mapping.lastName] : null,
                phone: mapping.phone ? r[mapping.phone] : null,
                status: 'active',
                list_id: listId,
                brand_id: integration.brand_id,
                user_id: integration.user_id
            }));

        let successCount = 0;
        for (let i = 0; i < contacts.length; i += 100) {
            const batch = contacts.slice(i, i + 100);
            const { error } = await supabaseAdmin
                .from('contacts')
                .upsert(batch, { onConflict: 'email,brand_id,list_id' });
            if (!error) successCount += batch.length;
        }

        // Update Stats
        const now = new Date();
        const updatedSyncs = integration.config.tableSyncs.map(s =>
            s.id === syncId ? { ...s, lastSyncedAt: now, lastSyncResult: { count: successCount } } : s
        );
        const updatedConfig = { ...integration.config, tableSyncs: updatedSyncs };
        await supabaseAdmin.from('integrations').update({ config: updatedConfig }).eq('id', integrationId);

        return { success: true, count: successCount };
    }
};

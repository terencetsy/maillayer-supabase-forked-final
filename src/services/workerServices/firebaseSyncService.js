
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { brandsDb } from '@/lib/db/brands';
import { contactsDb } from '@/lib/db/contacts';
import { default as firebaseAdmin } from 'firebase-admin';

// Initialize Firebase App logic (adapted from worker)
const firebaseApps = {};
function getFirebaseApp(brandId, serviceAccount) {
    const appName = `brand-${brandId}`;
    if (firebaseApps[appName]) return firebaseApps[appName];

    try {
        const app = firebaseAdmin.app(appName);
        firebaseApps[appName] = app;
        return app;
    } catch {
        const app = firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert(serviceAccount),
            databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
        }, appName);
        firebaseApps[appName] = app;
        return app;
    }
}

async function fetchAllFirebaseUsers(auth) {
    const users = [];
    let pageToken;
    do {
        const result = await auth.listUsers(1000, pageToken);
        users.push(...result.users);
        pageToken = result.pageToken;
    } while (pageToken);
    return users;
}

export const firebaseSyncService = {
    async processSync(jobData) {
        const { integrationId } = jobData;
        console.log(`Processing Firebase Sync for ${integrationId}`);

        // Get integration from Supabase
        const { data: integration, error } = await supabaseAdmin
            .from('integrations')
            .select('*')
            .eq('id', integrationId)
            .single();

        if (error || !integration) {
            console.error('Integration not found');
            return; // Exit
        }

        if (integration.type !== 'firebase') return;

        const { serviceAccount, autoSyncListId, createNewList, newListName } = integration.config;
        let listId = autoSyncListId;

        if (createNewList && newListName) {
            // Create list
            const { data: list } = await contactsDb.createList({
                brand_id: integration.brand_id,
                user_id: integration.user_id,
                name: newListName,
                description: 'Auto-created via Firebase Sync'
            });
            listId = list.id;

            // Update integration config
            const newConfig = { ...integration.config, autoSyncListId: listId, createNewList: false };
            await supabaseAdmin.from('integrations').update({ config: newConfig }).eq('id', integrationId);
        }

        const app = getFirebaseApp(integration.brand_id, serviceAccount);
        const auth = firebaseAdmin.auth(app);
        const users = await fetchAllFirebaseUsers(auth);

        // Bulk upsert
        let successCount = 0;
        const contacts = users.filter(u => u.email).map(u => ({
            email: u.email.toLowerCase(),
            first_name: u.displayName ? u.displayName.split(' ')[0] : '',
            last_name: u.displayName ? u.displayName.split(' ').slice(1).join(' ') : '',
            phone: u.phoneNumber,
            status: u.disabled ? 'inactive' : 'active',
            list_id: listId,
            brand_id: integration.brand_id,
            user_id: integration.user_id
        }));

        // Batch upsert using contactsDb (need a bulk method or loop)
        // contactsDb might not have bulk.
        // Direct supabase upsert
        for (let i = 0; i < contacts.length; i += 100) {
            const batch = contacts.slice(i, i + 100);
            const { error: upsertError } = await supabaseAdmin
                .from('contacts')
                .upsert(batch, { onConflict: 'email,brand_id,list_id' }); // Conflict on unique constraint
            if (!upsertError) successCount += batch.length;
        }

        // Update stats on integration
        const now = new Date();
        const updatedConfig = { ...integration.config, lastSyncedAt: now, lastSyncCount: successCount };
        await supabaseAdmin.from('integrations').update({ config: updatedConfig }).eq('id', integrationId);

        return { success: true, count: successCount };
    }
};

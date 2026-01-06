
import { supabaseSyncService } from '@/services/workerServices/supabaseSyncService';
import { kvQueue } from '@/lib/kv-queue';

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const queueName = 'supabase-sync';
    try {
        const job = await kvQueue.pop(queueName);
        if (job) {
            console.log(`[Cron] Supabase Sync Job ${job.id}`);
            await supabaseSyncService.processSync(job.data);
        }
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

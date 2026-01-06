
import { firebaseSyncService } from '@/services/workerServices/firebaseSyncService';
import { kvQueue } from '@/lib/kv-queue';

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const queueName = 'firebase-auth-sync';
    let processed = 0;

    try {
        const job = await kvQueue.pop(queueName);
        if (job) {
            console.log(`[Cron] Firebase Sync Job ${job.id}`);
            await firebaseSyncService.processSync(job.data);
            processed++;
        }
        return res.status(200).json({ processed, success: true });
    } catch (error) {
        console.error('Firebase Cron error:', error);
        return res.status(500).json({ error: error.message });
    }
}

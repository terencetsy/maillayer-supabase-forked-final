
import { airtableSyncService } from '@/services/workerServices/airtableSyncService';
import { kvQueue } from '@/lib/kv-queue';

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
    try {
        const job = await kvQueue.pop('airtable-sync');
        if (job) await airtableSyncService.processSync(job.data);
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

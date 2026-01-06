
import { googleSheetsSyncService } from '@/services/workerServices/googleSheetsSyncService';
import { kvQueue } from '@/lib/kv-queue';

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
    try {
        const job = await kvQueue.pop('google-sheets-sync');
        if (job) await googleSheetsSyncService.processSync(job.data);
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

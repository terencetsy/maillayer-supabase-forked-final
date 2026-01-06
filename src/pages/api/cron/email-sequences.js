
import { emailSequenceWorkerService } from '@/services/workerServices/emailSequenceWorkerService';
import { kvQueue } from '@/lib/kv-queue';

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        // Cron jobs are usually GET
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Security: Check for Vercel Cron secret (Authorization header) if strictly needed
    // if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) ...

    const queueName = 'email-sequences';
    const batchSize = 10; // Process 10 items per invocation
    let processed = 0;

    try {
        // Simple loop to process batch
        for (let i = 0; i < batchSize; i++) {
            const job = await kvQueue.pop(queueName);
            if (!job) break; // Queue empty

            console.log(`[Cron] Processing job ${job.id}`);

            try {
                if (job.data._jobName === 'send-sequence-email') {
                    await emailSequenceWorkerService.processSequenceEmail(job.data);
                } else if (job.data._jobName === 'enroll-contact') {
                    await emailSequenceWorkerService.enrollNewContact(job.data);
                }
            } catch (err) {
                console.error(`[Cron] Job ${job.id} failed:`, err);
                // Optionally re-queue with backoff or move to DLQ
            }
            processed++;
        }

        return res.status(200).json({ processed, success: true });
    } catch (error) {
        console.error('Cron error:', error);
        return res.status(500).json({ error: error.message });
    }
}

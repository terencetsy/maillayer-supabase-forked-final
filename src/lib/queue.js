// src/lib/queue.js
import { kvQueue } from './kv-queue';

// Adapter to mimic Bull-like interface partially or just export helpers
// The original file exported `initializeQueues` which returned { emailCampaignQueue, schedulerQueue }.
// We should maintain this interface to minimize breakage in consumers (if any API routes use it).
// But consumers called `queue.add()`. Our `kvQueue.add` signature is compatible enough (queueName, data, options).

const createQueueWrapper = (queueName) => ({
    add: async (name, data, options) => {
        // Bull: queue.add(name, data, options) OR queue.add(data, options)
        // Check if name is string.
        let jobData = data;
        let jobOptions = options;
        let jobName = name;

        if (typeof name !== 'string') {
            jobOptions = data;
            jobData = name;
            jobName = 'default';
        }

        return await kvQueue.add(queueName, { ...jobData, _jobName: jobName }, jobOptions);
    },
    process: () => {
        console.warn(`[Queue ${queueName}] .process() called but queues are now serverless. Use Cron API instead.`);
    },
    on: () => { } // stub
});

let queueInstance = null;

async function initializeQueues() {
    if (queueInstance) return queueInstance;

    const emailCampaignQueue = createQueueWrapper('email-campaigns');
    const schedulerQueue = createQueueWrapper('campaign-scheduler');

    // Add others for workers we found
    const emailSequenceQueue = createQueueWrapper('email-sequences');
    const firebaseSyncQueue = createQueueWrapper('firebase-auth-sync');
    const supabaseSyncQueue = createQueueWrapper('supabase-sync');
    const sheetsSyncQueue = createQueueWrapper('google-sheets-sync');
    const airtableSyncQueue = createQueueWrapper('airtable-sync');

    queueInstance = {
        emailCampaignQueue,
        schedulerQueue,
        emailSequenceQueue,
        firebaseSyncQueue,
        supabaseSyncQueue,
        sheetsSyncQueue,
        airtableSyncQueue
    };

    return queueInstance;
}

export default initializeQueues;
export { initializeQueues };

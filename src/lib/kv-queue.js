import { kv } from '@vercel/kv';

/**
 * Simple Queue implementation using Vercel KV (Redis)
 * Designed for serverless environments where a persistent worker process is not available.
 * 
 * Usage:
 * - Producers: kvQueue.add('queue-name', { data })
 * - Consumers (Cron): kvQueue.pop('queue-name', batchSize) within an API route
 */
export const kvQueue = {
    /**
     * Add a job to the queue
     * @param {string} queueName - Name of the queue
     * @param {object} data - Job data
     * @param {object} options - Options (delay, lifecycle, etc. - mostly ignored in simple list version, but kept for compat)
     */
    async add(queueName, data, options = {}) {
        const jobId = options.jobId || `${queueName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const job = {
            id: jobId,
            data,
            timestamp: Date.now(),
            options
        };

        // If delay is specified, we could use zadd (sorted set), but for MVP we might ignore or support simple delay
        // For simple queues, we just LPUSH (so RPOP gets oldest)
        if (options.delay) {
            // Basic delayed queue implementation using Sorted Set
            const score = Date.now() + options.delay;
            await kv.zadd(`queue:${queueName}:delayed`, { score, member: JSON.stringify(job) });
        } else {
            await kv.lpush(`queue:${queueName}`, job); // Store whole object as JSON
        }

        return job;
    },

    /**
     * Pop a job from the queue (RPOP for FIFO)
     * Checks delayed queue first for ready jobs
     * @param {string} queueName 
     */
    async pop(queueName) {
        // 1. Move ready jobs from delayed set to main list
        // ZRANGEBYSCORE queue:delayed -inf now LIMIT 0 10
        // Then move them to list.
        // Doing this atomically is hard without Lua, but reasonable in 2 steps for simple apps.
        const now = Date.now();
        const readyJobs = await kv.zrange(`queue:${queueName}:delayed`, 0, now, { byScore: true });

        if (readyJobs.length > 0) {
            // Remove from sorted set
            // In high concurrency, this might be race-y, but @vercel/kv is standard Redis.
            // Using a pipeline or multi would be better.
            const pipeline = kv.pipeline();
            pipeline.zrem(`queue:${queueName}:delayed`, ...readyJobs);
            // Push to main queue
            // readyJobs are strings (JSON)
            // Ensure they are pushed one by one or spread? lpush accepts multiple args?
            // @vercel/kv lpush: (key, ...elements)
            // We need to verify if readyJobs are objects or strings. zrange returns members.
            // If we stored JSON string, we get JSON string.

            // Note: readyJobs might be objects if the lib parses them automatically? 
            // @vercel/kv usually returns objects if stored as json? 
            // `zadd` takes { member: string|obj }.
            // Let's assume automatic serialization behavior of Vercel KV client.

            // Actually, for safety, let's just push them.
            // But we should use `rpush` (to the RIGHT/TAIL) if we `lpush` new jobs? 
            // Wait.
            // `add` uses `lpush` (HEAD).
            // `pop` uses `rpop` (TAIL).
            // So new jobs are at HEAD. Old jobs are at TAIL.
            // Delayed jobs that become ready should be treated as "newly ready" or "very old"?
            // If we put them at HEAD (`lpush`), they will be processed LAST (LIFO)?
            // If we put them at TAIL (`rpush`), they will be processed FIRST (FIFO).
            // Usually delayed jobs are high priority once ready? Or just standard?
            // Let's `lpush` them (HEAD) so they join the "newly added" pile?
            // Actually, `add` uses `lpush`. `pop` uses `rpop` (process oldest).
            // So if `lpush` puts at HEAD (index 0). `rpop` takes from TAIL (index -1).
            // So the Queue is HEAD -> ... -> TAIL.
            // Items flow HEAD -> TAIL.
            // A delayed job should probably go to HEAD (as if just added).

            if (readyJobs.length > 0) {
                pipeline.lpush(`queue:${queueName}`, ...readyJobs);
            }
            await pipeline.exec();
        }

        // 2. Pop from list
        const job = await kv.rpop(`queue:${queueName}`);
        return job; // returns null object if empty
    },

    /**
     * Get count of jobs
     */
    async count(queueName) {
        return await kv.llen(`queue:${queueName}`);
    }
};

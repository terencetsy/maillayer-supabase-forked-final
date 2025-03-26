// src/lib/queue.js

// This file is written to work with both ES Modules and CommonJS
// It detects the environment and exports appropriately

// Detect if we're in ES Modules (Next.js) or CommonJS (worker scripts)
const isESM = typeof require === 'undefined' || !require.resolve;

if (isESM) {
    // ES Module environment (Next.js)
    module.exports = async () => {
        // Dynamic import for ES Module environment
        const Bull = await import('bull');

        // Redis connection options
        const redisOptions = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        };

        // Create Redis clients for Bull
        const createRedisClient = () => {
            const Redis = require('ioredis');
            return new Redis(redisOptions);
        };

        // Create queues
        const emailCampaignQueue = new Bull.default('email-campaigns', {
            createClient: (type) => {
                switch (type) {
                    case 'client':
                        return createRedisClient();
                    case 'subscriber':
                        return createRedisClient();
                    case 'bclient':
                        return createRedisClient();
                    default:
                        throw new Error(`Unexpected connection type: ${type}`);
                }
            },
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
                removeOnComplete: 100,
                removeOnFail: 100,
            },
        });

        const schedulerQueue = new Bull.default('campaign-scheduler', {
            createClient: (type) => createRedisClient(),
            defaultJobOptions: {
                removeOnComplete: true,
            },
        });

        return { emailCampaignQueue, schedulerQueue };
    };
} else {
    // CommonJS environment (worker scripts)
    const Bull = require('bull');

    // Redis connection options
    const redisOptions = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
    };

    // Create queues
    const emailCampaignQueue = new Bull('email-campaigns', {
        redis: redisOptions,
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
            removeOnComplete: 100,
            removeOnFail: 100,
        },
    });

    const schedulerQueue = new Bull('campaign-scheduler', {
        redis: redisOptions,
        defaultJobOptions: {
            removeOnComplete: true,
        },
    });

    module.exports = { emailCampaignQueue, schedulerQueue };
}

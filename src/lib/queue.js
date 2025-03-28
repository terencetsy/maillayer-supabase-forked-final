// src/lib/queue.js

// This file is written to work with both ES Modules and CommonJS
// It detects the environment and exports appropriately

// Detect if we're in ES Modules (Next.js) or CommonJS (worker scripts)
const isESM = typeof require === 'undefined' || !require.resolve;

// Get Redis URL - ONLY use the Redis URL, no fallback to individual components
function getRedisUrl() {
    // Simply return the environment variable, with a default value if not set
    return process.env.REDIS_URL || 'redis://localhost:6379';
}

if (isESM) {
    // ES Module environment (Next.js)
    module.exports = async () => {
        try {
            // Dynamic import for ES Module environment
            const Bull = await import('bull');
            const Redis = await import('ioredis');

            // Only use Redis URL
            const redisUrl = getRedisUrl();
            console.log('Next.js using Redis URL:', redisUrl);

            // Create Redis clients for Bull with proper error handling
            const createRedisClient = () => {
                const redisClient = new Redis.default(redisUrl);

                redisClient.on('error', (err) => {
                    console.error('Redis client error (ES):', err);
                });

                redisClient.on('connect', () => {
                    console.log('Redis client connected (ES)');
                });

                return redisClient;
            };

            // Create queues
            const emailCampaignQueue = new Bull.default('email-campaigns', {
                createClient: (type) => createRedisClient(),
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
        } catch (error) {
            console.error('Error initializing queues:', error);
            throw error;
        }
    };
} else {
    // CommonJS environment (worker scripts)
    try {
        const Bull = require('bull');
        const Redis = require('ioredis');

        // Only use Redis URL
        const redisUrl = getRedisUrl();
        console.log('Worker using Redis URL:', redisUrl);

        // Create Redis clients for Bull with proper error handling
        const createRedisClient = () => {
            const redisClient = new Redis(redisUrl);

            redisClient.on('error', (err) => {
                console.error('Worker Redis client error:', err);
            });

            redisClient.on('connect', () => {
                console.log('Worker Redis client connected');
            });

            return redisClient;
        };

        // Create queues
        const emailCampaignQueue = new Bull('email-campaigns', {
            createClient: (type) => createRedisClient(),
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
            createClient: (type) => createRedisClient(),
            defaultJobOptions: {
                removeOnComplete: true,
            },
        });

        module.exports = { emailCampaignQueue, schedulerQueue };
    } catch (error) {
        console.error('Error initializing worker queues:', error);
        throw error;
    }
}

// ecosystem.config.js
module.exports = {
    apps: [
        {
            name: 'ecm-email-worker-dev',
            script: 'workers/email-processor.js',
            env: {
                NODE_ENV: 'development',
                REDIS_HOST: 'localhost',
                REDIS_PORT: '6379',
                MONGODB_URI: 'mongodb://localhost:27017/maillayer-software',
            },
        },
        {
            name: 'ecm-cron-checker-dev',
            script: 'workers/cron-checker.js',
            env: {
                NODE_ENV: 'development',
                REDIS_HOST: 'localhost',
                REDIS_PORT: '6379',
                MONGODB_URI: 'mongodb://localhost:27017/maillayer-software',
            },
        },
    ],
};

// ecosystem.config.js
module.exports = {
    apps: [
        {
            name: 'maillayer-nextjs',
            script: 'npm',
            args: 'start',
        },
        {
            name: 'ecm-email-worker-dev',
            script: 'workers/email-processor.js',
        },
        {
            name: 'ecm-cron-checker-dev',
            script: 'workers/cron-checker.js',
        },
    ],
};

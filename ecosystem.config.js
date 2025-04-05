// ecosystem.config.js
module.exports = {
    apps: [
        {
            name: 'maillayer-nextjs',
            script: 'npm',
            args: 'start', // Use npm start to run the built Next.js app
            env: {
                NODE_ENV: 'production', // Change to production
                PORT: 3000,
            },
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: 'logs/nextjs-error.log',
            out_file: 'logs/nextjs-out.log',
            merge_logs: true,
        },
        {
            name: 'email-worker',
            script: 'workers/email-processor.js',
            env: {
                NODE_ENV: 'production', // Change to production
                WORKER_DEBUG: 'false', // Disable verbose debugging in production
            },
            restart_delay: 3000,
            max_restarts: 10,
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: 'logs/email-worker-error.log',
            out_file: 'logs/email-worker-out.log',
            merge_logs: true,
            exec_mode: 'fork',
            watch: false, // Disable watching in production for better performance
        },
        {
            name: 'cron-checker',
            script: 'workers/cron-checker.js',
            env: {
                NODE_ENV: 'production', // Change to production
                WORKER_DEBUG: 'false',
            },
            restart_delay: 3000,
            max_restarts: 10,
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: 'logs/cron-checker-error.log',
            out_file: 'logs/cron-checker-out.log',
            merge_logs: true,
            exec_mode: 'fork',
        },
        {
            name: 'campaign-manager',
            script: 'workers/campaign-manager.js',
            env: {
                NODE_ENV: 'production', // Change to production
                WORKER_DEBUG: 'false',
            },
            restart_delay: 3000,
            max_restarts: 10,
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: 'logs/campaign-manager-error.log',
            out_file: 'logs/campaign-manager-out.log',
            merge_logs: true,
            exec_mode: 'fork',
        },
    ],
};

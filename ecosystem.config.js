// ecosystem.config.js
module.exports = {
    apps: [
        {
            name: 'maillayer-nextjs',
            script: 'npm',
            args: 'run dev -- -H 0.0.0.0',
            env: {
                NODE_ENV: 'development',
            },
            // Add log configuration
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: 'logs/nextjs-error.log',
            out_file: 'logs/nextjs-out.log',
            merge_logs: true,
        },
        {
            name: 'email-worker',
            script: 'workers/email-processor.js',
            env: {
                NODE_ENV: 'development',
                WORKER_DEBUG: 'true', // Add this for more verbose debugging
            },
            // Add better stability and logging for this critical worker
            restart_delay: 3000,
            max_restarts: 10,
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: 'logs/email-worker-error.log',
            out_file: 'logs/email-worker-out.log',
            merge_logs: true,
            exec_mode: 'fork', // Use fork mode to simplify debugging
            watch: ['workers/email-processor.js'], // Auto-restart on file changes
            ignore_watch: ['node_modules', 'logs'],
        },
        {
            name: 'cron-checker',
            script: 'workers/cron-checker.js',
            env: {
                NODE_ENV: 'development',
                WORKER_DEBUG: 'true',
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
                NODE_ENV: 'development',
                WORKER_DEBUG: 'true',
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

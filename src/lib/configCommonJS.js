// CommonJS version of config for worker scripts
require('dotenv').config();

// Use BASE_URL as the single source of truth for URL-based settings
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const config = {
    // Application URLs
    baseUrl: BASE_URL,
    appUrl: BASE_URL,
    trackingDomain: BASE_URL,
    nextAuthUrl: BASE_URL,

    // MongoDB connection
    mongodbUri: process.env.MONGODB_URI,

    // Redis settings
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
    },

    // Security
    trackingSecret: process.env.TRACKING_SECRET,
    encryptionKey: process.env.ENCRYPTION_KEY,
    nextAuthSecret: process.env.NEXTAUTH_SECRET,

    // Digital Ocean Spaces (for image uploads)
    digitalOcean: {
        spacesEndpoint: process.env.DO_SPACES_ENDPOINT,
        spacesKey: process.env.DO_SPACES_KEY,
        spacesSecret: process.env.DO_SPACES_SECRET,
        spacesBucket: process.env.DO_SPACES_BUCKET,
        spacesUrl: process.env.DO_SPACES_URL,
    },

    // Environment
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
};

module.exports = config;

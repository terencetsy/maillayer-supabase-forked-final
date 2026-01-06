// src/lib/configCommonJS.js
// This file provides a CommonJS-compatible version of the config for worker scripts

// Use BASE_URL as the single source of truth for URL-based settings
const BASE_URL = process.env.BASE_URL;

// The most important change: ONLY use the Redis URL, don't use individual components
// This prevents configuration mismatch between different parts of the app
const REDIS_URL = process.env.REDIS_URL;

const config = {
    // Application URLs
    baseUrl: BASE_URL,
    appUrl: BASE_URL,
    trackingDomain: BASE_URL,
    nextAuthUrl: BASE_URL,

    // MongoDB connection


    // Redis configuration - use ONLY the URL
    redisURL: REDIS_URL,

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

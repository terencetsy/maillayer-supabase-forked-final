// src/pages/api/brands/[brandId]/quota.js
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getBrandById } from '@/services/brandService';
import AWS from 'aws-sdk';

// In-memory cache
const quotaCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 1 hour in milliseconds

export default async function handler(req, res) {
    try {
        if (req.method !== 'GET') {
            return res.status(405).json({ message: 'Method not allowed' });
        }

        await connectToDatabase();

        const session = await getServerSession(req, res, authOptions);
        if (!session || !session.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = session.user.id;
        const { brandId } = req.query;

        if (!brandId) {
            return res.status(400).json({ message: 'Missing brand ID' });
        }

        // Check cache first
        const cacheKey = `quota_${brandId}`;
        const cached = quotaCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log('Returning cached quota data');
            // Set cache headers
            res.setHeader('Cache-Control', `public, s-maxage=${CACHE_DURATION / 1000}, stale-while-revalidate`);
            res.setHeader('X-Cache', 'HIT');
            return res.status(200).json(cached.data);
        }

        const brand = await getBrandById(brandId, true);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        if (brand.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to access this brand' });
        }

        // Check if AWS credentials are configured
        if (!brand.awsRegion || !brand.awsAccessKey || !brand.awsSecretKey) {
            const notConfiguredResponse = {
                configured: false,
                message: 'AWS credentials not configured',
            };
            return res.status(200).json(notConfiguredResponse);
        }

        // Initialize AWS SES client
        const ses = new AWS.SES({
            region: brand.awsRegion,
            accessKeyId: brand.awsAccessKey,
            secretAccessKey: brand.awsSecretKey,
        });

        try {
            // Get send quota
            const quotaData = await ses.getSendQuota().promise();

            // Get send statistics for the last 24 hours
            const stats = await ses.getSendStatistics().promise();

            const responseData = {
                configured: true,
                quota: {
                    max24HourSend: quotaData.Max24HourSend,
                    maxSendRate: quotaData.MaxSendRate,
                    sentLast24Hours: quotaData.SentLast24Hours,
                    remainingQuota: quotaData.Max24HourSend - quotaData.SentLast24Hours,
                    percentageUsed: (quotaData.SentLast24Hours / quotaData.Max24HourSend) * 100,
                },
                statistics: stats.SendDataPoints,
            };

            // Store in cache
            quotaCache.set(cacheKey, {
                data: responseData,
                timestamp: Date.now(),
            });

            // Set cache headers
            res.setHeader('Cache-Control', `public, s-maxage=${CACHE_DURATION / 1000}, stale-while-revalidate`);
            res.setHeader('X-Cache', 'MISS');

            return res.status(200).json(responseData);
        } catch (awsError) {
            console.error('AWS SES error:', awsError);
            return res.status(500).json({
                message: 'Error fetching quota from AWS',
                error: awsError.message,
            });
        }
    } catch (error) {
        console.error('Error fetching SES quota:', error);
        return res.status(500).json({
            message: 'Error fetching quota information',
            error: error.message,
        });
    }
}

// Optional: Clean up old cache entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of quotaCache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
            quotaCache.delete(key);
            console.log(`Cleaned up cache for ${key}`);
        }
    }
}, CACHE_DURATION); // Run cleanup every hour

// src/pages/api/brands/[brandId]/quota.js
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getBrandById } from '@/services/brandService';

// In-memory cache
const quotaCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

// Dynamic import for provider factory (CommonJS module)
const getProviderFactory = async () => {
    const ProviderFactory = require('@/lib/email-providers/ProviderFactory');
    return ProviderFactory;
};

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

        // Check cache first (skip if refresh=true query param)
        const cacheKey = `quota_${brandId}`;
        const cached = quotaCache.get(cacheKey);
        const forceRefresh = req.query.refresh === 'true';

        if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
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

        const provider = brand.emailProvider || 'ses';
        const ProviderFactory = await getProviderFactory();

        // Check if provider credentials are configured
        if (provider === 'ses' && (!brand.awsRegion || !brand.awsAccessKey || !brand.awsSecretKey)) {
            return res.status(200).json({
                configured: false,
                provider: 'ses',
                providerName: 'Amazon SES',
                message: 'AWS SES credentials not configured',
            });
        } else if (provider === 'sendgrid' && !brand.sendgridApiKey) {
            return res.status(200).json({
                configured: false,
                provider: 'sendgrid',
                providerName: 'SendGrid',
                message: 'SendGrid API key not configured',
            });
        } else if (provider === 'mailgun' && (!brand.mailgunApiKey || !brand.mailgunDomain)) {
            return res.status(200).json({
                configured: false,
                provider: 'mailgun',
                providerName: 'Mailgun',
                message: 'Mailgun credentials not configured',
            });
        }

        try {
            // Create provider instance
            const emailProvider = ProviderFactory.createProvider(brand);

            // Get quota from provider
            const quotaData = await emailProvider.getQuota();

            const responseData = {
                configured: true,
                provider,
                providerName: ProviderFactory.getProviderDisplayName(provider),
                quota: {
                    max24HourSend: quotaData.max24HourSend,
                    maxSendRate: quotaData.maxSendRate,
                    sentLast24Hours: quotaData.sentLast24Hours,
                    remainingQuota: quotaData.max24HourSend - quotaData.sentLast24Hours,
                    percentageUsed: quotaData.max24HourSend > 0 ? (quotaData.sentLast24Hours / quotaData.max24HourSend) * 100 : 0,
                    isMonthlyQuota: quotaData.isMonthlyQuota || false,
                },
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
        } catch (providerError) {
            console.error(`${provider} quota error:`, providerError);
            return res.status(500).json({
                message: `Error fetching quota from ${ProviderFactory.getProviderDisplayName(provider)}`,
                error: providerError.message,
            });
        }
    } catch (error) {
        console.error('Error fetching quota:', error);
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

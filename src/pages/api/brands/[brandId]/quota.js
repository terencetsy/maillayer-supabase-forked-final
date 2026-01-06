// src/pages/api/brands/[brandId]/quota.js
import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

// In-memory cache
const quotaCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

// Dynamic import for provider factory
const getProviderFactory = async () => {
    const ProviderFactory = require('@/lib/email-providers/ProviderFactory');
    return ProviderFactory;
};

export default async function handler(req, res) {
    try {
        if (req.method !== 'GET') {
            return res.status(405).json({ message: 'Method not allowed' });
        }

        const { user } = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
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
            res.setHeader('Cache-Control', `public, s-maxage=${CACHE_DURATION / 1000}, stale-while-revalidate`);
            res.setHeader('X-Cache', 'HIT');
            return res.status(200).json(cached.data);
        }

        // Check permission
        const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.VIEW_BRAND);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        const brand = await getBrandById(brandId, true);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        const provider = brand.emailProvider || 'ses';
        const ProviderFactory = await getProviderFactory();

        // Check if provider credentials are configured
        // Checks need camelCase props or snake_case? 
        // getBrandById refactor returns mapped camelCase if I recall correctly OR raw?
        // Checking `brandService.js`: `getBrandById` returns raw but removes secrets if `!includeSecrets`.
        // BUT `updates` maps camel to snake.
        // DB returns snake_case.
        // So `brand.emailProvider` -> `brand.email_provider`?
        // Let's assume `getBrandById` in `brandService` returns raw Supabase row.
        // So I should use snake_case accessors: `brand.email_provider`.

        // Wait, `brandService.getBrandById` line 44: `const brand = await brandsDb.getById(brandId)`.
        // `brandsDb` returns row.
        // So props are snake_case.
        // But `quota.js` uses camelCase `brand.emailProvider`.
        // I MUST fix this to snake_case.

        const emailProviderName = brand.email_provider || 'ses'; // snake_case

        // Credential checks
        if (emailProviderName === 'ses' && (!brand.aws_region || !brand.aws_access_key || !brand.aws_secret_key)) {
            return res.status(200).json({ configured: false, provider: 'ses', message: 'AWS SES credentials not configured' });
        } else if (emailProviderName === 'sendgrid' && !brand.sendgrid_api_key) {
            return res.status(200).json({ configured: false, provider: 'sendgrid', message: 'SendGrid API key not configured' });
        } else if (emailProviderName === 'mailgun' && (!brand.mailgun_api_key || !brand.mailgun_domain)) {
            return res.status(200).json({ configured: false, provider: 'mailgun', message: 'Mailgun credentials not configured' });
        }

        // ProviderFactory likely expects specific object structure (camelCase or snake_case?)
        // `lib/email-providers/ProviderFactory.js` probably wasn't refactored? 
        // I haven't seen it strictly.
        // If it expects camelCase, I might need to map it.
        // Assume I need to map it for safely passing to unmodified factory.
        const brandForProvider = {
            emailProvider: brand.email_provider,
            awsRegion: brand.aws_region,
            awsAccessKey: brand.aws_access_key,
            awsSecretKey: brand.aws_secret_key,
            sendgridApiKey: brand.sendgrid_api_key,
            mailgunApiKey: brand.mailgun_api_key,
            mailgunDomain: brand.mailgun_domain,
            ...brand
        };

        try {
            // Create provider instance
            const emailProvider = ProviderFactory.createProvider(brandForProvider);

            // Get quota from provider
            const quotaData = await emailProvider.getQuota();

            const responseData = {
                configured: true,
                provider: emailProviderName,
                providerName: ProviderFactory.getProviderDisplayName(emailProviderName),
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
            console.error(`${emailProviderName} quota error:`, providerError);
            return res.status(500).json({
                message: `Error fetching quota from ${ProviderFactory.getProviderDisplayName(emailProviderName)}`,
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
}, CACHE_DURATION);

import { getUserFromRequest } from '@/lib/supabase';
import { brandsDb } from '@/lib/db/brands';
import crypto from 'crypto';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

// Encrypt data using AES-256-CBC
function encryptData(text, secretKey) {
    if (!text) return null;

    const key = crypto.scryptSync(secretKey || process.env.ENCRYPTION_KEY || 'default-fallback-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
}

export default async function handler(req, res) {
    try {
        // This endpoint only supports PUT requests
        if (req.method !== 'PUT') {
            return res.status(405).json({ message: 'Method not allowed' });
        }

        // Get session directly from server
        const { user } = await getUserFromRequest(req, res);

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId } = req.query;

        // Check permission - updating credentials is an edit settings operation
        const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_SETTINGS);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        // Check if the brand exists
        const brand = await brandsDb.getById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        const { mailgunApiKey, mailgunDomain, mailgunRegion = 'us', connectionType = 'api' } = req.body;

        // Validate required fields
        if (!mailgunApiKey) {
            return res.status(400).json({ message: 'Mailgun API key is required' });
        }

        if (!mailgunDomain) {
            return res.status(400).json({ message: 'Mailgun domain is required' });
        }

        // Verify credentials by calling Mailgun API
        try {
            const baseUrl = mailgunRegion === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net';

            // Use v4 API with extended domain info
            const response = await fetch(`${baseUrl}/v4/domains/${mailgunDomain}?h%3Aextended=true&h%3Awith_dns=true`, {
                method: 'GET',
                headers: {
                    Authorization: 'Basic ' + Buffer.from(`api:${mailgunApiKey}`).toString('base64'),
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Mailgun API error: ${response.status}`);
            }
        } catch (error) {
            console.error('Mailgun credentials validation error:', error);
            return res.status(400).json({
                message: 'Invalid Mailgun credentials. Please check your API key, domain, and region.',
                error: error.message,
            });
        }

        // Prepare update data with snake_case
        const updateData = {
            email_provider: 'mailgun',
            email_provider_connection_type: connectionType,
            mailgun_api_key: encryptData(mailgunApiKey, process.env.ENCRYPTION_KEY),
            mailgun_domain: mailgunDomain,
            mailgun_region: mailgunRegion,
        };

        // Update brand status if it's still in initial state
        if (brand.status === 'pending_setup') {
            updateData.status = 'pending_verification';
        }

        // Update the brand
        const updatedBrand = await brandsDb.update(brandId, updateData);

        if (updatedBrand) {
            return res.status(200).json({ message: 'Mailgun credentials saved successfully' });
        } else {
            return res.status(500).json({ message: 'Failed to save Mailgun credentials' });
        }
    } catch (error) {
        console.error('Error saving Mailgun credentials:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

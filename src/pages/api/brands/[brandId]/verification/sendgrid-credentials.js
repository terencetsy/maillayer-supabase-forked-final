import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getBrandById, updateBrand } from '@/services/brandService';
import crypto from 'crypto';

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

        // Connect to database
        await connectToDatabase();

        // Get session directly from server
        const session = await getServerSession(req, res, authOptions);

        if (!session || !session.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = session.user.id;
        const { brandId } = req.query;

        // Check if the brand belongs to the user
        const brand = await getBrandById(brandId, true);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        if (brand.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to access this brand' });
        }

        const { sendgridApiKey, connectionType = 'api' } = req.body;

        // Validate required fields
        if (!sendgridApiKey) {
            return res.status(400).json({ message: 'SendGrid API key is required' });
        }

        // Verify credentials by calling SendGrid API
        try {
            const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${sendgridApiKey}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.errors?.[0]?.message || `SendGrid API error: ${response.status}`);
            }
        } catch (error) {
            console.error('SendGrid credentials validation error:', error);
            return res.status(400).json({
                message: 'Invalid SendGrid API key. Please check your credentials.',
                error: error.message,
            });
        }

        // Prepare update data
        const updateData = {
            emailProvider: 'sendgrid',
            emailProviderConnectionType: connectionType,
            sendgridApiKey: encryptData(sendgridApiKey, process.env.ENCRYPTION_KEY),
        };

        // Update brand status if it's still in initial state
        if (brand.status === 'pending_setup') {
            updateData.status = 'pending_verification';
        }

        // Update the brand
        const success = await updateBrand(brandId, updateData);

        if (success) {
            return res.status(200).json({ message: 'SendGrid credentials saved successfully' });
        } else {
            return res.status(500).json({ message: 'Failed to save SendGrid credentials' });
        }
    } catch (error) {
        console.error('Error saving SendGrid credentials:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

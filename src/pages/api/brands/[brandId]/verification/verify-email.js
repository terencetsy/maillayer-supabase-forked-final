import { getUserFromRequest } from '@/lib/supabase';
import { brandsDb } from '@/lib/db/brands';
import AWS from 'aws-sdk';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    try {
        // This endpoint only supports POST requests
        if (req.method !== 'POST') {
            return res.status(405).json({ message: 'Method not allowed' });
        }

        // Get session directly from server
        const { user } = await getUserFromRequest(req, res);

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId } = req.query;

        // Check permission - email verification is an edit settings operation
        const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_SETTINGS);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        // Check if the brand exists
        const brand = await brandsDb.getById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // Make sure AWS credentials are set up first (snake_case)
        if (!brand.aws_region || !brand.aws_access_key || !brand.aws_secret_key) {
            return res.status(400).json({ message: 'AWS credentials not set up. Please complete Step 1 first.' });
        }

        const { email } = req.body;

        // Validate email
        if (!email) {
            return res.status(400).json({ message: 'Email address is required' });
        }

        // Initialize AWS SES client
        const ses = new AWS.SES({
            region: brand.aws_region,
            accessKeyId: brand.aws_access_key,
            secretAccessKey: brand.aws_secret_key,
        });

        try {
            // Send verification email
            await ses
                .verifyEmailIdentity({
                    EmailAddress: email,
                })
                .promise();

            // Update fromEmail in brand (snake_case)
            await brandsDb.update(brandId, { from_email: email });

            return res.status(200).json({
                message: 'Verification email sent successfully',
                email,
            });
        } catch (error) {
            console.error('Error sending verification email:', error);
            return res.status(400).json({
                message: 'Failed to send verification email',
                error: error.message,
            });
        }
    } catch (error) {
        console.error('Error in verify-email endpoint:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

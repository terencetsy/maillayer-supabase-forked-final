import { getUserFromRequest } from '@/lib/supabase';
import { brandsDb } from '@/lib/db/brands';
import AWS from 'aws-sdk';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    try {
        // This endpoint only supports GET requests
        if (req.method !== 'GET') {
            return res.status(405).json({ message: 'Method not allowed' });
        }

        // Get session directly from server
        const { user } = await getUserFromRequest(req, res);

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId } = req.query;
        const email = req.query.email;

        if (!email) {
            return res.status(400).json({ message: 'Email parameter is required' });
        }

        // Check permission - checking email is an edit settings operation
        const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_SETTINGS);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        // Check if the brand exists
        const brand = await brandsDb.getById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // Make sure AWS credentials are set up (using snake_case)
        if (!brand.aws_region || !brand.aws_access_key || !brand.aws_secret_key) {
            return res.status(400).json({ message: 'AWS credentials not set up' });
        }

        // Initialize AWS SES client
        const ses = new AWS.SES({
            region: brand.aws_region,
            accessKeyId: brand.aws_access_key,
            secretAccessKey: brand.aws_secret_key,
        });

        try {
            // Check if the email is verified
            const response = await ses
                .getIdentityVerificationAttributes({
                    Identities: [email],
                })
                .promise();

            const attributes = response.VerificationAttributes[email];
            const isVerified = attributes && attributes.VerificationStatus === 'Success';

            return res.status(200).json({
                verified: isVerified,
                email,
                status: attributes ? attributes.VerificationStatus : 'NotStarted',
            });
        } catch (error) {
            console.error('Error checking email verification status:', error);
            return res.status(400).json({
                message: 'Failed to check email verification status',
                error: error.message,
            });
        }
    } catch (error) {
        console.error('Error in check-email endpoint:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

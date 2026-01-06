import { getUserFromRequest } from '@/lib/supabase';
import { brandsDb } from '@/lib/db/brands';
import AWS from 'aws-sdk';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

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

        const { awsRegion, awsAccessKey, awsSecretKey } = req.body;

        // Validate required fields
        if (!awsRegion || !awsAccessKey) {
            return res.status(400).json({ message: 'AWS region and access key are required' });
        }

        // If secret key is provided, verify credentials by attempting to use the SES service
        if (awsSecretKey) {
            try {
                const ses = new AWS.SES({
                    region: awsRegion,
                    accessKeyId: awsAccessKey,
                    secretAccessKey: awsSecretKey,
                });

                // Try to list verified identities to check if credentials are valid
                await ses.listIdentities().promise();
            } catch (error) {
                console.error('AWS SES credentials validation error:', error);
                return res.status(400).json({
                    message: 'Invalid AWS credentials. Please check your region, access key, and secret key.',
                    error: error.message,
                });
            }
        }

        // Prepare update data with snake_case for Supabase
        const updateData = {
            aws_region: awsRegion,
            aws_access_key: awsAccessKey,
        };

        // Only update the secret key if a new one is provided
        if (awsSecretKey) {
            updateData.aws_secret_key = awsSecretKey;
        }

        // Update brand status if it's still in initial state
        if (brand.status === 'pending_setup') {
            updateData.status = 'pending_verification';
        }

        // Update the brand
        const updatedBrand = await brandsDb.update(brandId, updateData);

        if (updatedBrand) {
            return res.status(200).json({ message: 'AWS credentials saved successfully' });
        } else {
            return res.status(500).json({ message: 'Failed to save AWS credentials' });
        }
    } catch (error) {
        console.error('Error saving AWS credentials:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

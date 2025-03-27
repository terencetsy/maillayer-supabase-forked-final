import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getBrandById, updateBrand } from '@/services/brandService';
import AWS from 'aws-sdk';

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

        // Prepare update data
        const updateData = {
            awsRegion,
            awsAccessKey,
        };

        // Only update the secret key if a new one is provided
        if (awsSecretKey) {
            updateData.awsSecretKey = awsSecretKey;
        }

        // Update brand status if it&apos; still in initial state
        if (brand.status === 'pending_setup') {
            updateData.status = 'pending_verification';
        }

        // Update the brand
        const success = await updateBrand(brandId, updateData);

        if (success) {
            return res.status(200).json({ message: 'AWS credentials saved successfully' });
        } else {
            return res.status(500).json({ message: 'Failed to save AWS credentials' });
        }
    } catch (error) {
        console.error('Error saving AWS credentials:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

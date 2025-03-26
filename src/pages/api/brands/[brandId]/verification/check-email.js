import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getBrandById } from '@/services/brandService';
import AWS from 'aws-sdk';

export default async function handler(req, res) {
    try {
        // This endpoint only supports GET requests
        if (req.method !== 'GET') {
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
        const email = req.query.email;

        if (!email) {
            return res.status(400).json({ message: 'Email parameter is required' });
        }

        // Check if the brand belongs to the user
        const brand = await getBrandById(brandId, true);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        if (brand.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to access this brand' });
        }

        // Make sure AWS credentials are set up
        if (!brand.awsRegion || !brand.awsAccessKey || !brand.awsSecretKey) {
            return res.status(400).json({ message: 'AWS credentials not set up' });
        }

        // Initialize AWS SES client
        const ses = new AWS.SES({
            region: brand.awsRegion,
            accessKeyId: brand.awsAccessKey,
            secretAccessKey: brand.awsSecretKey,
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

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
        const domain = req.query.domain;

        if (!domain) {
            return res.status(400).json({ message: 'Domain parameter is required' });
        }

        // Check permission - checking domain is an edit settings operation
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
            // Check domain verification status
            const domainVerificationResult = await ses
                .getIdentityVerificationAttributes({
                    Identities: [domain],
                })
                .promise();

            // Get the verification token from the domain verification
            const domainAttributes = domainVerificationResult.VerificationAttributes[domain];
            const verificationToken = domainAttributes ? domainAttributes.VerificationToken : null;

            // Check DKIM status
            const dkimResult = await ses
                .getIdentityDkimAttributes({
                    Identities: [domain],
                })
                .promise();

            const dkimAttributes = dkimResult.DkimAttributes[domain];

            // If DKIM tokens aren't available but domain is verified, we need to generate them
            let dkimTokens = [];
            if (domainAttributes && domainAttributes.VerificationStatus === 'Success' && (!dkimAttributes || !dkimAttributes.DkimTokens || dkimAttributes.DkimTokens.length === 0)) {
                // Try to fetch DKIM tokens by enabling DKIM if it's not already enabled
                try {
                    await ses
                        .setIdentityDkimEnabled({
                            Identity: domain,
                            DkimEnabled: true,
                        })
                        .promise();

                    // Fetch the DKIM tokens again after enabling
                    const updatedDkimResult = await ses
                        .getIdentityDkimAttributes({
                            Identities: [domain],
                        })
                        .promise();

                    const updatedDkimAttributes = updatedDkimResult.DkimAttributes[domain];
                    if (updatedDkimAttributes && updatedDkimAttributes.DkimTokens) {
                        dkimTokens = updatedDkimAttributes.DkimTokens;
                    }
                } catch (dkimError) {
                    console.error('Error enabling DKIM:', dkimError);
                    // Continue without DKIM tokens if there's an error
                }
            } else if (dkimAttributes && dkimAttributes.DkimTokens) {
                dkimTokens = dkimAttributes.DkimTokens;
            }

            // Return the comprehensive verification data
            return res.status(200).json({
                domain,
                domainVerified: domainAttributes ? domainAttributes.VerificationStatus === 'Success' : false,
                domainStatus: domainAttributes ? domainAttributes.VerificationStatus : 'NotStarted',
                dkimEnabled: dkimAttributes ? dkimAttributes.DkimEnabled : false,
                dkimVerified: dkimAttributes ? dkimAttributes.DkimVerificationStatus === 'Success' : false,
                dkimStatus: dkimAttributes ? dkimAttributes.DkimVerificationStatus : 'NotStarted',
                dkimTokens: dkimTokens,
                verificationToken: verificationToken,
            });
        } catch (error) {
            console.error('Error checking domain verification status:', error);
            return res.status(400).json({
                message: 'Failed to check domain verification status',
                error: error.message,
            });
        }
    } catch (error) {
        console.error('Error in check-domain endpoint:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

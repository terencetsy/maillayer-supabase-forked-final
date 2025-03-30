// src/pages/api/brands/[brandId]/verification/verify-domain.js
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getBrandById, updateBrand } from '@/services/brandService';
import AWS from 'aws-sdk';
import config from '@/lib/config';

export default async function handler(req, res) {
    try {
        // This endpoint only supports POST requests
        if (req.method !== 'POST') {
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

        // Make sure AWS credentials are set up first
        if (!brand.awsRegion || !brand.awsAccessKey || !brand.awsSecretKey) {
            return res.status(400).json({ message: 'AWS credentials not set up. Please complete Step 1 first.' });
        }

        const { domain } = req.body;

        // Validate domain
        if (!domain) {
            return res.status(400).json({ message: 'Domain is required' });
        }

        // Validate domain format
        const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
        if (!domainRegex.test(domain)) {
            return res.status(400).json({ message: 'Invalid domain format' });
        }

        // Initialize AWS SES and SNS clients
        const ses = new AWS.SES({
            region: brand.awsRegion,
            accessKeyId: brand.awsAccessKey,
            secretAccessKey: brand.awsSecretKey,
        });

        const sns = new AWS.SNS({
            region: brand.awsRegion,
            accessKeyId: brand.awsAccessKey,
            secretAccessKey: brand.awsSecretKey,
        });

        try {
            // First check if the domain is already verified
            const identityResponse = await ses
                .getIdentityVerificationAttributes({
                    Identities: [domain],
                })
                .promise();

            const verificationAttributes = identityResponse.VerificationAttributes;
            const verificationStatus = verificationAttributes && verificationAttributes[domain] ? verificationAttributes[domain].VerificationStatus : 'NotVerified';

            // If not verified, initiate domain verification
            if (verificationStatus !== 'Success') {
                // Step 1: Verify domain identity (get the TXT record)
                await ses
                    .verifyDomainIdentity({
                        Domain: domain,
                    })
                    .promise();
            }

            // Step 2: Enable DKIM for the domain (always try this even if domain is verified)
            await ses
                .verifyDomainDkim({
                    Domain: domain,
                })
                .promise();

            // Get the DKIM configuration
            const dkimResponse = await ses
                .getIdentityDkimAttributes({
                    Identities: [domain],
                })
                .promise();

            // Step 3: Set up SNS for bounce tracking
            // Create or find SNS topic
            const topicName = `${domain.replace(/\./g, '-')}-bounces`;
            const listTopicsResponse = await sns.listTopics().promise();
            let topicArn = listTopicsResponse.Topics.find((topic) => topic.TopicArn.includes(topicName))?.TopicArn;

            if (!topicArn) {
                const createTopicResponse = await sns.createTopic({ Name: topicName }).promise();
                topicArn = createTopicResponse.TopicArn;
            }

            // Step 4: Subscribe to the SNS topic
            // Define your webhook endpoint where you want to receive bounce notifications
            const webhookEndpoint = `${config.baseUrl}/api/webhooks/ses-notifications`;

            try {
                await sns
                    .subscribe({
                        Protocol: 'https',
                        TopicArn: topicArn,
                        Endpoint: webhookEndpoint,
                    })
                    .promise();
            } catch (snsError) {
                console.warn('SNS subscription error (non-fatal):', snsError.message);
                // Continue even if subscription fails, as it might be due to endpoint not being available yet
            }

            // Step 5: Create SES configuration set and event destination
            const configurationSetName = `${domain.replace(/\./g, '-')}`;
            let configSetExists = false;

            try {
                await ses
                    .describeConfigurationSet({
                        ConfigurationSetName: configurationSetName,
                    })
                    .promise();
                configSetExists = true;
            } catch (err) {
                if (err.code !== 'ConfigurationSetDoesNotExist') {
                    // If it's any other error, just log it and continue
                    console.warn('Configuration set check error (non-fatal):', err.message);
                }
            }

            if (!configSetExists) {
                try {
                    // Create configuration set
                    await ses
                        .createConfigurationSet({
                            ConfigurationSet: {
                                Name: configurationSetName,
                            },
                        })
                        .promise();

                    // Create event destination for the configuration set
                    await ses
                        .createConfigurationSetEventDestination({
                            ConfigurationSetName: configurationSetName,
                            EventDestination: {
                                Name: `${configurationSetName}-sns-destination`,
                                Enabled: true,
                                MatchingEventTypes: ['send', 'delivery', 'bounce', 'complaint', 'reject'],
                                SNSDestination: {
                                    TopicARN: topicArn,
                                },
                            },
                        })
                        .promise();

                    await ses
                        .updateConfigurationSet({
                            ConfigurationSet: {
                                Name: configurationSetName,
                            },
                            MessageTagsConfiguration: {
                                MessageTags: [
                                    {
                                        Name: 'campaignId',
                                        DefaultValue: 'none',
                                    },
                                    {
                                        Name: 'contactId',
                                        DefaultValue: 'none',
                                    },
                                ],
                            },
                        })
                        .promise();
                } catch (configError) {
                    console.warn('Configuration set setup error (non-fatal):', configError.message);
                    // Continue even if config set creation fails
                }
            }

            // Update sendingDomain and tracking information in brand
            await updateBrand(brandId, {
                sendingDomain: domain,
                status: 'pending_verification',
                // Save SNS topic ARN and configuration set name for future use
                snsBounceTopicArn: topicArn,
                sesConfigurationSet: configurationSetName,
            });

            // Get the latest verification token
            const verificationTokenResult = await ses
                .getIdentityVerificationAttributes({
                    Identities: [domain],
                })
                .promise();

            // Send back all the verification info
            return res.status(200).json({
                message: 'Domain verification and bounce tracking setup initiated successfully',
                domain,
                verificationToken: verificationTokenResult.VerificationAttributes[domain]?.VerificationToken,
                dkimTokens: dkimResponse.DkimAttributes[domain]?.DkimTokens || [],
                dkimEnabled: dkimResponse.DkimAttributes[domain]?.DkimEnabled || false,
                dkimVerificationStatus: dkimResponse.DkimAttributes[domain]?.DkimVerificationStatus || 'NotStarted',
                domainVerificationStatus: verificationStatus,
                bounceTrackingConfigured: true,
                snsTopicArn: topicArn,
                configurationSetName: configurationSetName,
            });
        } catch (error) {
            console.error('Error verifying domain and setting up bounce tracking:', error);
            return res.status(400).json({
                message: 'Failed to verify domain or set up bounce tracking',
                error: error.message,
            });
        }
    } catch (error) {
        console.error('Error in verify-domain endpoint:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

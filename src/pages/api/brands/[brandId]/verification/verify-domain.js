// src/pages/api/brands/[brandId]/verification/verify-domain.js
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getBrandById, updateBrand } from '@/services/brandService';
import {
    SESClient,
    GetIdentityVerificationAttributesCommand,
    VerifyDomainIdentityCommand,
    VerifyDomainDkimCommand,
    GetIdentityDkimAttributesCommand,
    DescribeConfigurationSetCommand,
    CreateConfigurationSetCommand,
    CreateConfigurationSetEventDestinationCommand,
    SetIdentityFeedbackForwardingEnabledCommand,
    SetIdentityHeadersInNotificationsEnabledCommand,
    SetIdentityNotificationAttributesCommand,
} from '@aws-sdk/client-ses';
import { SNSClient, ListTopicsCommand, CreateTopicCommand, SubscribeCommand } from '@aws-sdk/client-sns';
import { SESv2Client, PutEmailIdentityConfigurationSetAttributesCommand } from '@aws-sdk/client-sesv2';

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
        const sesClient = new SESClient({
            region: brand.awsRegion,
            credentials: {
                accessKeyId: brand.awsAccessKey,
                secretAccessKey: brand.awsSecretKey,
            },
        });

        const sesv2Client = new SESv2Client({
            region: brand.awsRegion,
            credentials: {
                accessKeyId: brand.awsAccessKey,
                secretAccessKey: brand.awsSecretKey,
            },
        });

        const snsClient = new SNSClient({
            region: brand.awsRegion,
            credentials: {
                accessKeyId: brand.awsAccessKey,
                secretAccessKey: brand.awsSecretKey,
            },
        });

        try {
            // First check if the domain is already verified
            const identityResponse = await sesClient.send(
                new GetIdentityVerificationAttributesCommand({
                    Identities: [domain],
                })
            );

            const verificationAttributes = identityResponse.VerificationAttributes;
            const verificationStatus = verificationAttributes && verificationAttributes[domain] ? verificationAttributes[domain].VerificationStatus : 'NotVerified';

            // If not verified, initiate domain verification
            if (verificationStatus !== 'Success') {
                // Step 1: Verify domain identity (get the TXT record)
                await sesClient.send(
                    new VerifyDomainIdentityCommand({
                        Domain: domain,
                    })
                );
            }

            // Step 2: Enable DKIM for the domain (always try this even if domain is verified)
            await sesClient.send(
                new VerifyDomainDkimCommand({
                    Domain: domain,
                })
            );

            // Get the DKIM configuration
            const dkimResponse = await sesClient.send(
                new GetIdentityDkimAttributesCommand({
                    Identities: [domain],
                })
            );

            // Step 3: Set up SNS for bounce tracking
            // Create or find SNS topic
            const topicName = `${domain.replace(/\./g, '-')}-bounces`;
            const listTopicsResponse = await snsClient.send(new ListTopicsCommand({}));
            let topicArn = listTopicsResponse.Topics.find((topic) => topic.TopicArn.includes(topicName))?.TopicArn;

            if (!topicArn) {
                const createTopicResponse = await snsClient.send(new CreateTopicCommand({ Name: topicName }));
                topicArn = createTopicResponse.TopicArn;
            }

            // Step 4: Subscribe to the SNS topic
            // Define your webhook endpoint where you want to receive bounce notifications
            const webhookEndpoint = `${config.baseUrl}/api/webhooks/ses-notifications`;

            try {
                await snsClient.send(
                    new SubscribeCommand({
                        Protocol: 'https',
                        TopicArn: topicArn,
                        Endpoint: webhookEndpoint,
                    })
                );
            } catch (snsError) {
                console.warn('SNS subscription error (non-fatal):', snsError.message);
                // Continue even if subscription fails, as it might be due to endpoint not being available yet
            }

            // Step 5: Create SES configuration set and event destination
            const configurationSetName = `${domain.replace(/\./g, '-')}`;
            let configSetExists = false;

            try {
                await sesClient.send(
                    new DescribeConfigurationSetCommand({
                        ConfigurationSetName: configurationSetName,
                    })
                );
                configSetExists = true;
            } catch (err) {
                if (err.name !== 'ConfigurationSetDoesNotExist') {
                    // If it's any other error, just log it and continue
                    console.warn('Configuration set check error (non-fatal):', err.message);
                }
            }

            if (!configSetExists) {
                try {
                    // Step 1: Create configuration set
                    await sesClient.send(
                        new CreateConfigurationSetCommand({
                            ConfigurationSet: {
                                Name: configurationSetName,
                            },
                        })
                    );

                    // Step 2: Create event destination for the configuration set
                    await sesClient.send(
                        new CreateConfigurationSetEventDestinationCommand({
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
                    );
                } catch (configError) {
                    console.warn('Configuration set setup error (non-fatal):', configError.message);
                    // Continue even if config set creation fails
                }
            }

            // Additional configurations to ensure tags are included in notifications
            try {
                // Configure feedback forwarding
                await sesClient.send(
                    new SetIdentityFeedbackForwardingEnabledCommand({
                        Identity: domain,
                        ForwardingEnabled: true,
                    })
                );

                // Enable header notifications for this identity
                await sesClient.send(
                    new SetIdentityHeadersInNotificationsEnabledCommand({
                        Identity: domain,
                        Enabled: true,
                        NotificationType: 'Bounce',
                    })
                );

                await sesClient.send(
                    new SetIdentityHeadersInNotificationsEnabledCommand({
                        Identity: domain,
                        Enabled: true,
                        NotificationType: 'Complaint',
                    })
                );

                // Enable notification attributes and set SNS topics
                await sesClient.send(
                    new SetIdentityNotificationAttributesCommand({
                        Identity: domain,
                        BounceTopic: topicArn,
                        ComplaintTopic: topicArn,
                        ForwardingEnabled: true,
                    })
                );
            } catch (identityError) {
                console.warn('Identity configuration error (non-fatal):', identityError.message);
            }

            // Set the configuration set as the default for the domain identity
            try {
                await sesv2Client.send(
                    new PutEmailIdentityConfigurationSetAttributesCommand({
                        EmailIdentity: domain,
                        ConfigurationSetName: configurationSetName,
                    })
                );
                console.log(`Successfully set ${configurationSetName} as the default configuration set for ${domain}`);
            } catch (defaultConfigError) {
                console.warn('Error setting default configuration set (non-fatal):', defaultConfigError.message);
                // Continue even if setting default configuration set fails
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
            const verificationTokenResult = await sesClient.send(
                new GetIdentityVerificationAttributesCommand({
                    Identities: [domain],
                })
            );

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

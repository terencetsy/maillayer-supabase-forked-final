import connectToDatabase from '@/lib/mongodb';
import { getTemplateByApiKey, logTransactionalEmail } from '@/services/transactionalService';
import AWS from 'aws-sdk';
import Brand from '@/models/Brand';
import { generateTrackingToken } from '@/services/trackingService';
import config from '@/lib/config';

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed', success: false });
    }

    try {
        // Connect to database
        await connectToDatabase();

        const { apiKey, to, variables = {} } = req.body;

        if (!apiKey) {
            return res.status(401).json({ message: 'API key is required', success: false });
        }

        if (!to || !to.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({ message: 'Valid recipient email is required', success: false });
        }

        // Get template by API key
        const template = await getTemplateByApiKey(apiKey);
        if (!template) {
            return res.status(404).json({ message: 'Invalid API key or template not found', success: false });
        }

        // Verify if template is active
        if (template.status !== 'active') {
            return res.status(403).json({ message: 'Template is not active', success: false });
        }

        // Get brand to retrieve AWS credentials
        const brand = await Brand.findById(template.brandId).select('+awsSecretKey');

        if (!brand) {
            return res.status(404).json({ message: 'Brand not found', success: false });
        }

        // Check if AWS credentials are configured
        if (!brand.awsRegion || !brand.awsAccessKey || !brand.awsSecretKey) {
            return res.status(400).json({
                message: 'AWS SES credentials not configured for this brand',
                success: false,
            });
        }

        // Check if brand is verified
        if (brand.status !== 'active') {
            return res.status(400).json({
                message: 'Brand is not fully verified for sending emails',
                success: false,
            });
        }

        // Check if required variables are provided
        const missingVariables = [];
        if (template.variables && template.variables.length > 0) {
            for (const variable of template.variables) {
                if (variable.required && !variables[variable.name]) {
                    missingVariables.push(variable.name);
                }
            }
        }

        if (missingVariables.length > 0) {
            return res.status(400).json({
                message: `Missing required variables: ${missingVariables.join(', ')}`,
                success: false,
            });
        }

        // Replace variables in subject and content
        let subject = template.subject;
        let content = template.content;

        // Replace variables in template
        Object.keys(variables).forEach((key) => {
            const regex = new RegExp(`\\[${key}\\]`, 'g');
            subject = subject.replace(regex, variables[key]);
            content = content.replace(regex, variables[key]);
        });

        // Generate tracking tokens
        const trackingToken = generateTrackingToken(
            template._id.toString(),
            'txn', // Use 'txn' as contactId for transactional emails
            to
        );

        const trackingPixel = `<img src="${config.baseUrl}/api/tracking/transactional?token=${trackingToken}&email=${encodeURIComponent(to)}" width="1" height="1" alt="" style="display:none;" />`;
        content = content + trackingPixel;

        // Initialize SES client
        const ses = new AWS.SES({
            region: brand.awsRegion,
            accessKeyId: brand.awsAccessKey,
            secretAccessKey: brand.awsSecretKey,
        });

        // Set up email parameters
        const fromName = template.fromName || brand.fromName || brand.name;
        const fromEmail = template.fromEmail || brand.fromEmail;
        const replyTo = template.replyTo || brand.replyToEmail || fromEmail;

        const emailParams = {
            Source: `${fromName} <${fromEmail}>`,
            Destination: {
                ToAddresses: [to],
            },
            Message: {
                Subject: {
                    Data: subject,
                    Charset: 'UTF-8',
                },
                Body: {
                    Html: {
                        Data: content,
                        Charset: 'UTF-8',
                    },
                },
            },
            ReplyToAddresses: [replyTo],
            ConfigurationSetName: brand.sesConfigurationSet || undefined,
            Tags: [
                {
                    Name: 'templateId',
                    Value: template._id.toString(),
                },
                {
                    Name: 'type',
                    Value: 'transactional',
                },
            ],
        };

        // Send email
        const sendResult = await ses.sendEmail(emailParams).promise();

        // Log the transactional email
        await logTransactionalEmail({
            templateId: template._id,
            brandId: template.brandId,
            userId: template.userId,
            to,
            subject,
            variables,
            status: 'sent',
            metadata: {
                messageId: sendResult.MessageId,
                // Get IP and user agent from request
                ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                userAgent: req.headers['user-agent'],
            },
        });

        return res.status(200).json({
            success: true,
            message: 'Email sent successfully',
            messageId: sendResult.MessageId,
        });
    } catch (error) {
        console.error('Error sending transactional email:', error);
        return res.status(500).json({
            message: error.message || 'Error sending email',
            success: false,
        });
    }
}

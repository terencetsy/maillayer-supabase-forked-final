import connectToDatabase from '@/lib/mongodb';
import { getTemplateByApiKey, logTransactionalEmail } from '@/services/transactionalService';
import Brand from '@/models/Brand';
import { generateTrackingToken } from '@/services/trackingService';
import config from '@/lib/config';
import crypto from 'crypto';

// Decrypt encrypted data using AES-256-CBC
function decryptData(encryptedText, secretKey) {
    try {
        if (!encryptedText) return null;
        if (!encryptedText.includes(':')) return encryptedText;

        const key = crypto.scryptSync(secretKey || process.env.ENCRYPTION_KEY || 'default-fallback-key', 'salt', 32);
        const parts = encryptedText.split(':');
        if (parts.length !== 2) return encryptedText;

        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = Buffer.from(parts[1], 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        return encryptedText;
    }
}

// Dynamic import for provider factory (CommonJS module)
const getProviderFactory = async () => {
    const ProviderFactory = require('@/lib/email-providers/ProviderFactory');
    return ProviderFactory;
};

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

        // Get brand to retrieve email provider credentials
        const brand = await Brand.findById(template.brandId).select('+awsSecretKey +sendgridApiKey +mailgunApiKey +smtpPassword');

        if (!brand) {
            return res.status(404).json({ message: 'Brand not found', success: false });
        }

        // Check if email provider credentials are configured
        const provider = brand.emailProvider || 'ses';
        if (provider === 'ses' && (!brand.awsRegion || !brand.awsAccessKey || !brand.awsSecretKey)) {
            return res.status(400).json({
                message: 'AWS SES credentials not configured for this brand',
                success: false,
            });
        } else if (provider === 'sendgrid' && !brand.sendgridApiKey) {
            return res.status(400).json({
                message: 'SendGrid API key not configured for this brand',
                success: false,
            });
        } else if (provider === 'mailgun' && (!brand.mailgunApiKey || !brand.mailgunDomain)) {
            return res.status(400).json({
                message: 'Mailgun credentials not configured for this brand',
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

        // Add tracking pixel if open tracking is enabled (default: true for backward compatibility)
        if (template.trackingConfig?.trackOpens !== false) {
            // Generate tracking token
            const trackingToken = generateTrackingToken(
                template._id.toString(),
                'txn', // Use 'txn' as contactId for transactional emails
                to
            );

            // Create a tracking pixel with proper URL encoding
            const trackingPixel = `<img src="${config.baseUrl}/api/tracking/transactional?token=${encodeURIComponent(trackingToken)}&templateId=${encodeURIComponent(template._id)}&email=${encodeURIComponent(to)}" width="1" height="1" alt="" style="display:none;" />`;

            // Add tracking pixel at the end of the content, right before the closing body tag if possible
            if (content.includes('</body>')) {
                content = content.replace('</body>', `${trackingPixel}</body>`);
            } else {
                content = content + trackingPixel;
            }
        }

        // Create email provider using factory
        const ProviderFactory = await getProviderFactory();
        const brandWithDecryptedSecrets = {
            ...brand.toObject(),
            awsSecretKey: decryptData(brand.awsSecretKey, process.env.ENCRYPTION_KEY),
            sendgridApiKey: decryptData(brand.sendgridApiKey, process.env.ENCRYPTION_KEY),
            mailgunApiKey: decryptData(brand.mailgunApiKey, process.env.ENCRYPTION_KEY),
            smtpPassword: decryptData(brand.smtpPassword, process.env.ENCRYPTION_KEY),
        };
        const emailProvider = ProviderFactory.createProvider(brandWithDecryptedSecrets, { decryptSecrets: false });

        // Set up email parameters
        const fromName = template.fromName || brand.fromName || brand.name;
        const fromEmail = template.fromEmail || brand.fromEmail;
        const replyTo = template.replyTo || brand.replyToEmail || fromEmail;

        // Send email using provider abstraction
        const sendResult = await emailProvider.send({
            from: `${fromName} <${fromEmail}>`,
            to,
            subject,
            html: content,
            replyTo,
            tags: [
                { name: 'templateId', value: template._id.toString() },
                { name: 'type', value: 'transactional' },
            ],
        });

        // Log the transactional email
        await logTransactionalEmail({
            templateId: template._id,
            brandId: template.brandId,
            userId: template.userId,
            to,
            subject,
            variables,
            status: 'sent',
            events: [], // Initialize empty events array for tracking
            metadata: {
                messageId: sendResult.messageId,
                provider: emailProvider.getName(),
                // Get IP and user agent from request
                ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                userAgent: req.headers['user-agent'],
            },
        });

        return res.status(200).json({
            success: true,
            message: 'Email sent successfully',
            messageId: sendResult.messageId,
        });
    } catch (error) {
        console.error('Error sending transactional email:', error);
        return res.status(500).json({
            message: error.message || 'Error sending email',
            success: false,
        });
    }
}

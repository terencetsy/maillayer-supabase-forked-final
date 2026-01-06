import { getTemplateByApiKey, logTransactionalEmail } from '@/services/transactionalService';
import { supabaseAdmin } from '@/lib/supabase';
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
        const { apiKey, to, variables = {} } = req.body;

        if (!apiKey) {
            return res.status(401).json({ message: 'API key is required', success: false });
        }

        if (!to || !to.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({ message: 'Valid recipient email is required', success: false });
        }

        // Get template by API key (uses transactionalDb -> supabaseAdmin)
        const template = await getTemplateByApiKey(apiKey);
        if (!template) {
            return res.status(404).json({ message: 'Invalid API key or template not found', success: false });
        }

        // Verify if template is active
        if (template.status !== 'active') {
            return res.status(403).json({ message: 'Template is not active', success: false });
        }

        // Get brand to retrieve email provider credentials
        // Use supabaseAdmin to bypass RLS as we are in a system process (authenticated by API key)
        const { data: brand, error: brandError } = await supabaseAdmin
            .from('brands')
            .select('*') // Select all including secrets (RLS setup typically handles visibility, but Admin bypasses)
            .eq('id', template.brand_id || template.brandId) // Handle snake_case or camelCase from DB
            .single();

        if (brandError || !brand) {
            console.error('Brand fetch error:', brandError);
            return res.status(404).json({ message: 'Brand not found', success: false });
        }

        // Check if email provider credentials are configured
        // Note: Supabase columns are usually snake_case. 
        // Need to check if `brands` table uses camelCase or snake_case columns.
        // Assuming snake_case based on general Supabase conventions.
        // Map snake_case to camelCase for the logic below if needed, or update logic.
        // Given previous code used Mongoose `Brand` model which had `awsSecretKey`, migration might have preserved names OR created snake_case.
        // Standard Supabase migrations use snake_case.
        // Let's assume snake_case: `aws_region`, `aws_access_key`, `aws_secret_key`, `sendgrid_api_key`, `email_provider`.

        const provider = brand.email_provider || brand.emailProvider || 'ses';
        const brandData = {
            ...brand,
            awsRegion: brand.aws_region || brand.awsRegion,
            awsAccessKey: brand.aws_access_key || brand.awsAccessKey,
            awsSecretKey: brand.aws_secret_key || brand.awsSecretKey,
            sendgridApiKey: brand.sendgrid_api_key || brand.sendgridApiKey,
            mailgunApiKey: brand.mailgun_api_key || brand.mailgunApiKey,
            mailgunDomain: brand.mailgun_domain || brand.mailgunDomain,
            smtpPassword: brand.smtp_password || brand.smtpPassword,
            fromName: brand.from_name || brand.fromName,
            fromEmail: brand.from_email || brand.fromEmail,
            replyToEmail: brand.reply_to_email || brand.replyToEmail,
        };

        if (provider === 'ses' && (!brandData.awsRegion || !brandData.awsAccessKey || !brandData.awsSecretKey)) {
            return res.status(400).json({
                message: 'AWS SES credentials not configured for this brand',
                success: false,
            });
        } else if (provider === 'sendgrid' && !brandData.sendgridApiKey) {
            return res.status(400).json({
                message: 'SendGrid API key not configured for this brand',
                success: false,
            });
        } else if (provider === 'mailgun' && (!brandData.mailgunApiKey || !brandData.mailgunDomain)) {
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
        if (template.tracking_config?.track_opens !== false && template.trackingConfig?.trackOpens !== false) {
            const trackingEnabled = template.tracking_config?.track_opens ?? template.trackingConfig?.trackOpens ?? true;

            if (trackingEnabled) {
                // Generate tracking token
                const trackingToken = generateTrackingToken(
                    template.id || template._id,
                    'txn', // Use 'txn' as contactId for transactional emails
                    to
                );

                // Create a tracking pixel with proper URL encoding
                const trackingPixel = `<img src="${config.baseUrl}/api/tracking/transactional?token=${encodeURIComponent(trackingToken)}&templateId=${encodeURIComponent(template.id || template._id)}&email=${encodeURIComponent(to)}" width="1" height="1" alt="" style="display:none;" />`;

                // Add tracking pixel at the end of the content, right before the closing body tag if possible
                if (content.includes('</body>')) {
                    content = content.replace('</body>', `${trackingPixel}</body>`);
                } else {
                    content = content + trackingPixel;
                }
            }
        }

        // Create email provider using factory
        const ProviderFactory = await getProviderFactory();
        const brandWithDecryptedSecrets = {
            ...brandData,
            awsSecretKey: decryptData(brandData.awsSecretKey, process.env.ENCRYPTION_KEY),
            sendgridApiKey: decryptData(brandData.sendgridApiKey, process.env.ENCRYPTION_KEY),
            mailgunApiKey: decryptData(brandData.mailgunApiKey, process.env.ENCRYPTION_KEY),
            smtpPassword: decryptData(brandData.smtpPassword, process.env.ENCRYPTION_KEY),
        };
        const emailProvider = ProviderFactory.createProvider(brandWithDecryptedSecrets, { decryptSecrets: false });

        // Set up email parameters
        const fromName = template.from_name || template.fromName || brandData.fromName || brandData.name;
        const fromEmail = template.from_email || template.fromEmail || brandData.fromEmail;
        const replyTo = template.reply_to || template.replyTo || brandData.replyToEmail || fromEmail;

        // Send email using provider abstraction
        const sendResult = await emailProvider.send({
            from: `${fromName} <${fromEmail}>`,
            to,
            subject,
            html: content,
            replyTo,
            tags: [
                { name: 'templateId', value: (template.id || template._id).toString() },
                { name: 'type', value: 'transactional' },
            ],
        });

        // Log the transactional email
        await logTransactionalEmail({
            template_id: template.id || template._id, // snake_case
            templateId: template.id || template._id, // legacy support if needed
            brand_id: template.brand_id || template.brandId,
            brandId: template.brand_id || template.brandId,
            user_id: template.user_id || template.userId,
            userId: template.user_id || template.userId,
            to,
            to_email: to, // Supabase column might be to_email
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

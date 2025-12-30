/**
 * Email Provider Factory
 *
 * Creates the appropriate email provider instance based on brand configuration.
 * Handles credential decryption and provider instantiation.
 */

const crypto = require('crypto');
const SESProvider = require('./SESProvider');
const SendGridApiProvider = require('./SendGridApiProvider');
const SendGridSmtpProvider = require('./SendGridSmtpProvider');
const MailgunApiProvider = require('./MailgunApiProvider');
const MailgunSmtpProvider = require('./MailgunSmtpProvider');

/**
 * Decrypt encrypted data using AES-256-CBC
 */
function decryptData(encryptedText, secretKey) {
    try {
        if (!encryptedText) return null;

        // If it's not encrypted (doesn't contain ':'), return as is
        if (!encryptedText.includes(':')) {
            return encryptedText;
        }

        const key = crypto.scryptSync(secretKey || process.env.ENCRYPTION_KEY || 'default-fallback-key', 'salt', 32);

        const parts = encryptedText.split(':');
        if (parts.length !== 2) {
            return encryptedText;
        }

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

class ProviderFactory {
    /**
     * Create an email provider instance based on brand configuration
     *
     * @param {Object} brand - Brand configuration object
     * @param {string} brand.emailProvider - Provider type: 'ses', 'sendgrid', 'mailgun'
     * @param {string} brand.emailProviderConnectionType - Connection type: 'api', 'smtp'
     * @param {Object} options - Additional options
     * @param {boolean} options.decryptSecrets - Whether to decrypt secrets (default: true)
     * @returns {BaseEmailProvider} Provider instance
     */
    static createProvider(brand, options = {}) {
        const { decryptSecrets = true } = options;
        const provider = brand.emailProvider || 'ses';
        const connectionType = brand.emailProviderConnectionType || 'api';

        // Prepare decrypted config
        const config = { ...brand };

        if (decryptSecrets) {
            // Decrypt provider-specific secrets
            if (brand.awsSecretKey) {
                config.awsSecretKey = decryptData(brand.awsSecretKey, process.env.ENCRYPTION_KEY);
            }
            if (brand.sendgridApiKey) {
                config.sendgridApiKey = decryptData(brand.sendgridApiKey, process.env.ENCRYPTION_KEY);
            }
            if (brand.mailgunApiKey) {
                config.mailgunApiKey = decryptData(brand.mailgunApiKey, process.env.ENCRYPTION_KEY);
            }
            if (brand.smtpPassword) {
                config.smtpPassword = decryptData(brand.smtpPassword, process.env.ENCRYPTION_KEY);
            }
        }

        switch (provider) {
            case 'sendgrid':
                if (connectionType === 'smtp') {
                    return new SendGridSmtpProvider(config);
                }
                return new SendGridApiProvider(config);

            case 'mailgun':
                if (connectionType === 'smtp') {
                    return new MailgunSmtpProvider(config);
                }
                return new MailgunApiProvider(config);

            case 'ses':
            default:
                return new SESProvider(config);
        }
    }

    /**
     * Get provider name for display
     * @param {string} provider - Provider identifier
     * @returns {string} Display name
     */
    static getProviderDisplayName(provider) {
        const names = {
            ses: 'Amazon SES',
            sendgrid: 'SendGrid',
            mailgun: 'Mailgun',
        };
        return names[provider] || provider;
    }

    /**
     * Get list of supported providers
     * @returns {Array} List of provider objects
     */
    static getSupportedProviders() {
        return [
            {
                id: 'ses',
                name: 'Amazon SES',
                description: 'Amazon Simple Email Service',
                supportsApi: true,
                supportsSmtp: false,
                requiredFields: ['awsRegion', 'awsAccessKey', 'awsSecretKey'],
            },
            {
                id: 'sendgrid',
                name: 'SendGrid',
                description: 'Twilio SendGrid Email Delivery',
                supportsApi: true,
                supportsSmtp: true,
                requiredFields: ['sendgridApiKey'],
            },
            {
                id: 'mailgun',
                name: 'Mailgun',
                description: 'Mailgun Email Service',
                supportsApi: true,
                supportsSmtp: true,
                requiredFields: ['mailgunApiKey', 'mailgunDomain'],
            },
        ];
    }

    /**
     * Validate provider configuration
     * @param {string} provider - Provider identifier
     * @param {Object} config - Provider configuration
     * @returns {Object} Validation result { valid: boolean, errors: string[] }
     */
    static validateConfig(provider, config) {
        const errors = [];
        const providers = ProviderFactory.getSupportedProviders();
        const providerInfo = providers.find((p) => p.id === provider);

        if (!providerInfo) {
            return { valid: false, errors: [`Unknown provider: ${provider}`] };
        }

        for (const field of providerInfo.requiredFields) {
            if (!config[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}

module.exports = ProviderFactory;

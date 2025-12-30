/**
 * AWS SES Email Provider
 *
 * Implements email sending via AWS Simple Email Service (SES)
 */

const { SESClient, SendRawEmailCommand, GetSendQuotaCommand, GetAccountCommand } = require('@aws-sdk/client-ses');
const BaseEmailProvider = require('./BaseEmailProvider');

class SESProvider extends BaseEmailProvider {
    constructor(config) {
        super(config);
        this.providerName = 'ses';

        // Create SES client
        this.client = new SESClient({
            region: config.awsRegion || 'us-east-1',
            credentials: {
                accessKeyId: config.awsAccessKey,
                secretAccessKey: config.awsSecretKey, // Should already be decrypted
            },
        });

        this.configurationSet = config.sesConfigurationSet;
    }

    /**
     * Send a single email
     */
    async send({ from, to, subject, html, text, replyTo, headers = {}, tags = [] }) {
        const toAddress = Array.isArray(to) ? to[0] : to;

        // Build raw email
        const rawEmailContent = this.buildRawMimeEmail({
            from,
            to: toAddress,
            replyTo: replyTo || from,
            subject,
            htmlContent: html,
            textContent: text || this.extractTextFromHtml(html),
            listUnsubscribe: headers['List-Unsubscribe'],
            listUnsubscribePost: headers['List-Unsubscribe-Post'],
            customHeaders: this.buildSesHeaders(tags),
        });

        const command = new SendRawEmailCommand({
            RawMessage: {
                Data: Buffer.from(rawEmailContent),
            },
            ConfigurationSetName: this.configurationSet,
            Tags: tags.map((t) => ({ Name: t.name || t.Name, Value: t.value || t.Value })),
        });

        const result = await this.client.send(command);

        return { messageId: result.MessageId };
    }

    /**
     * Send batch emails
     */
    async sendBatch(emails, commonOptions) {
        const results = [];

        for (const email of emails) {
            try {
                const result = await this.send({
                    ...commonOptions,
                    to: email.to,
                    headers: email.headers || commonOptions.headers,
                    tags: email.tags || commonOptions.tags,
                });

                results.push({
                    messageId: result.messageId,
                    email: email.to,
                    success: true,
                });
            } catch (error) {
                results.push({
                    messageId: null,
                    email: email.to,
                    success: false,
                    error: error.message,
                });
            }
        }

        return results;
    }

    /**
     * Send raw MIME email
     */
    async sendRaw({ from, to, replyTo, subject, htmlContent, textContent, listUnsubscribe, listUnsubscribePost, configurationSet, tags = [] }) {
        const rawEmailContent = this.buildRawMimeEmail({
            from,
            to,
            replyTo: replyTo || from,
            subject,
            htmlContent,
            textContent,
            listUnsubscribe,
            listUnsubscribePost,
            customHeaders: this.buildSesHeaders(tags, configurationSet || this.configurationSet),
        });

        const command = new SendRawEmailCommand({
            RawMessage: {
                Data: Buffer.from(rawEmailContent),
            },
            ConfigurationSetName: configurationSet || this.configurationSet,
            Tags: tags.map((t) => ({ Name: t.Name || t.name, Value: t.Value || t.value })),
        });

        const result = await this.client.send(command);

        return { messageId: result.MessageId };
    }

    /**
     * Get sending quota
     */
    async getQuota() {
        const command = new GetSendQuotaCommand({});
        const response = await this.client.send(command);

        return {
            maxSendRate: response.MaxSendRate || 10,
            max24HourSend: response.Max24HourSend || 200,
            sentLast24Hours: response.SentLast24Hours || 0,
        };
    }

    /**
     * Verify credentials
     */
    async verifyCredentials() {
        try {
            // Try to get quota as a simple verification
            await this.getQuota();
            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error.message || 'Invalid AWS SES credentials',
            };
        }
    }

    /**
     * Build SES-specific headers
     */
    buildSesHeaders(tags = [], configurationSet = null) {
        const headers = {};

        if (tags && tags.length > 0) {
            const tagString = tags.map((t) => `${t.Name || t.name}=${t.Value || t.value}`).join(', ');
            headers['X-SES-MESSAGE-TAGS'] = tagString;
        }

        if (configurationSet) {
            headers['X-SES-CONFIGURATION-SET'] = configurationSet;
        }

        return headers;
    }

    /**
     * Extract plain text from HTML
     */
    extractTextFromHtml(html) {
        if (!html) return '';

        // Simple HTML to text conversion
        return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
}

module.exports = SESProvider;

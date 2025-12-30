/**
 * SendGrid SMTP Email Provider
 *
 * Implements email sending via SendGrid's SMTP relay
 */

const nodemailer = require('nodemailer');
const BaseEmailProvider = require('./BaseEmailProvider');

class SendGridSmtpProvider extends BaseEmailProvider {
    constructor(config) {
        super(config);
        this.providerName = 'sendgrid-smtp';
        this.apiKey = config.sendgridApiKey;

        // Create nodemailer transporter for SendGrid SMTP
        this.transporter = nodemailer.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            secure: false, // Use TLS
            auth: {
                user: 'apikey', // SendGrid requires 'apikey' as username
                pass: this.apiKey,
            },
        });
    }

    /**
     * Send a single email
     */
    async send({ from, to, subject, html, text, replyTo, headers = {}, tags = [] }) {
        const mailOptions = {
            from,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject,
            html,
            text: text || this.extractTextFromHtml(html),
            replyTo: replyTo || from,
            headers: {
                ...headers,
            },
        };

        // Add categories as custom header
        if (tags && tags.length > 0) {
            mailOptions.headers['X-SMTPAPI'] = JSON.stringify({
                category: tags.map((t) => t.value || t.Value || t.name || t.Name),
            });
        }

        const result = await this.transporter.sendMail(mailOptions);

        return { messageId: result.messageId };
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
                    headers: { ...commonOptions.headers, ...email.headers },
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
    async sendRaw({ from, to, replyTo, subject, htmlContent, textContent, listUnsubscribe, listUnsubscribePost, tags = [] }) {
        const headers = {};

        if (listUnsubscribe) {
            headers['List-Unsubscribe'] = listUnsubscribe;
        }
        if (listUnsubscribePost) {
            headers['List-Unsubscribe-Post'] = listUnsubscribePost;
        }

        return this.send({
            from,
            to,
            subject,
            html: htmlContent,
            text: textContent,
            replyTo,
            headers,
            tags,
        });
    }

    /**
     * Get sending quota
     */
    async getQuota() {
        // SMTP doesn't provide quota information
        // Return reasonable defaults
        return {
            maxSendRate: 100,
            max24HourSend: 100000,
            sentLast24Hours: 0,
        };
    }

    /**
     * Verify credentials
     */
    async verifyCredentials() {
        try {
            await this.transporter.verify();
            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error.message || 'Invalid SendGrid SMTP credentials',
            };
        }
    }

    /**
     * Extract plain text from HTML
     */
    extractTextFromHtml(html) {
        if (!html) return '';

        return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
}

module.exports = SendGridSmtpProvider;

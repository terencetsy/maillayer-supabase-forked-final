/**
 * Mailgun SMTP Email Provider
 *
 * Implements email sending via Mailgun's SMTP relay
 */

const nodemailer = require('nodemailer');
const BaseEmailProvider = require('./BaseEmailProvider');

class MailgunSmtpProvider extends BaseEmailProvider {
    constructor(config) {
        super(config);
        this.providerName = 'mailgun-smtp';
        this.apiKey = config.mailgunApiKey;
        this.domain = config.mailgunDomain;
        this.region = config.mailgunRegion || 'us';

        // Set SMTP host based on region
        const smtpHost = this.region === 'eu' ? 'smtp.eu.mailgun.org' : 'smtp.mailgun.org';

        // Create nodemailer transporter for Mailgun SMTP
        this.transporter = nodemailer.createTransport({
            host: smtpHost,
            port: 587,
            secure: false, // Use TLS
            auth: {
                user: `postmaster@${this.domain}`,
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

        // Add Mailgun-specific headers for tags
        if (tags && tags.length > 0) {
            mailOptions.headers['X-Mailgun-Tag'] = tags.map((t) => t.value || t.Value || t.name || t.Name);
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
                error: error.message || 'Invalid Mailgun SMTP credentials',
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

module.exports = MailgunSmtpProvider;

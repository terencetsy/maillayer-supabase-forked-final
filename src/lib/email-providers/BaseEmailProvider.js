/**
 * Base Email Provider - Abstract class defining the interface for all email providers
 *
 * All email providers (SES, SendGrid, Mailgun, etc.) must implement these methods.
 */

class BaseEmailProvider {
    constructor(config) {
        this.config = config;
        this.providerName = 'base';
    }

    /**
     * Send a single email
     * @param {Object} options
     * @param {string} options.from - Sender address (e.g., "Name <email@domain.com>")
     * @param {string|string[]} options.to - Recipient address(es)
     * @param {string} options.subject - Email subject
     * @param {string} options.html - HTML content
     * @param {string} [options.text] - Plain text content
     * @param {string} [options.replyTo] - Reply-to address
     * @param {Object} [options.headers] - Custom headers
     * @param {Array} [options.tags] - Tags for tracking [{name: string, value: string}]
     * @returns {Promise<{messageId: string}>}
     */
    async send(options) {
        throw new Error('send() method must be implemented by provider');
    }

    /**
     * Send batch emails (for campaigns)
     * @param {Array} emails - Array of email objects with 'to' and optional 'personalizations'
     * @param {Object} commonOptions - Common options (from, subject, html, text)
     * @returns {Promise<Array<{messageId: string, email: string, success: boolean}>>}
     */
    async sendBatch(emails, commonOptions) {
        throw new Error('sendBatch() method must be implemented by provider');
    }

    /**
     * Send raw MIME email (for full control over headers)
     * @param {Object} options
     * @param {string} options.from - Sender address
     * @param {string} options.to - Recipient address
     * @param {string} options.replyTo - Reply-to address
     * @param {string} options.subject - Email subject
     * @param {string} options.htmlContent - HTML content
     * @param {string} options.textContent - Plain text content
     * @param {string} options.listUnsubscribe - List-Unsubscribe header value
     * @param {string} options.listUnsubscribePost - List-Unsubscribe-Post header value
     * @param {string} [options.configurationSet] - Provider-specific configuration set
     * @param {Array} [options.tags] - Tags for tracking
     * @returns {Promise<{messageId: string}>}
     */
    async sendRaw(options) {
        throw new Error('sendRaw() method must be implemented by provider');
    }

    /**
     * Get sending quota/limits
     * @returns {Promise<{maxSendRate: number, max24HourSend: number, sentLast24Hours: number}>}
     */
    async getQuota() {
        throw new Error('getQuota() method must be implemented by provider');
    }

    /**
     * Verify that credentials are valid
     * @returns {Promise<{valid: boolean, error?: string}>}
     */
    async verifyCredentials() {
        throw new Error('verifyCredentials() method must be implemented by provider');
    }

    /**
     * Get provider name
     * @returns {string}
     */
    getName() {
        return this.providerName;
    }

    /**
     * Build standard unsubscribe headers for RFC 8058 compliance
     * @param {string} unsubscribeUrl - The one-click unsubscribe URL
     * @returns {Object} Headers object with listUnsubscribe and listUnsubscribePost
     */
    buildUnsubscribeHeaders(unsubscribeUrl) {
        return {
            listUnsubscribe: `<${unsubscribeUrl}>`,
            listUnsubscribePost: 'List-Unsubscribe=One-Click',
        };
    }

    /**
     * Build raw MIME email content
     * @param {Object} options - Email options
     * @returns {string} Raw MIME email string
     */
    buildRawMimeEmail({ from, to, replyTo, subject, htmlContent, textContent, listUnsubscribe, listUnsubscribePost, customHeaders = {} }) {
        const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;

        let rawEmail = '';
        rawEmail += `From: ${from}\r\n`;
        rawEmail += `To: ${to}\r\n`;
        rawEmail += `Reply-To: ${replyTo}\r\n`;
        rawEmail += `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\n`;
        rawEmail += `MIME-Version: 1.0\r\n`;
        rawEmail += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;

        // Add List-Unsubscribe headers for RFC 8058 compliance
        if (listUnsubscribe) {
            rawEmail += `List-Unsubscribe: ${listUnsubscribe}\r\n`;
        }
        if (listUnsubscribePost) {
            rawEmail += `List-Unsubscribe-Post: ${listUnsubscribePost}\r\n`;
        }

        // Add custom headers
        for (const [key, value] of Object.entries(customHeaders)) {
            rawEmail += `${key}: ${value}\r\n`;
        }

        rawEmail += `\r\n`;

        // Text part
        rawEmail += `--${boundary}\r\n`;
        rawEmail += `Content-Type: text/plain; charset=UTF-8\r\n`;
        rawEmail += `Content-Transfer-Encoding: 7bit\r\n`;
        rawEmail += `\r\n`;
        rawEmail += `${textContent}\r\n`;

        // HTML part
        rawEmail += `--${boundary}\r\n`;
        rawEmail += `Content-Type: text/html; charset=UTF-8\r\n`;
        rawEmail += `Content-Transfer-Encoding: 7bit\r\n`;
        rawEmail += `\r\n`;
        rawEmail += `${htmlContent}\r\n`;

        // End boundary
        rawEmail += `--${boundary}--\r\n`;

        return rawEmail;
    }
}

module.exports = BaseEmailProvider;

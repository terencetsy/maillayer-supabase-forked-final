/**
 * Mailgun API Email Provider
 *
 * Implements email sending via Mailgun's API
 */

const BaseEmailProvider = require('./BaseEmailProvider');

class MailgunApiProvider extends BaseEmailProvider {
    constructor(config) {
        super(config);
        this.providerName = 'mailgun';
        this.apiKey = config.mailgunApiKey;
        this.domain = config.mailgunDomain;
        this.region = config.mailgunRegion || 'us';

        // Set base URL based on region
        this.baseUrl = this.region === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3';
    }

    /**
     * Make API request to Mailgun
     */
    async makeRequest(endpoint, method = 'GET', formData = null) {
        const options = {
            method,
            headers: {
                Authorization: 'Basic ' + Buffer.from(`api:${this.apiKey}`).toString('base64'),
            },
        };

        if (formData) {
            options.body = formData;
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, options);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Mailgun API error: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Build form data for Mailgun API
     */
    buildFormData(data) {
        const formData = new FormData();

        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined && value !== null) {
                if (Array.isArray(value)) {
                    value.forEach((v) => formData.append(key, v));
                } else {
                    formData.append(key, value);
                }
            }
        }

        return formData;
    }

    /**
     * Send a single email
     */
    async send({ from, to, subject, html, text, replyTo, headers = {}, tags = [] }) {
        const toAddresses = Array.isArray(to) ? to : [to];

        const data = {
            from,
            to: toAddresses,
            subject,
            html,
            text: text || this.extractTextFromHtml(html),
        };

        if (replyTo) {
            data['h:Reply-To'] = replyTo;
        }

        // Add custom headers
        if (headers) {
            for (const [key, value] of Object.entries(headers)) {
                data[`h:${key}`] = value;
            }
        }

        // Add tags
        if (tags && tags.length > 0) {
            data['o:tag'] = tags.map((t) => t.value || t.Value || t.name || t.Name);
        }

        const formData = this.buildFormData(data);
        const result = await this.makeRequest(`/${this.domain}/messages`, 'POST', formData);

        return { messageId: result.id };
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
     * Get sending quota and stats
     */
    async getQuota() {
        try {
            // Get account limits from Mailgun
            const accountUrl = this.region === 'eu' ? 'https://api.eu.mailgun.net/v1' : 'https://api.mailgun.net/v1';

            // Fetch account sending limits
            const limitsResponse = await fetch(`${accountUrl}/accounts/self/sending/limits`, {
                headers: {
                    Authorization: 'Basic ' + Buffer.from(`api:${this.apiKey}`).toString('base64'),
                },
            });

            let maxMonthSend = 1000; // Default for free tier
            let maxSendRate = 100;

            if (limitsResponse.ok) {
                const limits = await limitsResponse.json();
                // Mailgun returns limits like: { "limit": { "daily": 100, "monthly": 1000 } }
                if (limits.limit) {
                    maxMonthSend = limits.limit.monthly || limits.limit.daily * 30 || 1000;
                }
            }

            // Fetch stats for current month to get sent count
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            // Mailgun expects RFC 2822 or Unix timestamp format
            const startTimestamp = Math.floor(startOfMonth.getTime() / 1000);
            const endTimestamp = Math.floor(now.getTime() / 1000);

            // Use the stats endpoint with event types
            const statsResponse = await fetch(`${this.baseUrl}/${this.domain}/stats/total?event=accepted&event=delivered&start=${startTimestamp}&end=${endTimestamp}`, {
                headers: {
                    Authorization: 'Basic ' + Buffer.from(`api:${this.apiKey}`).toString('base64'),
                },
            });

            let sentThisMonth = 0;

            if (statsResponse.ok) {
                const stats = await statsResponse.json();

                // Mailgun stats/total response format: { "stats": [{ "time": "...", "accepted": { "total": X, "incoming": Y, "outgoing": Z }, "delivered": {...} }] }
                // Or it could be a single object with totals
                if (stats.stats && Array.isArray(stats.stats)) {
                    sentThisMonth = stats.stats.reduce((total, item) => {
                        // Count accepted outgoing emails (emails we sent)
                        const accepted = item.accepted?.outgoing || item.accepted?.total || 0;
                        const delivered = item.delivered?.total || 0;
                        // Use the higher of accepted or delivered
                        return total + Math.max(accepted, delivered);
                    }, 0);
                } else if (stats.accepted || stats.delivered) {
                    // Direct totals format
                    sentThisMonth = stats.accepted?.outgoing || stats.accepted?.total || stats.delivered?.total || 0;
                }
            } else {
                const errorText = await statsResponse.text();
                console.error('Mailgun stats error:', statsResponse.status, errorText);
            }

            return {
                maxSendRate: maxSendRate,
                max24HourSend: maxMonthSend, // Using monthly limit for display
                sentLast24Hours: sentThisMonth, // Using monthly sent for display
                isMonthlyQuota: true, // Flag to indicate this is monthly, not 24hr
            };
        } catch (error) {
            console.error('Error fetching Mailgun quota:', error);
            return {
                maxSendRate: 100,
                max24HourSend: 1000,
                sentLast24Hours: 0,
            };
        }
    }

    /**
     * Verify credentials
     */
    async verifyCredentials() {
        try {
            // Try to get domain info to verify credentials
            await this.makeRequest(`/${this.domain}`);
            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error.message || 'Invalid Mailgun credentials',
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

module.exports = MailgunApiProvider;

/**
 * SendGrid API Email Provider
 *
 * Implements email sending via SendGrid's Web API v3
 */

const BaseEmailProvider = require('./BaseEmailProvider');

class SendGridApiProvider extends BaseEmailProvider {
    constructor(config) {
        super(config);
        this.providerName = 'sendgrid';
        this.apiKey = config.sendgridApiKey;
        this.baseUrl = 'https://api.sendgrid.com/v3';
    }

    /**
     * Make API request to SendGrid
     */
    async makeRequest(endpoint, method = 'GET', body = null) {
        const options = {
            method,
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, options);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.errors?.[0]?.message || `SendGrid API error: ${response.status}`);
        }

        // Some endpoints return empty response
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    }

    /**
     * Send a single email
     */
    async send({ from, to, subject, html, text, replyTo, headers = {}, tags = [] }) {
        const toAddresses = Array.isArray(to) ? to : [to];

        const payload = {
            personalizations: [
                {
                    to: toAddresses.map((email) => {
                        if (typeof email === 'string') {
                            // Parse "Name <email>" format
                            const match = email.match(/^(.+)\s*<(.+)>$/);
                            if (match) {
                                return { name: match[1].trim(), email: match[2].trim() };
                            }
                            return { email };
                        }
                        return email;
                    }),
                },
            ],
            from: this.parseEmailAddress(from),
            subject,
            content: [],
        };

        // Add text content
        if (text) {
            payload.content.push({ type: 'text/plain', value: text });
        }

        // Add HTML content
        if (html) {
            payload.content.push({ type: 'text/html', value: html });
        }

        // Add reply-to
        if (replyTo) {
            payload.reply_to = this.parseEmailAddress(replyTo);
        }

        // Add custom headers
        if (headers && Object.keys(headers).length > 0) {
            payload.headers = headers;
        }

        // Add categories/tags
        if (tags && tags.length > 0) {
            payload.categories = tags.map((t) => t.value || t.Value || t.name || t.Name);
        }

        const result = await this.makeRequest('/mail/send', 'POST', payload);

        // SendGrid returns message ID in header, but we don't have access to response headers
        // Generate a tracking ID based on timestamp
        return { messageId: `sg_${Date.now()}_${Math.random().toString(36).substring(2)}` };
    }

    /**
     * Send batch emails
     */
    async sendBatch(emails, commonOptions) {
        const results = [];

        // SendGrid supports up to 1000 personalizations per request
        // For simplicity, we'll send individually for now
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
     * SendGrid provides stats API for tracking sent emails
     */
    async getQuota() {
        try {
            // Get stats for current month
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startDate = startOfMonth.toISOString().split('T')[0];
            const endDate = now.toISOString().split('T')[0];

            // Fetch monthly stats
            const stats = await this.makeRequest(`/stats?start_date=${startDate}&end_date=${endDate}`);

            let sentThisMonth = 0;
            if (stats && stats.length > 0) {
                // Sum up all requests (sent emails) for the month
                sentThisMonth = stats.reduce((total, day) => {
                    const dayMetrics = day.stats?.[0]?.metrics || {};
                    return total + (dayMetrics.requests || 0);
                }, 0);
            }

            // Try to get account credits/limit info
            let monthlyLimit = 100000; // Default assumption
            try {
                // SendGrid account info endpoint
                const accountResponse = await fetch(`${this.baseUrl}/user/credits`, {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                });
                if (accountResponse.ok) {
                    const credits = await accountResponse.json();
                    if (credits.total) {
                        monthlyLimit = credits.total;
                    }
                }
            } catch {
                // Credits endpoint may not be available for all plans
            }

            return {
                maxSendRate: 100, // Emails per second (estimate)
                max24HourSend: monthlyLimit,
                sentLast24Hours: sentThisMonth,
                isMonthlyQuota: true,
            };
        } catch (error) {
            console.error('Error fetching SendGrid quota:', error);
            return {
                maxSendRate: 10,
                max24HourSend: 100,
                sentLast24Hours: 0,
            };
        }
    }

    /**
     * Verify credentials
     */
    async verifyCredentials() {
        try {
            await this.makeRequest('/user/profile');
            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error.message || 'Invalid SendGrid API key',
            };
        }
    }

    /**
     * Parse email address from various formats
     */
    parseEmailAddress(address) {
        if (typeof address === 'object') {
            return address;
        }

        // Parse "Name <email>" format
        const match = address.match(/^(.+)\s*<(.+)>$/);
        if (match) {
            return { name: match[1].trim(), email: match[2].trim() };
        }

        return { email: address };
    }
}

module.exports = SendGridApiProvider;

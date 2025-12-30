// src/pages/api/brands/[brandId]/campaigns/[id]/test.js
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getCampaignById } from '@/services/campaignService';
import { getBrandById } from '@/services/brandService';

// Dynamic import for provider factory (CommonJS module)
const getProviderFactory = async () => {
    const ProviderFactory = require('@/lib/email-providers/ProviderFactory');
    return ProviderFactory;
};

// Extract plain text from HTML
function extractTextFromHtml(html) {
    if (!html) return '';

    // Simple regex-based text extraction (you can use cheerio if needed)
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/\s+/g, ' ').trim();

    return text;
}

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Connect to database
        await connectToDatabase();

        // Get session
        const session = await getServerSession(req, res, authOptions);

        if (!session || !session.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = session.user.id;
        const { brandId, id } = req.query;
        const { email, fromName, fromEmail, replyTo } = req.body;

        // Validate required parameters
        if (!brandId || !id) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        if (!email) {
            return res.status(400).json({ message: 'Email address is required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Invalid email address' });
        }

        // Check if the brand belongs to the user
        const brand = await getBrandById(brandId, true);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        if (brand.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to access this brand' });
        }

        // Check if brand has email provider credentials configured
        if (brand.status === 'pending_setup' || brand.status === 'pending_verification') {
            return res.status(400).json({ message: 'Brand email sending is not configured or verified' });
        }

        const provider = brand.emailProvider || 'ses';
        const ProviderFactory = await getProviderFactory();

        // Check provider-specific credentials
        if (provider === 'ses' && (!brand.awsRegion || !brand.awsAccessKey || !brand.awsSecretKey)) {
            return res.status(400).json({ message: 'AWS SES credentials not configured for this brand' });
        } else if (provider === 'sendgrid' && !brand.sendgridApiKey) {
            return res.status(400).json({ message: 'SendGrid API key not configured for this brand' });
        } else if (provider === 'mailgun' && (!brand.mailgunApiKey || !brand.mailgunDomain)) {
            return res.status(400).json({ message: 'Mailgun credentials not configured for this brand' });
        }

        // Get campaign
        const campaign = await getCampaignById(id, userId);

        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        if (campaign.brandId.toString() !== brandId) {
            return res.status(403).json({ message: 'Campaign does not belong to this brand' });
        }

        // Check if campaign has content
        if (!campaign.content || campaign.content.trim() === '') {
            return res.status(400).json({ message: 'Campaign has no content to send' });
        }

        // Create email provider using factory
        const emailProvider = ProviderFactory.createProvider(brand);

        // Prepare email content (without tracking for test emails)
        const htmlContent = campaign.content;
        const textContent = extractTextFromHtml(htmlContent);

        // Add test email banner
        const testBanner = `
            <div style="background-color: #FFF3CD; border: 2px solid #FFC107; padding: 15px; margin-bottom: 20px; border-radius: 4px; text-align: center;">
                <strong style="color: #856404;">⚠️ TEST EMAIL</strong>
                <p style="color: #856404; margin: 5px 0 0 0; font-size: 14px;">This is a test send. Tracking links are not active.</p>
            </div>
        `;

        const finalHtmlContent = htmlContent.includes('<body') ? htmlContent.replace(/<body[^>]*>/i, `$&${testBanner}`) : `${testBanner}${htmlContent}`;

        // Send test email using provider abstraction
        const result = await emailProvider.send({
            from: `${fromName || brand.fromName || brand.name} <${fromEmail || brand.fromEmail}>`,
            to: email,
            subject: `[TEST] ${campaign.subject}`,
            html: finalHtmlContent,
            text: `TEST EMAIL\n\n${textContent}`,
            replyTo: replyTo || brand.replyToEmail || fromEmail || brand.fromEmail,
            tags: [
                { name: 'campaignId', value: id },
                { name: 'type', value: 'test' },
            ],
        });

        console.log(`Test email sent for campaign ${id} to ${email} via ${emailProvider.getName()}, MessageId: ${result.messageId}`);

        return res.status(200).json({
            message: 'Test email sent successfully',
            messageId: result.messageId,
            email: email,
            provider: emailProvider.getName(),
        });
    } catch (error) {
        console.error('Error sending test email:', error);

        // Handle specific provider errors
        if (error.name === 'MessageRejected') {
            return res.status(400).json({ message: 'Email was rejected. Please check your sending domain verification.' });
        }

        if (error.name === 'InvalidParameterValue') {
            return res.status(400).json({ message: 'Invalid email parameters. Please check your configuration.' });
        }

        if (error.name === 'MailFromDomainNotVerifiedException') {
            return res.status(400).json({ message: 'Your sending domain is not verified.' });
        }

        return res.status(500).json({
            message: 'Failed to send test email',
            error: error.message,
        });
    }
}

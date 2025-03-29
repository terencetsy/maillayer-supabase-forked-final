const cheerio = require('cheerio');
const crypto = require('crypto');
const config = require('../src/lib/configCommonJS');
const { generateUnsubscribeToken } = require('@/lib/tokenUtils');

function generateTrackingToken(campaignId, contactId, email) {
    const dataToHash = `${campaignId}:${contactId}:${email}:${config.trackingSecret || 'tracking-secret-key'}`;

    return crypto.createHash('sha256').update(dataToHash).digest('hex');
}

function processHtml(html, campaignId, contactId, email, trackingDomain = '') {
    const domain = trackingDomain || config.trackingDomain;

    const token = generateTrackingToken(campaignId, contactId, email);

    const trackingParams = `cid=${encodeURIComponent(campaignId)}&lid=${encodeURIComponent(contactId)}&e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`;

    const $ = cheerio.load(html);

    $('a').each(function () {
        const originalUrl = $(this).attr('href');
        if (originalUrl && !originalUrl.startsWith('mailto:') && !originalUrl.startsWith('#')) {
            const trackingUrl = `${domain}/api/tracking/click?${trackingParams}&url=${encodeURIComponent(originalUrl)}`;
            $(this).attr('href', trackingUrl);
        }
    });

    const trackingPixel = `<img src="${domain}/api/tracking/open?${trackingParams}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;" />`;
    $('body').append(trackingPixel);

    // Generate unsubscribe token
    const unsubscribeToken = generateUnsubscribeToken(contactId, brandId, campaignId);
    const unsubscribeUrl = `${process.env.BASE_URL}/unsubscribe/${unsubscribeToken}`;

    // Create unsubscribe footer
    const unsubscribeFooter = `
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
              <p>If you no longer wish to receive emails from us, you can <a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">unsubscribe here</a>.</p>
          </div>
      `;

    // Add unsubscribe footer before the end of the body
    $('body').append(unsubscribeFooter);

    return $.html();
}

function extractTextFromHtml(html) {
    if (!html) return '';

    const $ = cheerio.load(html);

    $('script, style').remove();

    let text = $('body').text();

    text = text.replace(/\s+/g, ' ').trim();

    return text;
}

module.exports = {
    processHtml,
    extractTextFromHtml,
    generateTrackingToken,
};

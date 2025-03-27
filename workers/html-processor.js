const cheerio = require('cheerio');
const crypto = require('crypto');
const config = require('../src/lib/configCommonJS');

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

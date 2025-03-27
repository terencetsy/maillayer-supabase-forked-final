import { trackEvent, verifyTrackingToken } from '@/services/trackingService';

// Set Content-Type for tracking pixel
const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

export default async function handler(req, res) {
    // Handle OPTIONS requests for CORS
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    // Only support GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { type } = req.query;
    const { cid, lid, e, t } = req.query; // Campaign ID, Contact ID, Email, Token

    // Basic validation
    if (!cid || !lid || !e || !t) {
        return res.status(400).json({ message: 'Missing required parameters' });
    }

    // Verify tracking token
    if (!verifyTrackingToken(t, cid, lid, e)) {
        return res.status(403).json({ message: 'Invalid tracking token' });
    }

    try {
        // Different handling based on tracking type
        switch (type) {
            case 'open': {
                // Track open event
                await trackEvent(
                    cid,
                    lid,
                    e,
                    'open',
                    {},
                    {
                        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
                        userAgent: req.headers['user-agent'],
                    }
                );

                // Return a transparent 1x1 GIF for open tracking pixel
                res.setHeader('Content-Type', 'image/gif');
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                return res.send(TRANSPARENT_GIF);
            }

            case 'click': {
                // Get original URL to redirect to
                const url = req.query.url;
                if (!url) {
                    return res.status(400).json({ message: 'Missing URL parameter' });
                }

                // Track click event
                await trackEvent(
                    cid,
                    lid,
                    e,
                    'click',
                    { url },
                    {
                        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
                        userAgent: req.headers['user-agent'],
                    }
                );

                // Redirect to the original URL
                return res.redirect(url);
            }

            default:
                return res.status(400).json({ message: 'Invalid tracking type' });
        }
    } catch (error) {
        console.error(`Error tracking ${type}:`, error);
        return res.status(500).json({ message: 'Error tracking event' });
    }
}

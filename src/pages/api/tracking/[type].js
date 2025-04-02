// pages/api/tracking/[type].js
import { getGeoData } from '@/lib/geoip';
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
        // Get the IP address
        const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || req.socket.remoteAddress;

        // Strip IPv6 prefix if present
        const cleanIp = ipAddress?.replace(/^::ffff:/, '') || 'unknown';

        // Different handling based on tracking type
        switch (type) {
            case 'open': {
                // For open events, we want to respond quickly with the pixel
                // Return a transparent 1x1 GIF immediately
                res.setHeader('Content-Type', 'image/gif');
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                res.send(TRANSPARENT_GIF);

                // Process the tracking in the background
                // This won't block the response
                setTimeout(async () => {
                    const geoData = await getGeoData(cleanIp);

                    try {
                        await trackEvent(
                            cid,
                            lid,
                            e,
                            'open',
                            {
                                // Include geolocation data in the metadata
                                geolocation: geoData,
                            },
                            {
                                ipAddress: cleanIp,
                                userAgent: req.headers['user-agent'],
                            }
                        );
                    } catch (err) {
                        console.error('Background tracking error:', err);
                    }
                }, 0);

                return;
            }

            case 'click': {
                // Get original URL to redirect to
                const url = req.query.url;
                if (!url) {
                    return res.status(400).json({ message: 'Missing URL parameter' });
                }

                // Get geolocation data (this is fast since it's local)
                const geoData = await getGeoData(cleanIp);

                // Track click event with geolocation data
                await trackEvent(
                    cid,
                    lid,
                    e,
                    'click',
                    {
                        url,
                        geolocation: geoData,
                    },
                    {
                        ipAddress: cleanIp,
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

        // For pixel tracking, we should still return the transparent GIF
        // even if there's an error to avoid breaking email clients
        if (type === 'open') {
            res.setHeader('Content-Type', 'image/gif');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            return res.send(TRANSPARENT_GIF);
        }

        return res.status(500).json({ message: 'Error tracking event' });
    }
}

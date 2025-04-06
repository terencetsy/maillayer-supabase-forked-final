// src/pages/api/tracking/transactional.js
import { trackTransactionalEvent } from '@/services/transactionalService';
import { verifyTrackingToken } from '@/services/trackingService';
import { getGeoData } from '@/lib/geoip';
import TransactionalLog from '@/models/TransactionalLog';
import mongoose from 'mongoose';

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

    // Always send the GIF immediately to ensure it loads even if validation fails
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(TRANSPARENT_GIF);

    try {
        const { templateId, email, token } = req.query;

        // Debug info
        console.log('Transactional tracking request received:', {
            templateId,
            email,
            tokenLength: token?.length,
            headers: req.headers,
            url: req.url,
        });

        // Basic validation
        if (!templateId || !email || !token) {
            console.warn('Missing required parameters for tracking:', { templateId, email, token });
            return; // Already sent GIF, so just return
        }

        // Verify tracking token
        const isValidToken = verifyTrackingToken(token, templateId, 'txn', email);
        if (!isValidToken) {
            console.warn('Invalid tracking token:', {
                providedToken: token,
                templateId,
                email,
            });
            return; // Already sent GIF, so just return
        }

        // Process the tracking in the background (non-blocking)
        setTimeout(async () => {
            try {
                // Get the IP address
                const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || req.socket.remoteAddress;
                const cleanIp = ipAddress?.replace(/^::ffff:/, '') || 'unknown';

                // Get geo data if available
                const geoData = await getGeoData(cleanIp);

                // Log the open event in both ways

                // 1. Using the trackTransactionalEvent function
                await trackTransactionalEvent(templateId, 'open', {
                    email,
                    geolocation: geoData,
                    ipAddress: cleanIp,
                    userAgent: req.headers['user-agent'],
                });

                // 2. Update the TransactionalLog directly as a backup
                const updateResult = await TransactionalLog.updateOne(
                    {
                        templateId: new mongoose.Types.ObjectId(templateId),
                        to: email,
                    },
                    {
                        $push: {
                            events: {
                                type: 'open',
                                timestamp: new Date(),
                                userAgent: req.headers['user-agent'],
                                ipAddress: cleanIp,
                                geolocation: geoData,
                            },
                        },
                    }
                );

                console.log('Tracked transactional open:', {
                    templateId,
                    email,
                    trackingResult: updateResult,
                });
            } catch (err) {
                console.error('Background tracking error:', err);
            }
        }, 0);
    } catch (error) {
        console.error('Error in transactional tracking:', error);
    }
}

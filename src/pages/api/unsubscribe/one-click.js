// src/pages/api/unsubscribe/one-click.js
import connectToDatabase from '@/lib/mongodb';
import Contact from '@/models/Contact';
import Campaign from '@/models/Campaign';
import SequenceEnrollment from '@/models/SequenceEnrollment';
import EmailSequence from '@/models/EmailSequence';
import { verifyUnsubscribeToken, decodeUnsubscribeToken } from '@/lib/tokenUtils';
import { createTrackingModel } from '@/models/TrackingEvent';
import mongoose from 'mongoose';

export default async function handler(req, res) {
    // RFC 8058 requires POST method for one-click unsubscribe
    if (req.method !== 'POST') {
        // Return 200 for GET requests (some email clients check the URL first)
        if (req.method === 'GET') {
            return res.status(200).json({
                message: 'One-click unsubscribe endpoint. Use POST to unsubscribe.',
            });
        }
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        await connectToDatabase();

        // Token can be in query string or body
        const token = req.query.token || req.body.token;

        if (!token) {
            return res.status(400).json({ success: false, message: 'Missing token' });
        }

        // Verify token is valid
        if (!verifyUnsubscribeToken(token)) {
            return res.status(400).json({ success: false, message: 'Invalid or expired token' });
        }

        // Decode token to get contact info
        const { contactId, campaignId, brandId } = decodeUnsubscribeToken(token);

        if (!contactId || !brandId) {
            return res.status(400).json({ success: false, message: 'Invalid token data' });
        }

        // Check if this is a sequence enrollment (contactId might be enrollmentId)
        let isSequenceEnrollment = false;
        let enrollment = null;
        let actualContactId = contactId;

        // Try to find as sequence enrollment first
        try {
            enrollment = await SequenceEnrollment.findById(contactId);
            if (enrollment) {
                isSequenceEnrollment = true;
                actualContactId = enrollment.contactId;
            }
        } catch (e) {
            // Not a valid ObjectId for enrollment, continue with contact
        }

        if (isSequenceEnrollment && enrollment) {
            // Handle sequence unsubscribe
            if (enrollment.status === 'active') {
                enrollment.status = 'unsubscribed';
                enrollment.completedAt = new Date();
                await enrollment.save();

                // Update sequence stats
                await EmailSequence.updateOne(
                    { _id: enrollment.sequenceId },
                    {
                        $inc: {
                            'stats.totalActive': -1,
                            'stats.totalCompleted': 1,
                        },
                    }
                );
            }

            // Also unsubscribe the contact
            await Contact.findByIdAndUpdate(actualContactId, {
                status: 'unsubscribed',
                isUnsubscribed: true,
                unsubscribedAt: new Date(),
                unsubscribeReason: 'One-click unsubscribe',
            });
        } else {
            // Handle regular contact unsubscribe
            const updatedContact = await Contact.findOneAndUpdate(
                { _id: contactId, brandId: brandId },
                {
                    status: 'unsubscribed',
                    isUnsubscribed: true,
                    unsubscribedAt: new Date(),
                    unsubscribedFromCampaign: campaignId || null,
                    unsubscribeReason: 'One-click unsubscribe',
                },
                { new: true }
            );

            if (!updatedContact) {
                return res.status(404).json({ success: false, message: 'Contact not found' });
            }

            // If we have a campaign ID, track this event
            if (campaignId) {
                try {
                    const TrackingModel = createTrackingModel(campaignId);
                    await TrackingModel.create({
                        contactId: new mongoose.Types.ObjectId(contactId),
                        campaignId: new mongoose.Types.ObjectId(campaignId),
                        email: updatedContact.email,
                        eventType: 'unsubscribe',
                        metadata: {
                            reason: 'One-click unsubscribe',
                            method: 'list-unsubscribe-header',
                        },
                    });

                    await Campaign.findByIdAndUpdate(campaignId, {
                        $inc: { 'stats.unsubscribes': 1 },
                    });
                } catch (trackingError) {
                    console.error('Error tracking unsubscribe:', trackingError);
                }
            }
        }

        // RFC 8058 expects a 200 response for successful unsubscribe
        return res.status(200).json({ success: true, message: 'Successfully unsubscribed' });
    } catch (error) {
        console.error('One-click unsubscribe error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}

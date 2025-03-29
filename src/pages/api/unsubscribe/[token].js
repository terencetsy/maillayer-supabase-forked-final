import connectToDatabase from '@/lib/mongodb';
import Contact from '@/models/Contact';
import { verifyUnsubscribeToken, decodeUnsubscribeToken } from '@/lib/tokenUtils';
import { createTrackingModel } from '@/models/TrackingEvent';

export default async function handler(req, res) {
    try {
        await connectToDatabase();

        const { token } = req.query;

        // Verify token is valid
        if (!verifyUnsubscribeToken(token)) {
            return res.status(400).json({ success: false, message: 'Invalid or expired unsubscribe link' });
        }

        // Decode token to get contact info
        const { contactId, campaignId, brandId } = decodeUnsubscribeToken(token);

        if (!contactId || !brandId) {
            return res.status(400).json({ success: false, message: 'Invalid unsubscribe information' });
        }

        // GET request - Show unsubscribe page
        if (req.method === 'GET') {
            // Fetch the contact to confirm it exists
            const contact = await Contact.findOne({
                _id: contactId,
                brandId: brandId,
            });

            if (!contact) {
                return res.status(404).json({ success: false, message: 'Contact not found' });
            }

            // Return contact info to display on the unsubscribe page
            return res.status(200).json({
                success: true,
                email: contact.email,
                isUnsubscribed: contact.isUnsubscribed || false,
            });
        }

        // POST request - Process unsubscribe action
        if (req.method === 'POST') {
            const { reason } = req.body;

            // Update contact as unsubscribed
            const updatedContact = await Contact.findOneAndUpdate(
                { _id: contactId, brandId: brandId },
                {
                    isUnsubscribed: true,
                    unsubscribedAt: new Date(),
                    unsubscribedFromCampaign: campaignId || null,
                    unsubscribeReason: reason || null,
                },
                { new: true }
            );

            if (!updatedContact) {
                return res.status(404).json({ success: false, message: 'Contact not found' });
            }

            // If we have a campaign ID, track this as an event
            if (campaignId) {
                const TrackingModel = createTrackingModel(campaignId);

                await TrackingModel.create({
                    contactId: contactId,
                    campaignId: campaignId,
                    email: updatedContact.email,
                    eventType: 'unsubscribe', // You'll need to add this to your eventType enum
                    metadata: {
                        reason: reason || 'No reason provided',
                    },
                });
            }

            return res.status(200).json({ success: true, message: 'Successfully unsubscribed' });
        }

        return res.status(405).json({ success: false, message: 'Method not allowed' });
    } catch (error) {
        console.error('Unsubscribe error:', error);
        return res.status(500).json({ success: false, message: 'Server error processing unsubscribe request' });
    }
}

import { contactsDb } from '@/lib/db/contacts';
import { campaignsDb } from '@/lib/db/campaigns';
import { trackingDb } from '@/lib/db/tracking';
import { verifyUnsubscribeToken, decodeUnsubscribeToken } from '@/lib/tokenUtils';

export default async function handler(req, res) {
    try {
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
            const contact = await contactsDb.getById(contactId);

            if (!contact || contact.brand_id !== brandId && contact.brandId !== brandId) {
                return res.status(404).json({ success: false, message: 'Contact not found' });
            }

            // Return contact info to display on the unsubscribe page
            return res.status(200).json({
                success: true,
                email: contact.email,
                isUnsubscribed: contact.is_unsubscribed || contact.isUnsubscribed || false,
            });
        }

        // POST request - Process unsubscribe action
        if (req.method === 'POST') {
            const { reason } = req.body;

            // Update contact as unsubscribed
            const updatedContact = await contactsDb.update(
                contactId,
                {
                    status: 'unsubscribed',
                    is_unsubscribed: true,
                    unsubscribed_at: new Date(),
                    unsubscribed_from_campaign: campaignId || null,
                    unsubscribe_reason: reason || null,
                }
            );

            if (!updatedContact) {
                return res.status(404).json({ success: false, message: 'Contact not found' });
            }

            // If we have a campaign ID, track this as an event and update campaign stats
            if (campaignId) {
                // Create a tracking event
                await trackingDb.trackEvent({
                    contact_id: contactId,
                    campaign_id: campaignId,
                    email: updatedContact.email,
                    event_type: 'unsubscribe',
                    created_at: new Date(),
                    metadata: {
                        reason: reason || 'No reason provided',
                    },
                });

                // Increment the campaign's unsubscribes count
                // campaignsDb does not expose granular `inc`. Use get-update or specialized method.
                // Assuming simple update for now or adding usage of specific helper if exists.
                // For safety/concurrency, atomic inc is better but Supabase JS doesn't do `inc` easily without RPC.
                // MVP: get and update.
                try {
                    const campaign = await campaignsDb.getById(campaignId);
                    if (campaign) {
                        const stats = campaign.stats || {};
                        stats.unsubscribes = (stats.unsubscribes || 0) + 1;
                        await campaignsDb.update(campaignId, { stats });
                    }
                } catch (e) {
                    console.error('Error updating campaign stats:', e);
                }
            }

            return res.status(200).json({ success: true, message: 'Successfully unsubscribed' });
        }

        return res.status(405).json({ success: false, message: 'Method not allowed' });
    } catch (error) {
        console.error('Unsubscribe error:', error);
        return res.status(500).json({ success: false, message: 'Server error processing unsubscribe request' });
    }
}

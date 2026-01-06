import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { getContactListById } from '@/services/contactService';
import { contactsDb } from '@/lib/db/contacts';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    try {
        // This endpoint only supports PUT requests
        if (req.method !== 'PUT') {
            return res.status(405).json({ message: 'Method not allowed' });
        }

        const { user } = await getUserFromRequest(req, res);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId, listId } = req.query;
        const { contactIds, status, reason } = req.body;

        if (!brandId || !listId || !contactIds || !status || !Array.isArray(contactIds) || contactIds.length === 0) {
            return res.status(400).json({ message: 'Missing or invalid required parameters' });
        }

        // Check if the brand exists
        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // Check permission
        const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_CONTACTS);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        // Check if the list exists
        const contactList = await getContactListById(listId, brandId, userId);
        if (!contactList) {
            return res.status(404).json({ message: 'Contact list not found' });
        }

        // Validate status
        const validStatuses = ['active', 'unsubscribed', 'bounced', 'complained'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }

        // Prepare the update data
        const updateData = {
            status: status,
        };

        // Set additional fields based on status
        if (status === 'unsubscribed') {
            updateData.is_unsubscribed = true;
            updateData.unsubscribed_at = new Date();
            updateData.unsubscribe_reason = reason || 'Bulk unsubscribe by admin';
        } else if (status === 'bounced') {
            updateData.is_unsubscribed = true;
            updateData.bounced_at = new Date();
            updateData.bounce_reason = reason || 'Manually marked as bounced';
            updateData.unsubscribed_at = new Date();
        } else if (status === 'complained') {
            updateData.is_unsubscribed = true;
            updateData.complained_at = new Date();
            updateData.complaint_reason = reason || 'Manually marked as complained';
            updateData.unsubscribed_at = new Date();
        } else if (status === 'active') {
            // Reset unsubscribed status
            updateData.is_unsubscribed = false;
            // We don't clear the timestamps to maintain historical record
        }

        // Update all selected contacts
        const result = await contactsDb.bulkUpdateStatus(contactIds, brandId, updateData);

        return res.status(200).json({
            message: 'Contacts status updated successfully',
            updated: result.modifiedCount,
            matched: result.matchedCount,
        });
    } catch (error) {
        console.error('Error updating contact statuses:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

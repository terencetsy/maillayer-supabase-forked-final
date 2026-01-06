import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { getContactListById } from '@/services/contactService';
import { contactListsDb } from '@/lib/db/contactLists';
import crypto from 'crypto';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed', success: false });
    }

    try {
        const { user } = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized', success: false });
        }

        const userId = user.id;
        const { brandId, listId } = req.query;

        // Verify brand exists
        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found', success: false });
        }

        // Check permission
        const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_SETTINGS);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message, success: false });
        }

        // Verify list ownership
        const contactList = await getContactListById(listId, brandId);
        if (!contactList) {
            return res.status(404).json({ message: 'Contact list not found', success: false });
        }

        // Generate a new API key without Mongoose ObjectId
        const apiKey = `cl_${crypto.randomUUID()}_${Date.now().toString(36)}`;

        // Update the contact list with the new API key
        await contactListsDb.update(listId, {
            api_key: apiKey,
            updated_at: new Date()
        });

        return res.status(200).json({
            success: true,
            apiKey,
            message: 'API key regenerated successfully',
        });
    } catch (error) {
        console.error('Error regenerating API key:', error);
        return res.status(500).json({
            message: error.message || 'Error regenerating API key',
            success: false,
        });
    }
}

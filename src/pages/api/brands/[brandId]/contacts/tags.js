import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { contactsDb } from '@/lib/db/contacts';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    try {
        const { user } = await getUserFromRequest(req, res);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId } = req.query;

        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // GET: Get all unique tags for this brand
        if (req.method === 'GET') {
            const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.VIEW_CONTACTS);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }

            const tags = await contactsDb.getBrandTags(brandId);

            return res.status(200).json({
                tags: tags,
            });
        }

        // POST: Add tags to contacts
        if (req.method === 'POST') {
            const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_CONTACTS);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }

            const { contactIds, tags, action = 'add' } = req.body;

            if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
                return res.status(400).json({ message: 'Contact IDs required' });
            }

            if (!tags || !Array.isArray(tags) || tags.length === 0) {
                return res.status(400).json({ message: 'Tags required' });
            }

            const normalizedTags = tags.map((t) => t.toLowerCase().trim());

            const modifiedCount = await contactsDb.updateTags(contactIds, brandId, normalizedTags, action);

            return res.status(200).json({
                success: true,
                modified: modifiedCount,
            });
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Error managing tags:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { contactsDb } from '@/lib/db/contacts';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    try {
        // This endpoint only supports GET requests
        if (req.method !== 'GET') {
            return res.status(405).json({ message: 'Method not allowed' });
        }

        const { user } = await getUserFromRequest(req, res);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId } = req.query;
        const listIds = req.query.listIds ? req.query.listIds.split(',') : [];

        if (!brandId) {
            return res.status(400).json({ message: 'Missing brand ID' });
        }

        // Check if the brand exists
        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // Check permission
        const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.VIEW_CONTACTS);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        // If no list IDs provided, return empty result
        if (listIds.length === 0) {
            return res.status(200).json({});
        }

        const counts = await contactsDb.getCountsByListIds(listIds, brandId);

        return res.status(200).json(counts);
    } catch (error) {
        console.error('Error getting active contact counts:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

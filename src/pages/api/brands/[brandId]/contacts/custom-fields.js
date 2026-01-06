import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { contactsDb } from '@/lib/db/contacts';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    try {
        if (req.method !== 'GET') {
            return res.status(405).json({ message: 'Method not allowed' });
        }

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

        // Check permission
        const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.VIEW_CONTACTS);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        const fields = await contactsDb.getCustomFieldsStats(brandId);

        return res.status(200).json({ fields });
    } catch (error) {
        console.error('Error fetching custom fields:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

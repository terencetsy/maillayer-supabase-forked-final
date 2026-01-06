import { getUserFromRequest } from '@/lib/supabase';
import { getTemplateById, regenerateApiKey } from '@/services/transactionalService';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { user } = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId, templateId } = req.query;

        // Check permission
        const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_TRANSACTIONAL);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        const newKey = await regenerateApiKey(templateId, brandId);

        if (newKey) {
            return res.status(200).json({ apiKey: newKey });
        } else {
            return res.status(500).json({ message: 'Failed to regenerate API key' });
        }
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

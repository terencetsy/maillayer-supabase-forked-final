import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { getTemplateById, updateTemplate } from '@/services/transactionalService';
import { v4 as uuidv4 } from 'uuid';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    try {
        // Only allow PUT requests
        if (req.method !== 'PUT') {
            return res.status(405).json({ message: 'Method not allowed' });
        }

        const { user } = await getUserFromRequest(req);

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId, templateId } = req.query;

        if (!brandId || !templateId) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_TRANSACTIONAL);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        if (brand.status !== 'active') { // Assume 'status' column exists and verified brands are 'active'
            // Or verify email sending capability
            return res.status(400).json({ message: 'Brand is not verified for sending emails' });
        }

        const template = await getTemplateById(templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        // Brand ownership check
        if ((template.brand_id || template.brandId) !== brandId) {
            return res.status(403).json({ message: 'Mismatch' });
        }

        if (template.status === 'published') {
            return res.status(400).json({ message: 'Template is already published' });
        }

        // Generate API key if not already present
        // snake_case column `api_key`
        const apiKey = template.api_key || `trx_${uuidv4().replace(/-/g, '')}`;

        const updateData = {
            status: 'published',
            api_key: apiKey,
            published_at: new Date(),
        };

        const success = await updateTemplate(templateId, brandId, updateData);

        if (!success) {
            return res.status(500).json({ message: 'Failed to publish template' });
        }

        const updatedTemplate = await getTemplateById(templateId);

        res.status(200).json({
            message: 'Template published successfully',
            template: updatedTemplate,
        });
    } catch (error) {
        console.error('Error publishing template:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

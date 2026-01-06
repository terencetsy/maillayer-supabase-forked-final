import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { getIntegrationById, updateIntegration, deleteIntegration } from '@/services/integrationService';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    try {
        const { user } = await getUserFromRequest(req, res);

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId, integrationId } = req.query;

        if (!brandId || !integrationId) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        // Check if the brand belongs to the user
        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // Check permission based on request method
        const requiredPermission = req.method === 'GET' ? PERMISSIONS.VIEW_INTEGRATIONS : PERMISSIONS.EDIT_INTEGRATIONS;
        const authCheck = await checkBrandPermission(brandId, userId, requiredPermission);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        // GET - Fetch a specific integration
        if (req.method === 'GET') {
            const integration = await getIntegrationById(integrationId, brandId, userId);

            if (!integration) {
                return res.status(404).json({ message: 'Integration not found' });
            }

            return res.status(200).json(integration);
        }

        // PUT - Update an integration
        if (req.method === 'PUT') {
            const { name, config, status } = req.body;

            const updateData = {};
            if (name) updateData.name = name;
            if (config) updateData.config = config;
            if (status) updateData.status = status;

            const integration = await updateIntegration(integrationId, brandId, userId, updateData);

            if (!integration) {
                return res.status(404).json({ message: 'Integration not found' });
            }

            return res.status(200).json(integration);
        }

        // DELETE - Delete an integration
        if (req.method === 'DELETE') {
            const success = await deleteIntegration(integrationId, brandId, userId);

            if (!success) {
                return res.status(404).json({ message: 'Integration not found' });
            }

            return res.status(200).json({ message: 'Integration deleted successfully' });
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Error handling integration:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

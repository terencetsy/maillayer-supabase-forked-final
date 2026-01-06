import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { getTemplateById, updateTemplate, deleteTemplate, parseTemplateVariables } from '@/services/transactionalService';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    try {
        const { user } = await getUserFromRequest(req, res);

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId, templateId } = req.query;

        if (!brandId || !templateId) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        // Check if the brand belongs to the user
        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // Check permission based on request method
        const requiredPermission = req.method === 'GET' ? PERMISSIONS.VIEW_TRANSACTIONAL : PERMISSIONS.EDIT_TRANSACTIONAL;
        const authCheck = await checkBrandPermission(brandId, userId, requiredPermission);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        // GET request - get a specific template
        if (req.method === 'GET') {
            try {
                const template = await getTemplateById(templateId, brandId);

                if (!template) {
                    return res.status(404).json({ message: 'Template not found' });
                }

                return res.status(200).json(template);
            } catch (error) {
                console.error('Error fetching template:', error);
                return res.status(500).json({ message: 'Error fetching template' });
            }
        }

        // PUT request - update a template
        if (req.method === 'PUT') {
            try {
                const { name, subject, content, fromName, fromEmail, replyTo, status, variables, trackingConfig } = req.body;

                const template = await getTemplateById(templateId, brandId);

                if (!template) {
                    return res.status(404).json({ message: 'Template not found' });
                }

                const updateData = {};

                if (name) updateData.name = name;
                if (subject) updateData.subject = subject;
                if (content !== undefined) updateData.content = content;
                if (fromName) updateData.from_name = fromName;
                if (fromEmail) updateData.from_email = fromEmail;
                if (replyTo) updateData.reply_to = replyTo;
                if (status) updateData.status = status;
                if (trackingConfig) updateData.tracking_config = trackingConfig;

                // Update variables based on content
                if (content && (!variables || variables.length === 0)) {
                    updateData.variables = await parseTemplateVariables(content);
                } else if (variables) {
                    updateData.variables = variables;
                }

                const success = await updateTemplate(templateId, brandId, updateData);

                if (success) {
                    return res.status(200).json({ message: 'Template updated successfully' });
                } else {
                    return res.status(500).json({ message: 'Failed to update template' });
                }
            } catch (error) {
                console.error('Error updating template:', error);
                return res.status(500).json({ message: 'Error updating template' });
            }
        }

        // DELETE request - delete a template
        if (req.method === 'DELETE') {
            try {
                const template = await getTemplateById(templateId, brandId);

                if (!template) {
                    return res.status(404).json({ message: 'Template not found' });
                }

                const success = await deleteTemplate(templateId, brandId);

                if (success) {
                    return res.status(200).json({ message: 'Template deleted successfully' });
                } else {
                    return res.status(500).json({ message: 'Failed to delete template' });
                }
            } catch (error) {
                console.error('Error deleting template:', error);
                return res.status(500).json({ message: 'Error deleting template' });
            }
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

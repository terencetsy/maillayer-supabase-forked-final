import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { getTemplatesByBrandId, createTemplate, parseTemplateVariables } from '@/services/transactionalService';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';
import crypto from 'crypto';

export default async function handler(req, res) {
    try {
        const { user } = await getUserFromRequest(req, res);

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId } = req.query;

        if (!brandId) {
            return res.status(400).json({ message: 'Missing brand ID' });
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

        // GET request - get templates for a brand
        if (req.method === 'GET') {
            try {
                const templates = await getTemplatesByBrandId(brandId, userId);
                return res.status(200).json(templates);
            } catch (error) {
                console.error('Error fetching templates:', error);
                return res.status(500).json({ message: 'Error fetching templates' });
            }
        }

        // POST request - create new template
        if (req.method === 'POST') {
            try {
                const { name, subject, content, fromName, fromEmail, replyTo, variables = [], trackingConfig } = req.body;

                if (!name || !subject) {
                    return res.status(400).json({ message: 'Missing required fields' });
                }

                // Auto-detect variables in the content
                let templateVariables = variables;
                if (content && (!templateVariables || templateVariables.length === 0)) {
                    templateVariables = await parseTemplateVariables(content);
                }
                const apiKey = `txn_${crypto.randomUUID()}_${Date.now().toString(36)}`;

                const templateData = {
                    name,
                    subject,
                    content: content || '',
                    brand_id: brandId,
                    user_id: userId,
                    from_name: fromName || brand.fromName || '',
                    from_email: fromEmail || brand.fromEmail,
                    reply_to: replyTo || brand.replyToEmail,
                    status: 'draft',
                    api_key: apiKey,
                    variables: templateVariables,
                    tracking_config: trackingConfig || { track_opens: true, track_clicks: true },
                };

                const newTemplate = await createTemplate(templateData);
                return res.status(201).json(newTemplate);
            } catch (error) {
                console.error('Error creating template:', error);
                return res.status(500).json({ message: 'Error creating template' });
            }
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

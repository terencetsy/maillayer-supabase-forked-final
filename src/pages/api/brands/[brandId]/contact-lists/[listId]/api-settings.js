import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { getContactListById } from '@/services/contactService';
import { contactListsDb } from '@/lib/db/contactLists';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';
import crypto from 'crypto';

export default async function handler(req, res) {
    try {
        const { user } = await getUserFromRequest(req, res);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId, listId } = req.query;

        // Verify brand exists
        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // Check permission - Settings requires EDIT_SETTINGS permission
        const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_SETTINGS);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        // Verify list ownership
        const contactList = await getContactListById(listId, brandId, userId);
        if (!contactList) {
            return res.status(404).json({ message: 'Contact list not found' });
        }

        // GET - Get current API settings
        if (req.method === 'GET') {
            return res.status(200).json({
                apiKey: contactList.api_key || contactList.apiKey || null,
                apiEnabled: contactList.api_enabled || contactList.apiEnabled || false,
                allowedDomains: contactList.allowed_domains || contactList.allowedDomains || [],
                apiSettings: contactList.api_settings || contactList.apiSettings || {
                    requireDoubleOptIn: false,
                    allowDuplicates: false,
                    redirectUrl: '',
                },
            });
        }

        // POST - Generate new API key
        if (req.method === 'POST') {
            const newApiKey = `cl_${crypto.randomUUID()}_${Date.now().toString(36)}`;

            await contactListsDb.update(listId, {
                api_key: newApiKey,
                api_enabled: true,
                updated_at: new Date()
            });

            return res.status(200).json({
                success: true,
                apiKey: newApiKey,
                message: 'API key generated successfully',
            });
        }

        // PUT - Update API settings
        if (req.method === 'PUT') {
            const { apiEnabled, allowedDomains, apiSettings } = req.body;

            const updateData = {
                updated_at: new Date(),
            };

            if (typeof apiEnabled === 'boolean') {
                updateData.api_enabled = apiEnabled;
            }

            if (Array.isArray(allowedDomains)) {
                updateData.allowed_domains = allowedDomains.filter((d) => d.trim());
            }

            if (apiSettings) {
                updateData.api_settings = {
                    requireDoubleOptIn: apiSettings.requireDoubleOptIn || false,
                    allowDuplicates: apiSettings.allowDuplicates || false,
                    redirectUrl: apiSettings.redirectUrl || '',
                };
            }

            await contactListsDb.update(listId, updateData);

            return res.status(200).json({
                success: true,
                message: 'API settings updated successfully',
            });
        }

        // DELETE - Disable API and remove key
        if (req.method === 'DELETE') {
            await contactListsDb.update(listId, {
                api_enabled: false,
                updated_at: new Date()
            });

            return res.status(200).json({
                success: true,
                message: 'API access disabled',
            });
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Error managing API settings:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

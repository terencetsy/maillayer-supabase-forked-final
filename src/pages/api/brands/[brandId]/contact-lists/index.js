import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { getContactListsByBrandId, createContactList } from '@/services/contactService';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

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

        // Check if the brand exists
        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // GET - Fetch all contact lists for a brand
        if (req.method === 'GET') {
            const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.VIEW_CONTACTS);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }
            const contactLists = await getContactListsByBrandId(brandId, userId);
            return res.status(200).json(contactLists);
        }

        // POST - Create a new contact list
        if (req.method === 'POST') {
            const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_CONTACTS);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }

            const { name, description } = req.body;

            if (!name) {
                return res.status(400).json({ message: 'Name is required' });
            }

            const contactList = await createContactList({
                name,
                description,
                brandId,
                userId,
                contactCount: 0,
            });

            return res.status(201).json(contactList);
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Error handling contact lists:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

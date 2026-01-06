import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { getContactListById, updateContactList, deleteContactList } from '@/services/contactService';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    try {
        const { user } = await getUserFromRequest(req, res);

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId, listId } = req.query;

        if (!brandId || !listId) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        // Check if the brand exists
        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // GET - Fetch a specific contact list
        if (req.method === 'GET') {
            const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.VIEW_CONTACTS);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }
            const contactList = await getContactListById(listId, brandId, userId);

            if (!contactList) {
                return res.status(404).json({ message: 'Contact list not found' });
            }

            return res.status(200).json(contactList);
        }

        // PUT - Update a contact list
        if (req.method === 'PUT') {
            const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_CONTACTS);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }

            const { name, description } = req.body;

            if (!name) {
                return res.status(400).json({ message: 'Name is required' });
            }

            const contactList = await updateContactList(listId, brandId, userId, {
                name,
                description,
            });

            if (!contactList) {
                return res.status(404).json({ message: 'Contact list not found' });
            }

            return res.status(200).json(contactList);
        }

        // DELETE - Delete a contact list
        if (req.method === 'DELETE') {
            const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_CONTACTS);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }

            const success = await deleteContactList(listId, brandId, userId);

            if (!success) {
                return res.status(404).json({ message: 'Contact list not found' });
            }

            return res.status(200).json({ message: 'Contact list deleted successfully' });
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Error handling contact list:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

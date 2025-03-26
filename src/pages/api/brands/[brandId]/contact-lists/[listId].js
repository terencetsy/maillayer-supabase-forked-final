import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getBrandById } from '@/services/brandService';
import { getContactListById, updateContactList, deleteContactList } from '@/services/contactService';

export default async function handler(req, res) {
    try {
        // Connect to database
        await connectToDatabase();

        // Get session directly from server
        const session = await getServerSession(req, res, authOptions);

        if (!session || !session.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = session.user.id;
        const { brandId, listId } = req.query;

        if (!brandId || !listId) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        // Check if the brand belongs to the user
        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        if (brand.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to access this brand' });
        }

        // GET - Fetch a specific contact list
        if (req.method === 'GET') {
            const contactList = await getContactListById(listId, brandId, userId);

            if (!contactList) {
                return res.status(404).json({ message: 'Contact list not found' });
            }

            return res.status(200).json(contactList);
        }

        // PUT - Update a contact list
        if (req.method === 'PUT') {
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

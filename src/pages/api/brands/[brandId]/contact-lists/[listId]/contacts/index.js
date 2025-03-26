import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getBrandById } from '@/services/brandService';
import { getContactListById, getContactsByListId, addContactsToList, deleteContactsFromList } from '@/services/contactService';

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

        // Check if the list exists
        const contactList = await getContactListById(listId, brandId, userId);
        if (!contactList) {
            return res.status(404).json({ message: 'Contact list not found' });
        }

        // GET - Fetch contacts in a list
        if (req.method === 'GET') {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const sortField = req.query.sort || 'email';
            const sortOrder = req.query.order || 'asc';
            const search = req.query.search || '';

            const result = await getContactsByListId(listId, brandId, userId, {
                page,
                limit,
                sortField,
                sortOrder,
                search,
            });

            return res.status(200).json(result);
        }

        // POST - Add contacts to a list
        // POST - Add contacts to a list
        if (req.method === 'POST') {
            const { contacts: newContacts, skipDuplicates = false } = req.body;

            if (!newContacts || !Array.isArray(newContacts) || newContacts.length === 0) {
                return res.status(400).json({ message: 'No contacts provided' });
            }

            // Validate email addresses
            const invalidEmails = newContacts.filter((contact) => {
                return !contact.email || !contact.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
            });

            if (invalidEmails.length > 0) {
                return res.status(400).json({
                    message: 'Some contacts have invalid email addresses',
                    invalidEntries: invalidEmails,
                });
            }

            try {
                const importResult = await addContactsToList(listId, brandId, userId, newContacts, skipDuplicates);
                return res.status(201).json(importResult);
            } catch (error) {
                if (error.code === 11000) {
                    // Duplicate key error
                    return res.status(400).json({
                        message: error.message || 'Duplicate emails found. Set skipDuplicates to true to ignore them.',
                        error: error.error || error.message,
                    });
                }
                throw error;
            }
        }

        // DELETE - Delete contacts from a list
        if (req.method === 'DELETE') {
            const { contactIds } = req.body;

            if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
                return res.status(400).json({ message: 'No contact IDs provided' });
            }

            const result = await deleteContactsFromList(listId, brandId, userId, contactIds);
            return res.status(200).json(result);
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Error handling contacts:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

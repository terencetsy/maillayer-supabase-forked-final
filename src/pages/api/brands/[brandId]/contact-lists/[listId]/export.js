import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getBrandById } from '@/services/brandService';
import { getContactListById, getContactsByListId } from '@/services/contactService';
import { Parser } from 'json2csv';

export default async function handler(req, res) {
    try {
        // This endpoint only supports GET requests
        if (req.method !== 'GET') {
            return res.status(405).json({ message: 'Method not allowed' });
        }

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

        // Get the contact list and check if it exists
        const contactList = await getContactListById(listId, brandId, userId);
        if (!contactList) {
            return res.status(404).json({ message: 'Contact list not found' });
        }

        // Get all contacts in the list (overriding pagination limits)
        const { contacts } = await getContactsByListId(listId, brandId, userId, {
            limit: 10000, // Set a high limit to get all contacts
            sortField: 'email',
            sortOrder: 'asc',
        });

        // Format contacts for CSV export (pick specific fields)
        const contactsForExport = contacts.map((contact) => ({
            email: contact.email,
            firstName: contact.firstName || '',
            lastName: contact.lastName || '',
            phone: contact.phone || '',
            createdAt: contact.createdAt ? new Date(contact.createdAt).toISOString().split('T')[0] : '',
        }));

        // Create CSV from contacts
        const json2csvParser = new Parser({
            fields: [
                { label: 'Email', value: 'email' },
                { label: 'First Name', value: 'firstName' },
                { label: 'Last Name', value: 'lastName' },
                { label: 'Phone', value: 'phone' },
                { label: 'Created Date', value: 'createdAt' },
            ],
        });

        const csv = json2csvParser.parse(contactsForExport);

        // Set headers to download as CSV file
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${contactList.name}-contacts.csv"`);

        // Send the CSV data
        res.status(200).send(csv);
    } catch (error) {
        console.error('Error exporting contacts:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

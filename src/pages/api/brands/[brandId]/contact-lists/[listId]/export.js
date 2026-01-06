import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { getContactListById } from '@/services/contactService';
import { contactsDb } from '@/lib/db/contacts';
import { Parser } from 'json2csv';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    try {
        // This endpoint only supports GET requests
        if (req.method !== 'GET') {
            return res.status(405).json({ message: 'Method not allowed' });
        }

        const { user } = await getUserFromRequest(req, res);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId, listId } = req.query;
        const status = req.query.status || '';

        if (!brandId || !listId) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        // Check if the brand exists
        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // Check permission
        const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.VIEW_CONTACTS);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        // Get the contact list and check if it exists
        const contactList = await getContactListById(listId, brandId, userId);
        if (!contactList) {
            return res.status(404).json({ message: 'Contact list not found' });
        }

        // Get all contacts in the list matching the query
        const contacts = await contactsDb.getAllForExport(listId, status);

        // Format contacts for CSV export (pick specific fields)
        const contactsForExport = contacts.map((contact) => ({
            email: contact.email,
            firstName: contact.first_name || '',
            lastName: contact.last_name || '',
            phone: contact.phone || '',
            status: contact.status || 'active',
            createdAt: contact.created_at ? new Date(contact.created_at).toISOString().split('T')[0] : '',
            unsubscribedAt: contact.unsubscribed_at ? new Date(contact.unsubscribed_at).toISOString().split('T')[0] : '',
            unsubscribeReason: contact.unsubscribe_reason || '',
            bouncedAt: contact.bounced_at ? new Date(contact.bounced_at).toISOString().split('T')[0] : '',
            bounceReason: contact.bounce_reason || '',
            complainedAt: contact.complained_at ? new Date(contact.complained_at).toISOString().split('T')[0] : '',
        }));

        // Create CSV from contacts
        const json2csvParser = new Parser({
            fields: [
                { label: 'Email', value: 'email' },
                { label: 'First Name', value: 'firstName' },
                { label: 'Last Name', value: 'lastName' },
                { label: 'Phone', value: 'phone' },
                { label: 'Status', value: 'status' },
                { label: 'Created Date', value: 'createdAt' },
                { label: 'Unsubscribed Date', value: 'unsubscribedAt' },
                { label: 'Unsubscribe Reason', value: 'unsubscribeReason' },
                { label: 'Bounced Date', value: 'bouncedAt' },
                { label: 'Bounce Reason', value: 'bounceReason' },
                { label: 'Complained Date', value: 'complainedAt' },
            ],
        });

        const csv = json2csvParser.parse(contactsForExport);

        // Set filename based on status filter
        let filename = contactList.name;
        if (status && status !== 'all') {
            filename += `-${status}`;
        }
        filename += `-contacts.csv`;

        // Set headers to download as CSV file
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Send the CSV data
        res.status(200).send(csv);
    } catch (error) {
        console.error('Error exporting contacts:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

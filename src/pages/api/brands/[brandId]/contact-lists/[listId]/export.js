import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import mongoose from 'mongoose';
import { getBrandById } from '@/services/brandService';
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

        // Get the contact list schema and check if the list exists
        const ContactList =
            mongoose.models.ContactList ||
            mongoose.model(
                'ContactList',
                new mongoose.Schema({
                    name: String,
                    description: String,
                    brandId: mongoose.Schema.Types.ObjectId,
                    userId: mongoose.Schema.Types.ObjectId,
                    contactCount: { type: Number, default: 0 },
                    createdAt: { type: Date, default: Date.now },
                    updatedAt: { type: Date, default: Date.now },
                })
            );

        const contactList = await ContactList.findOne({
            _id: new mongoose.Types.ObjectId(listId),
            brandId: new mongoose.Types.ObjectId(brandId),
            userId: new mongoose.Types.ObjectId(userId),
        });

        if (!contactList) {
            return res.status(404).json({ message: 'Contact list not found' });
        }

        // Get all contacts in the list
        const Contact =
            mongoose.models.Contact ||
            mongoose.model(
                'Contact',
                new mongoose.Schema({
                    email: String,
                    firstName: String,
                    lastName: String,
                    phone: String,
                    listId: mongoose.Schema.Types.ObjectId,
                    brandId: mongoose.Schema.Types.ObjectId,
                    userId: mongoose.Schema.Types.ObjectId,
                    createdAt: { type: Date, default: Date.now },
                    updatedAt: { type: Date, default: Date.now },
                })
            );

        const contacts = await Contact.find(
            {
                listId: new mongoose.Types.ObjectId(listId),
                brandId: new mongoose.Types.ObjectId(brandId),
                userId: new mongoose.Types.ObjectId(userId),
            },
            {
                email: 1,
                firstName: 1,
                lastName: 1,
                phone: 1,
                createdAt: 1,
                _id: 0,
            }
        ).sort({ email: 1 });

        // Create CSV from contacts
        const json2csvParser = new Parser({
            fields: [
                { label: 'Email', value: 'email' },
                { label: 'First Name', value: 'firstName' },
                { label: 'Last Name', value: 'lastName' },
                { label: 'Phone', value: 'phone' },
                {
                    label: 'Created Date',
                    value: (row) => (row.createdAt ? new Date(row.createdAt).toISOString().split('T')[0] : ''),
                },
            ],
        });

        const csv = json2csvParser.parse(contacts);

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

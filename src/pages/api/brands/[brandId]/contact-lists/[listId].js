import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import mongoose from 'mongoose';
import { getBrandById } from '@/services/brandService';

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

        // Get the contact list schema
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

        // GET - Fetch a specific contact list
        if (req.method === 'GET') {
            const contactList = await ContactList.findOne({
                _id: new mongoose.Types.ObjectId(listId),
                brandId: new mongoose.Types.ObjectId(brandId),
                userId: new mongoose.Types.ObjectId(userId),
            });

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

            const contactList = await ContactList.findOneAndUpdate(
                {
                    _id: new mongoose.Types.ObjectId(listId),
                    brandId: new mongoose.Types.ObjectId(brandId),
                    userId: new mongoose.Types.ObjectId(userId),
                },
                {
                    name,
                    description,
                    updatedAt: new Date(),
                },
                { new: true }
            );

            if (!contactList) {
                return res.status(404).json({ message: 'Contact list not found' });
            }

            return res.status(200).json(contactList);
        }

        // DELETE - Delete a contact list
        if (req.method === 'DELETE') {
            // Get the Contact schema to delete all contacts in the list
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

            // First, check if the list exists
            const contactList = await ContactList.findOne({
                _id: new mongoose.Types.ObjectId(listId),
                brandId: new mongoose.Types.ObjectId(brandId),
                userId: new mongoose.Types.ObjectId(userId),
            });

            if (!contactList) {
                return res.status(404).json({ message: 'Contact list not found' });
            }

            // Delete all contacts in the list
            await Contact.deleteMany({
                listId: new mongoose.Types.ObjectId(listId),
                brandId: new mongoose.Types.ObjectId(brandId),
                userId: new mongoose.Types.ObjectId(userId),
            });

            // Delete the list itself
            await ContactList.deleteOne({
                _id: new mongoose.Types.ObjectId(listId),
                brandId: new mongoose.Types.ObjectId(brandId),
                userId: new mongoose.Types.ObjectId(userId),
            });

            return res.status(200).json({ message: 'Contact list deleted successfully' });
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Error handling contact list:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

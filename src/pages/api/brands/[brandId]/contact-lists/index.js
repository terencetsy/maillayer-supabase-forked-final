import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import mongoose from 'mongoose';
import { getBrandById } from '@/services/brandService';

// This handler would typically connect to your contact list model
// We'll create a basic implementation here
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
        const { brandId } = req.query;

        if (!brandId) {
            return res.status(400).json({ message: 'Missing brand ID' });
        }

        // Check if the brand belongs to the user
        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        if (brand.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to access this brand' });
        }

        // GET - Fetch all contact lists for a brand
        if (req.method === 'GET') {
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

            const contactLists = await ContactList.find({
                brandId: new mongoose.Types.ObjectId(brandId),
                userId: new mongoose.Types.ObjectId(userId),
            }).sort({ createdAt: -1 });

            return res.status(200).json(contactLists);
        }

        // POST - Create a new contact list
        if (req.method === 'POST') {
            const { name, description } = req.body;

            if (!name) {
                return res.status(400).json({ message: 'Name is required' });
            }

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

            const contactList = new ContactList({
                name,
                description,
                brandId: new mongoose.Types.ObjectId(brandId),
                userId: new mongoose.Types.ObjectId(userId),
                contactCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await contactList.save();

            return res.status(201).json(contactList);
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Error handling contact lists:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

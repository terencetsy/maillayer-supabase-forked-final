import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import mongoose from 'mongoose';
import { getBrandById } from '@/services/brandService';
import crypto from 'crypto';

export default async function handler(req, res) {
    // Connect to database
    await connectToDatabase();

    // POST - Create webhook for a list
    if (req.method === 'POST') {
        try {
            // Get session directly from server
            const session = await getServerSession(req, res, authOptions);

            if (!session || !session.user) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const userId = session.user.id;
            const { brandId, listId } = req.query;
            const { apiKey, apiEndpoint } = req.body;

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
                        webhookSecret: String,
                        webhookEndpoint: String,
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

            // Generate a webhook secret
            const webhookSecret = crypto.randomBytes(32).toString('hex');

            // Update the contact list with the webhook info
            await ContactList.updateOne(
                { _id: new mongoose.Types.ObjectId(listId) },
                {
                    webhookSecret,
                    webhookEndpoint: apiEndpoint,
                    updatedAt: new Date(),
                }
            );

            // Generate the webhook URL
            const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`;
            const webhookUrl = `${baseUrl}/api/webhook/${webhookSecret}`;

            return res.status(200).json({
                webhookUrl,
                message: 'Webhook created successfully',
            });
        } catch (error) {
            console.error('Error creating webhook:', error);
            return res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    // GET - For webhook verification
    if (req.method === 'GET') {
        return res.status(200).json({ status: 'success', message: 'Webhook active' });
    }

    return res.status(405).json({ message: 'Method not allowed' });
}

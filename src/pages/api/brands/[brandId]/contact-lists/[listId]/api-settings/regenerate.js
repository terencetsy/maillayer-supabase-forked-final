import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getBrandById } from '@/services/brandService';
import { getContactListById } from '@/services/contactService';
import ContactList from '@/models/ContactList';
import mongoose from 'mongoose';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed', success: false });
    }

    try {
        await connectToDatabase();

        const session = await getServerSession(req, res, authOptions);
        if (!session || !session.user) {
            return res.status(401).json({ message: 'Unauthorized', success: false });
        }

        const userId = session.user.id;
        const { brandId, listId } = req.query;

        // Verify brand ownership
        const brand = await getBrandById(brandId);
        if (!brand || brand.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized', success: false });
        }

        // Verify list ownership
        const contactList = await getContactListById(listId, brandId, userId);
        if (!contactList) {
            return res.status(404).json({ message: 'Contact list not found', success: false });
        }

        // Generate a new API key
        const apiKey = `cl_${new mongoose.Types.ObjectId().toString()}_${Date.now().toString(36)}`;

        // Update the contact list with the new API key
        await ContactList.updateOne(
            { _id: new mongoose.Types.ObjectId(listId) },
            {
                $set: {
                    apiKey: apiKey,
                    updatedAt: new Date(),
                },
            }
        );

        return res.status(200).json({
            success: true,
            apiKey,
            message: 'API key regenerated successfully',
        });
    } catch (error) {
        console.error('Error regenerating API key:', error);
        return res.status(500).json({
            message: error.message || 'Error regenerating API key',
            success: false,
        });
    }
}

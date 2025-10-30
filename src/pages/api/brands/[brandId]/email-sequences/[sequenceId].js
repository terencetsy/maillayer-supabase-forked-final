// src/pages/api/brands/[brandId]/email-sequences/[sequenceId].js
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getBrandById } from '@/services/brandService';
import { getEmailSequenceById, updateEmailSequence, deleteEmailSequence } from '@/services/emailSequenceService';

export default async function handler(req, res) {
    try {
        await connectToDatabase();

        const session = await getServerSession(req, res, authOptions);

        if (!session || !session.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = session.user.id;
        const { brandId, sequenceId } = req.query;

        if (!brandId || !sequenceId) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        if (brand.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to access this brand' });
        }

        // GET - Fetch sequence
        if (req.method === 'GET') {
            const sequence = await getEmailSequenceById(sequenceId, userId);

            if (!sequence) {
                return res.status(404).json({ message: 'Sequence not found' });
            }

            return res.status(200).json(sequence);
        }

        // PUT - Update sequence
        if (req.method === 'PUT') {
            const { name, description, triggerType, triggerConfig, emailConfig, emails, status, canvasData } = req.body;

            console.log('API received update request:', req.body); // Debug log

            const updateData = {};

            // Only add fields that are provided
            if (name !== undefined) updateData.name = name;
            if (description !== undefined) updateData.description = description;
            if (triggerType !== undefined) updateData.triggerType = triggerType;
            if (triggerConfig !== undefined) updateData.triggerConfig = triggerConfig;
            if (emailConfig !== undefined) updateData.emailConfig = emailConfig;
            if (emails !== undefined) updateData.emails = emails;
            if (status !== undefined) updateData.status = status;
            if (canvasData !== undefined) updateData.canvasData = canvasData;

            console.log('Updating sequence with data:', updateData); // Debug log

            const updatedSequence = await updateEmailSequence(sequenceId, userId, updateData);

            if (!updatedSequence) {
                return res.status(404).json({ message: 'Sequence not found or update failed' });
            }

            console.log('Sequence updated successfully:', updatedSequence); // Debug log

            return res.status(200).json(updatedSequence);
        }

        // DELETE - Delete sequence
        if (req.method === 'DELETE') {
            const success = await deleteEmailSequence(sequenceId, userId);

            if (!success) {
                return res.status(404).json({ message: 'Sequence not found' });
            }

            return res.status(200).json({ message: 'Sequence deleted successfully' });
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Error handling email sequence:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

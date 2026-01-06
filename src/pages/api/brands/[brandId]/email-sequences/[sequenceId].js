import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { getEmailSequenceById, updateEmailSequence, deleteEmailSequence } from '@/services/emailSequenceService';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    try {
        const { user } = await getUserFromRequest(req, res);

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId, sequenceId } = req.query;

        if (!brandId || !sequenceId) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // Check permission based on request method
        const requiredPermission = req.method === 'GET' ? PERMISSIONS.VIEW_SEQUENCES : PERMISSIONS.EDIT_SEQUENCES;
        const authCheck = await checkBrandPermission(brandId, userId, requiredPermission);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        // GET - Fetch sequence
        if (req.method === 'GET') {
            const sequence = await getEmailSequenceById(sequenceId, brandId);

            if (!sequence) {
                return res.status(404).json({ message: 'Sequence not found' });
            }

            return res.status(200).json(sequence);
        }

        // PUT - Update sequence
        if (req.method === 'PUT') {
            const { name, description, triggerType, triggerConfig, emailConfig, emails, status, canvasData, canvasPositions } = req.body;

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
            if (canvasPositions !== undefined) updateData.canvasPositions = canvasPositions;

            console.log('Updating sequence with data:', updateData); // Debug log

            const updatedSequence = await updateEmailSequence(sequenceId, brandId, updateData);

            if (!updatedSequence) {
                return res.status(404).json({ message: 'Sequence not found or update failed' });
            }

            return res.status(200).json(updatedSequence);
        }

        // DELETE - Delete sequence
        if (req.method === 'DELETE') {
            const success = await deleteEmailSequence(sequenceId, brandId);

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

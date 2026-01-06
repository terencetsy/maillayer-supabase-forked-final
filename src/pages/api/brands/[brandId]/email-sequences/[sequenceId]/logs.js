import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { getSequenceLogs } from '@/services/sequenceLogService'; // Updated service
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';
import { getEmailSequenceById } from '@/services/emailSequenceService';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { user } = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId, sequenceId } = req.query;

        if (!brandId || !sequenceId) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        // Check if brand exists
        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // Check permission
        const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.VIEW_SEQUENCES);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const email = req.query.email || '';
        const status = req.query.status || '';
        const startDate = req.query.startDate || null;
        const endDate = req.query.endDate || null;

        // Get the sequence
        const sequence = await getEmailSequenceById(sequenceId, brandId);
        if (!sequence) {
            return res.status(404).json({ message: 'Sequence not found' });
        }

        // Get logs using refactored service
        // Need to check if `getSequenceLogs` expects snake_case opts or not. 
        // Service likely adapts.
        const result = await getSequenceLogs(sequenceId, {
            page,
            limit,
            email,
            status,
            startDate,
            endDate,
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching sequence logs:', error);
        return res.status(500).json({
            message: 'Error fetching logs',
            error: error.message,
        });
    }
}

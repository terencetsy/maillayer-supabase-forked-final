import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { getEmailSequenceById } from '@/services/emailSequenceService';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

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

        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.VIEW_SEQUENCES);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        const sequence = await getEmailSequenceById(sequenceId, brandId);

        if (!sequence) {
            return res.status(404).json({ message: 'Sequence not found' });
        }

        // Stats - assume service maps stats or they are in the row object (JSONB or cols)
        // If snake_case cols:
        // `total_enrolled`, etc.
        // If `getSequenceById` returns raw row.
        // Let's assume raw row or mapped.
        // If it's pure Supabase row, it's snake_case.

        return res.status(200).json({
            totalEnrolled: sequence.total_enrolled || sequence.stats?.totalEnrolled || 0,
            totalActive: sequence.total_active || sequence.stats?.totalActive || 0,
            totalCompleted: sequence.total_completed || sequence.stats?.totalCompleted || 0,
            totalFailed: sequence.total_failed || sequence.stats?.totalFailed || 0,
            totalUnsubscribed: sequence.total_unsubscribed || sequence.stats?.totalUnsubscribed || 0,
            emailsSent: sequence.emails_sent || sequence.stats?.emailsSent || 0,
            emailsOpened: sequence.emails_opened || sequence.stats?.emailsOpened || 0,
            emailsClicked: sequence.emails_clicked || sequence.stats?.emailsClicked || 0,
        });
    } catch (error) {
        console.error('Error fetching sequence stats:', error);
        return res.status(500).json({
            message: 'Error fetching stats',
            error: error.message,
        });
    }
}

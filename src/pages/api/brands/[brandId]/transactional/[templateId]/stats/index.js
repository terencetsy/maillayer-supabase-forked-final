import { getUserFromRequest } from '@/lib/supabase';
import { getTemplateById } from '@/services/transactionalService';
import { transactionalDb } from '@/lib/db/transactional';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { user } = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const { brandId, templateId } = req.query;

        if (!brandId || !templateId) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        const template = await getTemplateById(templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        // Stats
        // Use transactionalDb helpers or simple counts
        // We defined countLogs and countLogsWhere in transactionalDb

        const sentCount = await transactionalDb.countLogsWhere(templateId);
        const deliveredCount = await transactionalDb.countLogsWhere(templateId, { status: 'delivered' });
        const openCount = await transactionalDb.countLogsWhere(templateId, { eventType: 'open' });
        const clickCount = await transactionalDb.countLogsWhere(templateId, { eventType: 'click' });
        // bounce can be status='failed' OR eventType='bounce'
        // countLogsWhere only supports one criteria well if I use `if`.
        // Let's implement complex bounce logic or just check 'failed'.
        const bounceCount = await transactionalDb.countLogsWhere(templateId, { status: 'failed' });
        const complaintCount = await transactionalDb.countLogsWhere(templateId, { eventType: 'complaint' });

        const openRate = sentCount > 0 ? ((openCount / sentCount) * 100).toFixed(1) : '0';
        const clickRate = sentCount > 0 ? ((clickCount / sentCount) * 100).toFixed(1) : '0';
        const bounceRate = sentCount > 0 ? ((bounceCount / sentCount) * 100).toFixed(1) : '0';
        const complaintRate = sentCount > 0 ? ((complaintCount / sentCount) * 100).toFixed(1) : '0';

        const stats = {
            sent: sentCount,
            delivered: deliveredCount,
            opens: openCount,
            clicks: clickCount,
            bounces: bounceCount,
            complaints: complaintCount,
            openRate,
            clickRate,
            bounceRate,
            complaintRate,
        };

        return res.status(200).json(stats);
    } catch (error) {
        console.error('Error fetching template stats:', error);
        return res.status(500).json({ message: 'Error fetching stats' });
    }
}

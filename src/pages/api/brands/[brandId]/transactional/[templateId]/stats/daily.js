import { getUserFromRequest } from '@/lib/supabase';
import { getTemplateById } from '@/services/transactionalService';
import { transactionalDb } from '@/lib/db/transactional';
import { startOfDay, subDays, format } from 'date-fns';

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
        const days = parseInt(req.query.days) || 30;

        if (!brandId || !templateId) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        const template = await getTemplateById(templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        // Date range
        const endDate = new Date();
        const startDate = subDays(endDate, days);

        // Fetch all relevant logs (lightweight)
        const logs = await transactionalDb.getAllLogsForStats(templateId, startDate, endDate);

        // Aggregation in JS
        const statsMap = {};

        // Initialize map
        for (let i = 0; i <= days; i++) {
            const currentDate = subDays(endDate, i);
            const formattedDate = format(currentDate, 'yyyy-MM-dd');
            statsMap[formattedDate] = { date: formattedDate, sent: 0, opens: 0, clicks: 0 };
        }

        logs.forEach(log => {
            const dateStr = format(new Date(log.created_at || log.sent_at), 'yyyy-MM-dd'); // use created_at or sent_at
            if (statsMap[dateStr]) {
                const events = log.events || [];

                // Sent
                statsMap[dateStr].sent += 1;

                // Opens
                if (events.some(e => e.type === 'open')) {
                    statsMap[dateStr].opens += 1; // Unique per log?
                    // Mongoose aggregated unique opens per day.
                    // This logic matches unique opens per log per day (roughly).
                }

                // Clicks
                if (events.some(e => e.type === 'click')) {
                    statsMap[dateStr].clicks += 1;
                }
            }
        });

        const sortedStats = Object.values(statsMap).sort((a, b) => a.date.localeCompare(b.date));

        return res.status(200).json({
            stats: sortedStats,
        });
    } catch (error) {
        console.error('Error fetching daily template stats:', error);
        return res.status(500).json({ message: 'Error fetching daily stats' });
    }
}

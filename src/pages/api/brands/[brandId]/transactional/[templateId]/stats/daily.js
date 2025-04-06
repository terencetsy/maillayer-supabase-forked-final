// src/pages/api/brands/[brandId]/transactional/[templateId]/stats/daily.js
import { getSession } from 'next-auth/react';
import { connectToDatabase } from '@/lib/mongodb';
import TransactionalTemplate from '@/models/TransactionalTemplate';
import TransactionalLog from '@/models/TransactionalLog';
import { getTemplateById } from '@/services/transactionalService';
import { startOfDay, subDays, format } from 'date-fns';

/**
 * @desc Get daily statistics for a transactional email template
 * @route GET /api/brands/:brandId/transactional/:templateId/stats/daily
 * @access Private
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const session = await getSession({ req });
        if (!session) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const userId = session.user.id;
        const { brandId, templateId } = req.query;
        const days = parseInt(req.query.days) || 30; // Default to 30 days

        if (!brandId || !templateId) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        // Get the template
        const template = await getTemplateById(templateId, userId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        // Ensure the template belongs to the brand
        if (template.brandId.toString() !== brandId) {
            return res.status(403).json({ message: 'Template does not belong to this brand' });
        }

        // Calculate the date range
        const endDate = new Date();
        const startDate = subDays(endDate, days);

        // Aggregate daily stats
        const dailySendStats = await TransactionalLog.aggregate([
            {
                $match: {
                    templateId: template._id,
                    brandId: template.brandId,
                    userId,
                    sentAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$sentAt' },
                        month: { $month: '$sentAt' },
                        day: { $dayOfMonth: '$sentAt' },
                    },
                    sent: { $sum: 1 },
                    date: { $first: '$sentAt' },
                },
            },
            {
                $project: {
                    _id: 0,
                    date: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$date',
                        },
                    },
                    sent: 1,
                },
            },
            {
                $sort: { date: 1 },
            },
        ]);

        // Aggregate daily open stats
        const dailyOpenStats = await TransactionalLog.aggregate([
            {
                $match: {
                    templateId: template._id,
                    brandId: template.brandId,
                    userId,
                    'events.type': 'open',
                    sentAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $unwind: '$events',
            },
            {
                $match: {
                    'events.type': 'open',
                },
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$events.timestamp' },
                        month: { $month: '$events.timestamp' },
                        day: { $dayOfMonth: '$events.timestamp' },
                    },
                    opens: { $sum: 1 },
                    date: { $first: '$events.timestamp' },
                },
            },
            {
                $project: {
                    _id: 0,
                    date: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$date',
                        },
                    },
                    opens: 1,
                },
            },
            {
                $sort: { date: 1 },
            },
        ]);

        // Aggregate daily click stats
        const dailyClickStats = await TransactionalLog.aggregate([
            {
                $match: {
                    templateId: template._id,
                    brandId: template.brandId,
                    userId,
                    'events.type': 'click',
                    sentAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $unwind: '$events',
            },
            {
                $match: {
                    'events.type': 'click',
                },
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$events.timestamp' },
                        month: { $month: '$events.timestamp' },
                        day: { $dayOfMonth: '$events.timestamp' },
                    },
                    clicks: { $sum: 1 },
                    date: { $first: '$events.timestamp' },
                },
            },
            {
                $project: {
                    _id: 0,
                    date: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$date',
                        },
                    },
                    clicks: 1,
                },
            },
            {
                $sort: { date: 1 },
            },
        ]);

        // Generate date range for all days
        const dateRange = [];
        for (let i = 0; i <= days; i++) {
            const currentDate = subDays(endDate, i);
            const formattedDate = format(currentDate, 'yyyy-MM-dd');
            dateRange.unshift({
                date: formattedDate,
                sent: 0,
                opens: 0,
                clicks: 0,
            });
        }

        // Fill in the actual data
        dailySendStats.forEach((day) => {
            const existingDay = dateRange.find((d) => d.date === day.date);
            if (existingDay) {
                existingDay.sent = day.sent;
            }
        });

        dailyOpenStats.forEach((day) => {
            const existingDay = dateRange.find((d) => d.date === day.date);
            if (existingDay) {
                existingDay.opens = day.opens;
            }
        });

        dailyClickStats.forEach((day) => {
            const existingDay = dateRange.find((d) => d.date === day.date);
            if (existingDay) {
                existingDay.clicks = day.clicks;
            }
        });

        return res.status(200).json({
            stats: dateRange,
        });
    } catch (error) {
        console.error('Error fetching daily template stats:', error);
        return res.status(500).json({ message: 'Error fetching daily stats' });
    }
}

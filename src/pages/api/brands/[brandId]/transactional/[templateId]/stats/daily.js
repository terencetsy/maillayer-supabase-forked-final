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

        console.log('Date range:', startDate, endDate);
        console.log('Template ID:', template._id);

        // Aggregate daily stats with improved date handling
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
                $addFields: {
                    // Convert to date string in UTC to handle timezone issues
                    dateString: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$sentAt',
                        },
                    },
                },
            },
            {
                $group: {
                    _id: '$dateString',
                    sent: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    date: '$_id',
                    sent: 1,
                },
            },
            {
                $sort: { date: 1 },
            },
        ]);

        // Aggregate daily open stats with improved event handling
        const dailyOpenStats = await TransactionalLog.aggregate([
            {
                $match: {
                    templateId: template._id,
                    brandId: template.brandId,
                    userId,
                    events: { $elemMatch: { type: 'open' } },
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
                $addFields: {
                    // Convert event timestamp to date string in UTC
                    eventDateString: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$events.timestamp',
                        },
                    },
                },
            },
            {
                $group: {
                    _id: '$eventDateString',
                    opens: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    date: '$_id',
                    opens: 1,
                },
            },
            {
                $sort: { date: 1 },
            },
        ]);

        // Aggregate daily click stats with improved event handling
        const dailyClickStats = await TransactionalLog.aggregate([
            {
                $match: {
                    templateId: template._id,
                    brandId: template.brandId,
                    userId,
                    events: { $elemMatch: { type: 'click' } },
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
                $addFields: {
                    // Convert event timestamp to date string in UTC
                    eventDateString: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$events.timestamp',
                        },
                    },
                },
            },
            {
                $group: {
                    _id: '$eventDateString',
                    clicks: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    date: '$_id',
                    clicks: 1,
                },
            },
            {
                $sort: { date: 1 },
            },
        ]);

        // Log a sample of raw data for debugging
        const sampleLogs = await TransactionalLog.find({
            templateId: template._id,
            brandId: template.brandId,
            userId,
            sentAt: { $gte: startDate, $lte: endDate },
        }).limit(3);

        console.log('Sample logs found:', sampleLogs.length);
        console.log(
            'Sample logs dates:',
            sampleLogs.map((log) => log.sentAt)
        );
        console.log(
            'Sample event counts:',
            sampleLogs.map((log) => log.events?.length || 0)
        );

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

        console.log('Daily send stats sample:', dailySendStats.slice(0, 3));
        console.log('Daily open stats sample:', dailyOpenStats.slice(0, 3));
        console.log('Daily click stats sample:', dailyClickStats.slice(0, 3));

        return res.status(200).json({
            stats: dateRange,
        });
    } catch (error) {
        console.error('Error fetching daily template stats:', error);
        return res.status(500).json({ message: 'Error fetching daily stats', error: error.message });
    }
}

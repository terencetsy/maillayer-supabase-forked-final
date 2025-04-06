// src/pages/api/brands/[brandId]/transactional/[templateId]/events.js
import { getSession } from 'next-auth/react';
import { connectToDatabase } from '@/lib/mongodb';
import TransactionalTemplate from '@/models/TransactionalTemplate';
import TransactionalLog from '@/models/TransactionalLog';
import { getTemplateById } from '@/services/transactionalService';
import mongoose from 'mongoose';

/**
 * @desc Get event logs for a transactional email template with filtering and pagination
 * @route GET /api/brands/:brandId/transactional/:templateId/events
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

        // Parse pagination and filter parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const eventType = req.query.eventType || '';
        const email = req.query.email || '';
        const sort = req.query.sort || 'timestamp';
        const order = req.query.order === 'asc' ? 1 : -1;

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

        // Build filters for the query
        const match = {
            templateId: new mongoose.Types.ObjectId(templateId),
            brandId: new mongoose.Types.ObjectId(brandId),
            'events.0': { $exists: true }, // Only get logs with events
        };

        // Process all events from logs
        const pipeline = [
            { $match: match },
            { $unwind: '$events' }, // Unwind events array to individual documents
        ];

        // Filter by event type if provided
        if (eventType) {
            pipeline.push({ $match: { 'events.type': eventType } });
        }

        // Filter by email if provided
        if (email) {
            pipeline.push({ $match: { to: { $regex: email, $options: 'i' } } });
        }

        // Create a sortable field
        if (sort === 'timestamp') {
            pipeline.push({
                $addFields: {
                    sortField: '$events.timestamp',
                },
            });
        } else if (sort === 'email') {
            pipeline.push({
                $addFields: {
                    sortField: '$to',
                },
            });
        } else if (sort === 'type') {
            pipeline.push({
                $addFields: {
                    sortField: '$events.type',
                },
            });
        }

        // Get total count for pagination
        const countPipeline = [...pipeline];
        countPipeline.push({ $count: 'total' });
        const countResult = await TransactionalLog.aggregate(countPipeline);
        const total = countResult.length > 0 ? countResult[0].total : 0;
        const totalPages = Math.ceil(total / limit);

        // Sort and paginate
        pipeline.push({ $sort: { sortField: order } }, { $skip: (page - 1) * limit }, { $limit: limit });

        // Project the final results
        pipeline.push({
            $project: {
                _id: '$_id',
                email: '$to',
                type: '$events.type',
                timestamp: '$events.timestamp',
                metadata: '$events.metadata',
            },
        });

        const events = await TransactionalLog.aggregate(pipeline);

        // Get event type distribution for filtering
        const eventCounts = await TransactionalLog.aggregate([{ $match: match }, { $unwind: '$events' }, { $group: { _id: '$events.type', count: { $sum: 1 } } }, { $project: { _id: 0, type: '$_id', count: 1 } }]).then((results) => {
            // Convert to object for easier access
            const counts = {};
            results.forEach((item) => {
                counts[item.type] = item.count;
            });
            return counts;
        });

        return res.status(200).json({
            events,
            pagination: {
                total,
                totalPages,
                currentPage: page,
                limit,
            },
            eventCounts,
        });
    } catch (error) {
        console.error('Error fetching template events:', error);
        return res.status(500).json({
            message: 'Error fetching events',
            error: error.message,
        });
    }
}

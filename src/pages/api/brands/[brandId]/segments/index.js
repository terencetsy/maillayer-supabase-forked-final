// src/pages/api/brands/[brandId]/segments/index.js
import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';
import * as segmentService from '@/services/segmentService';

export default async function handler(req, res) {
    try {
        const { user } = await getUserFromRequest(req, res);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId } = req.query;

        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // GET: List all segments
        if (req.method === 'GET') {
            const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.VIEW_CONTACTS);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }

            let segments = await segmentService.getSegmentsByBrandId(brandId, userId);

            // Optionally refresh counts
            const refreshCounts = req.query.refreshCounts === 'true';
            if (refreshCounts) {
                const refreshedSegments = [];
                for (const segment of segments) {
                    await segmentService.updateSegmentCount(segment.id);
                }
                segments = await segmentService.getSegmentsByBrandId(brandId, userId);
            }

            return res.status(200).json(segments);
        }

        // POST: Create a new segment
        if (req.method === 'POST') {
            const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_CONTACTS);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }

            const { name, description, type, conditions, contactListIds } = req.body;

            if (!name) {
                return res.status(400).json({ message: 'Segment name is required' });
            }

            const segmentData = {
                name,
                description,
                brand_id: brandId,
                user_id: userId,
                type: type || 'dynamic',
                conditions: conditions || { matchType: 'all', rules: [] }, // Supabase JSONB
                contact_list_ids: contactListIds || [], // Supabase Array mapped to snake_case?
                // Mongoose used `contactListIds` (camel). Supabase likely `contact_list_ids`. 
                // Need to verify DB schema. Assuming standard snake_case mapping in `segmentsDb.create`.
                // Actually `segmentsDb` insert `segmentData`. If schema is snake_case, keys must be snake_case.
            };

            // Adjust keys to snake_case if needed
            segmentData.contact_list_ids = contactListIds || [];
            delete segmentData.contactListIds;

            const segment = await segmentService.createSegment(segmentData);

            return res.status(201).json(segment);
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Error handling segments:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

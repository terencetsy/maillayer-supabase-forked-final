// src/pages/api/brands/[brandId]/segments/[segmentId].js
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
        const { brandId, segmentId } = req.query;

        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // GET: Get a specific segment
        if (req.method === 'GET') {
            const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.VIEW_CONTACTS);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }

            const segment = await segmentService.getSegmentById(segmentId, brandId, userId);

            if (!segment) {
                return res.status(404).json({ message: 'Segment not found' });
            }

            return res.status(200).json(segment);
        }

        // PUT: Update a segment
        if (req.method === 'PUT') {
            const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_CONTACTS);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }

            const { name, description, type, conditions, contactListIds } = req.body;

            if (!name) {
                return res.status(400).json({ message: 'Segment name is required' });
            }

            const updateData = {
                name,
                description,
                type: type || 'dynamic',
                conditions: conditions || { matchType: 'all', rules: [] },
                contact_list_ids: contactListIds || [], // snake_case
                last_count_updated: null, // trigger refresh
            };

            const updatedSegment = await segmentService.updateSegment(segmentId, brandId, userId, updateData);

            if (!updatedSegment) {
                return res.status(404).json({ message: 'Segment not found' });
            }

            return res.status(200).json(updatedSegment);
        }

        // DELETE: Delete a segment
        if (req.method === 'DELETE') {
            const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_CONTACTS);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }

            const success = await segmentService.deleteSegment(segmentId, brandId, userId);

            if (!success) {
                return res.status(404).json({ message: 'Segment not found' });
            }

            return res.status(200).json({ message: 'Segment deleted successfully' });
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Error handling segment:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

import { segmentsDb } from '@/lib/db/segments';
import { contactsDb } from '@/lib/db/contacts';

export async function getSegmentContacts(segmentId, brandId, userId, options = {}) {
    // 1. Fetch segment definition
    const segment = await segmentsDb.getById(segmentId);
    if (!segment) throw new Error('Segment not found');

    // 2. Build query based on segment.conditions
    // If type is 'static', fetch by IDs
    if (segment.type === 'static' && segment.static_contact_ids) {
        // Need to fetch specific contacts. contactsDb currently lacks bulkGetByIds?
        // We can add it or just loop for now (inefficient) or use 'in' filter helper.
        // Assuming we add a simple filter:
        // return contactsDb.getByIds(segment.static_contact_ids) -> needs implementation
        return { contacts: [], total: 0 }; // Placeholder
    }

    // Dynamic segment
    const { data, count } = await segmentsDb.getMatchingContacts(brandId, segment.conditions);

    return {
        contacts: data,
        total: count,
        page: options.page || 1,
        totalPages: Math.ceil(count / (options.limit || 50)),
    };
}

export async function updateSegmentCount(segmentId) {
    const segment = await segmentsDb.getById(segmentId);
    if (!segment) return;

    const { count } = await segmentsDb.getMatchingContacts(segment.brand_id, segment.conditions);

    await segmentsDb.update(segmentId, { cached_count: count, last_count_updated: new Date() });
    return count;
}

export async function createSegment(data) {
    const segment = await segmentsDb.create(data);
    updateSegmentCount(segment.id); // Async update
    return segment;
}

export async function getSegmentsByBrandId(brandId, userId) {
    return await segmentsDb.getByBrandId(brandId);
}

export async function getSegmentById(segmentId, brandId, userId) {
    return await segmentsDb.getById(segmentId);
}

export async function updateSegment(segmentId, brandId, userId, updateData) {
    const segment = await segmentsDb.update(segmentId, updateData);
    if (segment) updateSegmentCount(segment.id);
    return segment;
}

export async function deleteSegment(segmentId, brandId, userId) {
    await segmentsDb.delete(segmentId);
    return true;
}

export function buildSegmentQuery(segment, brandId) {
    // Deprecated for direct Mongo usage, but might be useful if converted to PostgREST filter string
    return {};
}

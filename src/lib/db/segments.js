import { supabase } from '../supabase'

export const segmentsDb = {
    async getByBrandId(brandId) {
        const { data, error } = await supabase
            .from('segments')
            .select('*')
            .eq('brand_id', brandId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
        if (error) throw error
        return data
    },

    async getById(segmentId) {
        const { data, error } = await supabase
            .from('segments')
            .select('*')
            .eq('id', segmentId)
            .single()
        if (error) throw error
        return data
    },

    async create(segmentData) {
        const { data, error } = await supabase
            .from('segments')
            .insert(segmentData)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async update(segmentId, updates) {
        const { data, error } = await supabase
            .from('segments')
            .update(updates)
            .eq('id', segmentId)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async delete(segmentId) {
        const { error } = await supabase
            .from('segments')
            .delete()
            .eq('id', segmentId)
        if (error) throw error
    },

    // Query builder helper
    async getMatchingContacts(brandId, conditions) {
        // Build Supabase query dynamically based on conditions
        let query = supabase.from('contacts').select('*', { count: 'exact' }).eq('brand_id', brandId)

        // Simplified rule mapping (assumes AND logic for now or handles top-level array)
        // conditions structure from segmentService: { rules: [], matchType: 'any'/'all' }

        if (conditions && conditions.rules && conditions.rules.length > 0) {
            if (conditions.matchType === 'any') {
                // OR logic: construct a single .or() string
                // This is tricky with complex operators.
                // Fallback: If 'any', client-side might be needed or complex RLS.
                // MVP: Support 'all' (AND) best. 'any' (OR) limited support.
            } else {
                // ALL logic (AND)
                conditions.rules.forEach(rule => {
                    const { field, operator, value } = rule
                    // Map operators
                    switch (operator) {
                        case 'equals': query = query.eq(field, value); break;
                        case 'not_equals': query = query.neq(field, value); break;
                        case 'contains': query = query.ilike(field, `%${value}%`); break;
                        case 'starts_with': query = query.ilike(field, `${value}%`); break;
                        case 'ends_with': query = query.ilike(field, `%${value}`); break;
                        case 'greater_than': query = query.gt(field, value); break;
                        case 'less_than': query = query.lt(field, value); break;
                        // ... other operators
                    }
                })
            }
        }

        const { data, count, error } = await query
        if (error) throw error
        return { data, count }
    }
}

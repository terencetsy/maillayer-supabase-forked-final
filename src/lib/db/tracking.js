import { supabase } from '../supabase'

export const trackingDb = {
    async trackEvent(eventData) {
        const { data, error } = await supabase
            .from('tracking_events')
            .insert(eventData)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async getEvents(campaignId, { limit = 50, offset = 0, eventType = '', email = '', sort = 'created_at', order = 'desc' } = {}) {
        let query = supabase
            .from('tracking_events')
            .select('*', { count: 'exact' })
            .eq('campaign_id', campaignId)
            .range(offset, offset + limit - 1)
            .order(sort || 'created_at', { ascending: order === 'asc' })

        if (eventType) {
            query = query.eq('event_type', eventType)
        }
        if (email) {
            query = query.ilike('email', `%${email}%`)
        }

        const { data, error, count } = await query
        if (error) throw error
        return { data, total: count }
    },

    // Aggregation helpers (using count queries for MVP)
    async countEvents(campaignId, eventType) {
        const { count, error } = await supabase
            .from('tracking_events')
            .select('id', { count: 'exact', head: true }) // optimized count
            .eq('campaign_id', campaignId)
            .eq('event_type', eventType)

        if (error) throw error
        return count
    },

    async getUniqueEmails(campaignId, eventType) {
        // Supabase .select with distinct?
        // Not natively easy without raw sql or logic.
        // MVP: Use a specialized RPC `get_unique_interactions(campaign_id, event_type)`
        // Fallback: fetch all stats (lightweight columns) and count unique in JS?
        // OR: create a view?

        // Let's assume we use an RPC for efficient stats, or just simple count if we defined unique constraints (unlikely).
        // If we don't have RPC, we might fetch distinct emails.
        // `supabase.from('tracking_events').select('email', { count: 'exact', head: false }).eq(...).range(...)`

        // For now, let's keep it simple: Return null and let service handle aggregation via standard fetch if RPC missing.
        return null;
    }
}

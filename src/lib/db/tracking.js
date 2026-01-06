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

    async countEvents(campaignId, eventType) {
        const { count, error } = await supabase
            .from('tracking_events')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaignId)
            .eq('event_type', eventType)
        if (error) throw error
        return count
    },

    async getEvents(campaignId, options = {}) {
        const { limit = 50, offset = 0, eventType, email, sort = 'created_at', order = 'desc' } = options

        let query = supabase
            .from('tracking_events')
            .select('*', { count: 'exact' })
            .eq('campaign_id', campaignId)

        if (eventType) {
            query = query.eq('event_type', eventType)
        }

        if (email) {
            query = query.eq('email', email)
        }

        query = query.order(sort, { ascending: order === 'asc' })
            .range(offset, offset + limit - 1)

        const { data, count, error } = await query
        if (error) throw error

        return { data, total: count }
    },

    // For Geostats: fetch metadata and user_agent for all events of a campaign
    // Warning: Potential performance issue if millions of events.
    async getEventsForStats(campaignId, eventType = null) {
        let query = supabase
            .from('tracking_events')
            .select('metadata, user_agent, event_type')
            .eq('campaign_id', campaignId)

        if (eventType) {
            query = query.eq('event_type', eventType)
        }

        // Supabase limit default 1000. Increase if needed for stats or handle pagination.
        // For MVP, limit to 5000 is reasonable.
        query = query.limit(5000);

        const { data, error } = await query
        if (error) throw error
        return data
    }
}

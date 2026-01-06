import { supabase } from '../supabase'

export const sequenceLogsDb = {
    async logEmail(logData) {
        const { data, error } = await supabase
            .from('sequence_logs')
            .insert(logData)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async getLogs(sequenceId, { limit = 50, offset = 0, email = '', status = '', startDate = null, endDate = null } = {}) {
        let query = supabase
            .from('sequence_logs')
            .select('*', { count: 'exact' })
            .eq('sequence_id', sequenceId)
            .range(offset, offset + limit - 1)
            .order('sent_at', { ascending: false })

        if (email) query = query.ilike('email', `%${email}%`)
        if (status) query = query.eq('status', status)
        if (startDate) query = query.gte('sent_at', startDate)
        if (endDate) query = query.lte('sent_at', endDate)

        const { data, error, count } = await query
        if (error) throw error
        return { data, total: count }
    },

    // Stats helpers
    async countByStatus(sequenceId) {
        // Return counts grouped by status?
        // Supabase JS doesn't do group by nicely without .rpc() or client cleanup.
        // MVP: fetch distinct statuses? or just iterate known statuses?
        // "delivered", "failed", "queued"?
        // We can run separate count queries or use RPC.
        // Let's rely on service logic calling .count() repeatedly if needed, or RPC.
        // Implementation: `supabase.rpc('count_sequence_logs_by_status', { seq_id })`
        // Fallback: simple counts for specific statuses needed by UI.
        return {}; // Placeholder for service to implement specific calls
    },

    async count(sequenceId, filters = {}) {
        let query = supabase
            .from('sequence_logs')
            .select('*', { count: 'exact', head: true })
            .eq('sequence_id', sequenceId)

        if (filters.status) query = query.eq('status', filters.status)
        if (filters.event_type) {
            // events is likely JSONB array. 
            // .contains('events', [{type: filters.event_type}])
            query = query.contains('events', [{ type: filters.event_type }])
        }

        const { count, error } = await query
        if (error) throw error
        return count
    },

    async updateEvent(sequenceId, enrollmentId, eventType, metadata) {
        // Find log entry for this enrollment & sequence (assuming one log per email/enrollment step?)
        // Check service logic: one log per email sent.
        // trackSequenceEvent needs to find the *specific* log.
        // It usually tracked by `enrollmentId` AND `sequenceId`.
        // But one enrollment has multiple steps/logs.
        // We might need stepId or ensure we find the latest/relevant log.
        // Previous logic: `findOne({ sequenceId, enrollmentId, 'events.type': eventType })`

        // For now, we'll expose a general update method or custom RPC logic in service.
        // Let's implement `findLog` to help service.
        return null;
    },

    async findLog(query) {
        let q = supabase.from('sequence_logs').select('*')
        if (query.sequenceId) q = q.eq('sequence_id', query.sequenceId)
        if (query.enrollmentId) q = q.eq('enrollment_id', query.enrollmentId)
        // ...

        const { data, error } = await q.maybeSingle() // or limit(1)
        if (error) throw error
        return data
    },

    async update(logId, updates) {
        const { data, error } = await supabase.from('sequence_logs').update(updates).eq('id', logId).select().single()
        if (error) throw error
        return data
    },

    async addEvent(logId, event) {
        // Append to events array (Postgres)
        // Needs RPC 'append_array' or read-modify-write.
        // Read-modify-write is MVP safe for low concurrency.
        const { data: log } = await supabase.from('sequence_logs').select('events').eq('id', logId).single()
        const events = log.events || []
        events.push(event)

        const { data, error } = await supabase.from('sequence_logs').update({ events }).eq('id', logId).select().single()
        if (error) throw error
        return data
    }
}

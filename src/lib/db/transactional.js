import { supabase } from '../supabase'

export const transactionalDb = {
    async getTemplatesByBrandId(brandId) {
        const { data, error } = await supabase
            .from('transactional_templates')
            .select('*')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false })
        if (error) throw error
        return data
    },

    async getTemplateById(templateId) {
        const { data, error } = await supabase
            .from('transactional_templates')
            .select('*')
            .eq('id', templateId)
            .single()
        if (error) throw error
        return data
    },

    async getTemplateByApiKey(apiKey) {
        const { data, error } = await supabase
            .from('transactional_templates')
            .select('*')
            .eq('api_key', apiKey)
            .eq('status', 'active')
            .single()
        if (error) throw error
        return data
    },

    async createTemplate(templateData) {
        const { data, error } = await supabase
            .from('transactional_templates')
            .insert(templateData)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async updateTemplate(templateId, updates) {
        const { data, error } = await supabase
            .from('transactional_templates')
            .update(updates)
            .eq('id', templateId)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async deleteTemplate(templateId) {
        const { error } = await supabase
            .from('transactional_templates')
            .delete()
            .eq('id', templateId)
        if (error) throw error
    },

    // Logs
    async logEmail(logData) {
        const { data, error } = await supabase
            .from('transactional_logs')
            .insert(logData)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async getLogs(templateId, { limit = 50, offset = 0, email = '', status = '' } = {}) {
        let query = supabase
            .from('transactional_logs')
            .select('*', { count: 'exact' })
            .eq('template_id', templateId)
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false })

        if (email) {
            query = query.ilike('to_email', `%${email}%`) // Assuming column is 'to_email' or 'to'
        }
        if (status) {
            query = query.eq('status', status)
        }

        const { data, error, count } = await query
        if (error) throw error
        return { data, total: count }
    },

    async countLogs(templateId, type) {
        // Count events. Assuming 'events' is a JSONB column or separate table.
        // Spec from previous code implies 'events' array in log.
        // In Supabase/Postgres, checking inside JSONB array for counts is harder.
        // If we have a separate 'transactional_events' table, clear.
        // If JSONB: use arrow operators.

        // BUT migration likely didn't normalize events.
        // Simple count of logs is easy. 
        // Counting 'opens' inside logs requires traversing JSONB array.

        // MVP: Query logs where events @> '[{"type": "open"}]'
        const { count, error } = await supabase
            .from('transactional_logs')
            .select('*', { count: 'exact', head: true })
            .eq('template_id', templateId)
            .contains('events', [{ type }])

        if (error) throw error
        return count
    }
}

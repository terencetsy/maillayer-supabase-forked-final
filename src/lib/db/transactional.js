import { supabaseAdmin } from '../supabase'

// Use supabaseAdmin for server-side DB operations to bypass RLS/Auth checks
const db = supabaseAdmin

export const transactionalDb = {
    async getTemplatesByBrandId(brandId) {
        const { data, error } = await db
            .from('transactional_templates')
            .select('*')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false })
        if (error) throw error
        return data
    },

    async getTemplateById(templateId) {
        const { data, error } = await db
            .from('transactional_templates')
            .select('*')
            .eq('id', templateId)
            .single()
        if (error) throw error
        return data
    },

    async getTemplateByApiKey(apiKey) {
        const { data, error } = await db
            .from('transactional_templates')
            .select('*')
            .eq('api_key', apiKey)
            .eq('status', 'active')
            .single()
        if (error) throw error
        return data
    },

    async createTemplate(templateData) {
        const { data, error } = await db
            .from('transactional_templates')
            .insert(templateData)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async updateTemplate(templateId, updates) {
        const { data, error } = await db
            .from('transactional_templates')
            .update(updates)
            .eq('id', templateId)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async deleteTemplate(templateId) {
        const { error } = await db
            .from('transactional_templates')
            .delete()
            .eq('id', templateId)
        if (error) throw error
    },

    // Logs
    async logEmail(logData) {
        const { data, error } = await db
            .from('transactional_logs')
            .insert(logData)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async getLogs(templateId, { limit = 50, offset = 0, email = '', status = '', startDate = null, endDate = null } = {}) {
        let query = db
            .from('transactional_logs')
            .select('*', { count: 'exact' })
            .eq('template_id', templateId)

        if (email) {
            query = query.ilike('to_email', `%${email}%`)
        }
        if (status) {
            query = query.eq('status', status)
        }
        if (startDate) {
            query = query.gte('created_at', startDate instanceof Date ? startDate.toISOString() : startDate)
        }
        if (endDate) {
            query = query.lte('created_at', endDate instanceof Date ? endDate.toISOString() : endDate)
        }

        query = query.order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        const { data, error, count } = await query
        if (error) throw error
        return { data, total: count }
    },

    // Fetch all logs for stats aggregation (careful with large datasets)
    async getAllLogsForStats(templateId, startDate, endDate) {
        let query = db
            .from('transactional_logs')
            .select('created_at, status, events') // Select only needed fields
            .eq('template_id', templateId)

        if (startDate) {
            query = query.gte('created_at', startDate instanceof Date ? startDate.toISOString() : startDate)
        }
        if (endDate) {
            query = query.lte('created_at', endDate instanceof Date ? endDate.toISOString() : endDate)
        }

        // Supabase limit default 1000. Increase for stats.
        query = query.limit(10000);

        const { data, error } = await query
        if (error) throw error
        return data
    },

    async countLogs(templateId, type) {
        let query = db
            .from('transactional_logs')
            .select('*', { count: 'exact', head: true })
            .eq('template_id', templateId)

        if (type) {
            query = query.contains('events', [{ type }])
        }

        const { count, error } = await query
        if (error) throw error
        return count
    },

    // Explicit count helper for flexible criteria (without loading data)
    async countLogsWhere(templateId, criteria = {}) {
        let query = db
            .from('transactional_logs')
            .select('*', { count: 'exact', head: true })
            .eq('template_id', templateId)

        if (criteria.status) query = query.eq('status', criteria.status);
        if (criteria.eventType) query = query.contains('events', [{ type: criteria.eventType }]);
        if (criteria.error) query = query.ilike('error', `%${criteria.error}%`); // basic error check

        const { count, error } = await query;
        if (error) throw error;
        return count;
    },

    async updateLog(logId, updates) {
        const { data, error } = await db
            .from('transactional_logs')
            .update(updates)
            .eq('id', logId)
            .select()
            .single()
        if (error) throw error
        return data
    }
}

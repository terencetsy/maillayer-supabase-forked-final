import { supabase } from '../supabase'

export const integrationsDb = {
    async getByBrandId(brandId) {
        const { data, error } = await supabase
            .from('integrations')
            .select('*')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false })
        if (error) throw error
        return data
    },

    async getById(integrationId) {
        const { data, error } = await supabase
            .from('integrations')
            .select('*')
            .eq('id', integrationId)
            .single()
        if (error) throw error
        return data
    },

    async getByType(brandId, type) {
        const { data, error } = await supabase
            .from('integrations')
            .select('*')
            .eq('brand_id', brandId)
            .eq('type', type)
            .single()
        // It's possible to not have one, so we just return null if error is 'PGRST116' (row not found), 
        // or let service handle it. 
        // Supabase single() throws if no rows. maybe() or maybeSingle() is better if available in client version.
        // Assuming standard client behavior where .single() returns error.
        if (error && error.code !== 'PGRST116') throw error
        return data
    },

    async create(integrationData) {
        const { data, error } = await supabase
            .from('integrations')
            .insert(integrationData)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async update(integrationId, updates) {
        const { data, error } = await supabase
            .from('integrations')
            .update(updates)
            .eq('id', integrationId)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async delete(integrationId) {
        const { error } = await supabase
            .from('integrations')
            .delete()
            .eq('id', integrationId)
        if (error) throw error
    }
}

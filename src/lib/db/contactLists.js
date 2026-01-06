import { supabase } from '../supabase'

export const contactListsDb = {
    async getByBrandId(brandId) {
        const { data, error } = await supabase
            .from('contact_lists')
            .select('*')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false })
        if (error) throw error
        return data
    },

    async getById(listId) {
        const { data, error } = await supabase
            .from('contact_lists')
            .select('*')
            .eq('id', listId)
            .single()
        if (error) throw error
        return data
    },

    async getByApiKey(apiKey) {
        // Assuming table has api_key column logic. Schema migration added it?
        // If not, we assumed migration handled schema.
        // `api_key` and `api_enabled`
        const { data, error } = await supabase
            .from('contact_lists')
            .select('*')
            .eq('api_key', apiKey)
            .eq('api_enabled', true)
            .single()
        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data
    },

    async create(brandId, listData) {
        const { data, error } = await supabase
            .from('contact_lists')
            .insert({ ...listData, brand_id: brandId })
            .select()
            .single()
        if (error) throw error
        return data
    },

    async update(listId, updates) {
        const { data, error } = await supabase
            .from('contact_lists')
            .update(updates)
            .eq('id', listId)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async delete(listId) {
        const { error } = await supabase
            .from('contact_lists')
            .delete()
            .eq('id', listId)
        if (error) throw error
    }
}

import { supabase } from '../supabase'

export const campaignsDb = {
    async getByBrandId(brandId) {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false })
        if (error) throw error
        return data
    },

    async getById(campaignId) {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .single()
        if (error) throw error
        return data
    },

    async create(brandId, userId, campaignData) {
        const { data, error } = await supabase
            .from('campaigns')
            .insert({ ...campaignData, brand_id: brandId, user_id: userId })
            .select()
            .single()
        if (error) throw error
        return data
    },

    async update(campaignId, updates) {
        const { data, error } = await supabase
            .from('campaigns')
            .update(updates)
            .eq('id', campaignId)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async updateStats(campaignId, stats) {
        const { error } = await supabase
            .from('campaigns')
            .update(stats)
            .eq('id', campaignId)
        if (error) throw error
    }
}

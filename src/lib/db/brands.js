import { supabase } from '../supabase'

export const brandsDb = {
    async getByUserId(userId) {
        const { data, error } = await supabase
            .from('brands')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
        if (error) throw error
        return data
    },

    async getById(brandId) {
        const { data, error } = await supabase
            .from('brands')
            .select('*')
            .eq('id', brandId)
            .single()
        if (error) throw error
        return data
    },

    async create(userId, brandData) {
        const { data, error } = await supabase
            .from('brands')
            .insert({ ...brandData, user_id: userId })
            .select()
            .single()
        if (error) throw error
        return data
    },

    async update(brandId, updates) {
        const { data, error } = await supabase
            .from('brands')
            .update(updates)
            .eq('id', brandId)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async delete(brandId) {
        const { error } = await supabase.from('brands').delete().eq('id', brandId)
        if (error) throw error
    }
}

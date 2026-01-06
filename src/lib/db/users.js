import { supabase } from '../supabase'

export const usersDb = {
    async getById(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
        if (error) {
            // Profile might not exist yet if not created on trigger
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data
    },

    async getByEmail(email) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email)
            .single()
        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data
    },

    async update(userId, updates) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async create(userData) {
        // userData should include id (uuid from auth)
        const { data, error } = await supabase
            .from('profiles')
            .insert(userData)
            .select()
            .single()
        if (error) throw error
        return data
    }
}

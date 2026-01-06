import { supabase } from '../supabase'

export const teamMembersDb = {
    async create(data) {
        const { data: member, error } = await supabase
            .from('team_members')
            .insert(data)
            .select()
            .single()
        if (error) throw error
        return member
    },

    async getByBrandId(brandId) {
        const { data, error } = await supabase
            .from('team_members')
            .select(`
                *,
                user:user_id ( id, email, raw_user_meta_data ),
                invited_by:invited_by ( id, email, raw_user_meta_data )
            `)
            .eq('brand_id', brandId)
            .neq('status', 'revoked')
            .order('created_at', { ascending: false })
        if (error) throw error
        return data.map(m => ({
            ...m,
            // Map joined user data to simpler structure if needed
            user: m.user ? { id: m.user.id, email: m.user.email, name: m.user.raw_user_meta_data?.name } : null,
            invitedBy: m.invited_by ? { id: m.invited_by.id, email: m.invited_by.email, name: m.invited_by.raw_user_meta_data?.name } : null
        }))
    },

    async getById(id) {
        const { data, error } = await supabase
            .from('team_members')
            .select('*')
            .eq('id', id)
            .single()
        if (error) throw error
        return data
    },

    async getByToken(token) {
        const { data, error } = await supabase
            .from('team_members')
            .select(`
                *,
                brand:brand_id ( id, name )
            `)
            .eq('invite_token', token)
            .gt('invite_token_expires', new Date().toISOString())
            .eq('status', 'pending')
            .single()

        // Supabase returns error if no rows found in .single(), unlike findOne
        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }
        return data
    },

    async update(id, updates) {
        const { data, error } = await supabase
            .from('team_members')
            .update(updates)
            .eq('id', id)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async delete(id) {
        const { error } = await supabase
            .from('team_members')
            .delete()
            .eq('id', id)
        if (error) throw error
    },

    async checkAccess(brandId, userId) {
        const { data, error } = await supabase
            .from('team_members')
            .select('*')
            .eq('brand_id', brandId)
            .eq('user_id', userId)
            .eq('status', 'active')
            .single()

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data
    },

    async getBrandsForUser(userId) {
        const { data, error } = await supabase
            .from('team_members')
            .select(`
                *,
                brand:brand_id (*)
            `)
            .eq('user_id', userId)
            .eq('status', 'active')

        if (error) throw error
        return data
    }
}

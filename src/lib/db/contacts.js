import { supabase } from '../supabase'

export const contactsDb = {
    async getByBrandId(brandId, { limit = 50, offset = 0, search = '' } = {}) {
        let query = supabase
            .from('contacts')
            .select('*', { count: 'exact' })
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (search) {
            query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
        }

        const { data, error, count } = await query
        if (error) throw error
        return { data, total: count }
    },

    async getById(contactId) {
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', contactId)
            .single()
        if (error) throw error
        return data
    },

    async create(brandId, userId, contactData) {
        const { data, error } = await supabase
            .from('contacts')
            .insert({ ...contactData, brand_id: brandId, user_id: userId })
            .select()
            .single()
        if (error) throw error
        return data
    },

    async update(contactId, updates) {
        const { data, error } = await supabase
            .from('contacts')
            .update(updates)
            .eq('id', contactId)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async delete(contactId) {
        const { error } = await supabase.from('contacts').delete().eq('id', contactId)
        if (error) throw error
    },

    async addToList(contactId, listId) {
        const { error } = await supabase
            .from('contact_list_memberships')
            .insert({ contact_id: contactId, contact_list_id: listId })
        if (error) throw error
    }
}

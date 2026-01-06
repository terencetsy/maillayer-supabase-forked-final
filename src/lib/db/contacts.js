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
    },

    async bulkUpsert(contacts) {
        const { data, error } = await supabase
            .from('contacts')
            .upsert(contacts, { onConflict: 'brand_id, email', ignoreDuplicates: false })
            .select()
        if (error) throw error
        return data
    },

    async bulkAddToList(contactIds, listId) {
        const memberships = contactIds.map(id => ({
            contact_id: id,
            contact_list_id: listId
        }))
        const { error } = await supabase
            .from('contact_list_memberships')
            .upsert(memberships, { ignoreDuplicates: true })
        if (error) throw error
    },

    async getByListId(listId, { limit = 50, offset = 0, search = '' } = {}) {
        let query = supabase
            .from('contacts')
            .select('*, contact_list_memberships!inner(*)', { count: 'exact' })
            .eq('contact_list_memberships.contact_list_id', listId)
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false })

        if (search) {
            query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
        }

        const { data, error, count } = await query
        if (error) throw error
        return { data, total: count }
    },

    async countByListId(listId) {
        const { count, error } = await supabase
            .from('contact_list_memberships')
            .select('contact_id', { count: 'exact', head: true })
            .eq('contact_list_id', listId)
        if (error) throw error
        return count
    },

    async removeFromList(listId, contactIds) {
        const { error } = await supabase
            .from('contact_list_memberships')
            .delete()
            .eq('contact_list_id', listId)
            .in('contact_id', contactIds)
        if (error) throw error
    }
}

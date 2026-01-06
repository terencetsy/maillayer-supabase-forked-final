import { supabase } from '../supabase'

export const sequencesDb = {
    async getByBrandId(brandId) {
        const { data, error } = await supabase
            .from('email_sequences')
            .select(`
        *,
        sequence_steps (*)
      `)
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false })
        if (error) throw error
        return data
    },

    async getById(sequenceId) {
        const { data, error } = await supabase
            .from('email_sequences')
            .select(`
        *,
        sequence_steps (*)
      `)
            .eq('id', sequenceId)
            .single()
        if (error) throw error
        return data
    },

    async create(brandId, userId, sequenceData) {
        const { data, error } = await supabase
            .from('email_sequences')
            .insert({ ...sequenceData, brand_id: brandId, user_id: userId })
            .select()
            .single()
        if (error) throw error
        return data
    },

    async createStep(sequenceId, stepData) {
        const { data, error } = await supabase
            .from('sequence_steps')
            .insert({ ...stepData, sequence_id: sequenceId })
            .select()
            .single()
        if (error) throw error
        return data
    },

    async enrollContact(sequenceId, contactId) {
        const { data, error } = await supabase
            .from('sequence_enrollments')
            .insert({ sequence_id: sequenceId, contact_id: contactId, status: 'active' })
            .select()
            .single()
        if (error) throw error
        return data
    }
}

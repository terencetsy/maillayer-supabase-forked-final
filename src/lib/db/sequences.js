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

    async delete(sequenceId) {
        const { error } = await supabase.from('email_sequences').delete().eq('id', sequenceId)
        if (error) throw error
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
    },

    async update(sequenceId, updates) {
        const { data, error } = await supabase
            .from('email_sequences')
            .update(updates)
            .eq('id', sequenceId)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async updateStep(stepId, updates) {
        const { data, error } = await supabase
            .from('sequence_steps')
            .update(updates)
            .eq('id', stepId)
            .select()
            .single()
        if (error) throw error
        return data
    },

    async deleteStep(stepId) {
        const { error } = await supabase
            .from('sequence_steps')
            .delete()
            .eq('id', stepId)
        if (error) throw error
    },

    async getSteps(sequenceId) {
        const { data, error } = await supabase
            .from('sequence_steps')
            .select('*')
            .eq('sequence_id', sequenceId)
            .order('order_index', { ascending: true })
        if (error) throw error
        return data
    },

    async delete(sequenceId) {
        const { error } = await supabase
            .from('email_sequences')
            .delete()
            .eq('id', sequenceId)
        if (error) throw error
    }
}

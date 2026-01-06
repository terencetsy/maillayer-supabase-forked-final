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

    async updateTagsByEmail(email, brandId, tags, action) {
        // Find contact first
        const { data: contact, error: fetchError } = await supabase
            .from('contacts')
            .select('id, tags')
            .eq('email', email)
            .eq('brand_id', brandId)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') return null; // Not found
            throw fetchError;
        }

        let currentTags = new Set(contact.tags || []);
        const processingTags = tags.map(t => t.toLowerCase().trim());

        if (action === 'set') {
            currentTags = new Set(processingTags);
        } else if (action === 'add') {
            processingTags.forEach(t => currentTags.add(t));
        } else if (action === 'remove') {
            processingTags.forEach(t => currentTags.delete(t));
        }

        const newTags = Array.from(currentTags);

        const { data, error } = await supabase
            .from('contacts')
            .update({ tags: newTags, updated_at: new Date() })
            .eq('id', contact.id)
            .select()
            .single();

        if (error) throw error;
        return data; // Returns updated contact
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

    async bulkUpsert(contacts, { ignoreDuplicates = false } = {}) {
        const { data, error } = await supabase
            .from('contacts')
            .upsert(contacts, { onConflict: 'brand_id, email', ignoreDuplicates })
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

    async getByListId(listId, { limit = 50, offset = 0, search = '', status = '', sort = { field: 'created_at', order: 'desc' } } = {}) {
        let query = supabase
            .from('contacts')
            .select('*, contact_list_memberships!inner(*)', { count: 'exact' })
            .eq('contact_list_memberships.contact_list_id', listId)

        if (status && status !== 'all') {
            query = query.eq('status', status)
        }

        if (search) {
            query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
        }

        const sortField = sort.field === 'firstName' ? 'first_name' :
            sort.field === 'lastName' ? 'last_name' :
                sort.field || 'created_at';

        query = query.order(sortField, { ascending: sort.order === 'asc' })
            .range(offset, offset + limit - 1)

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

    async getCountsByListIds(listIds, brandId) {
        const counts = {};
        await Promise.all(listIds.map(async (listId) => {
            const { count } = await supabase
                .from('contact_list_memberships')
                .select('contacts!inner(status)', { count: 'exact', head: true })
                .eq('contact_list_id', listId)
                .eq('contacts.brand_id', brandId)
                .eq('contacts.status', 'active')

            counts[listId] = count || 0;
        }));

        return counts;
    },

    async bulkInsert(contacts) {
        const { data, error } = await supabase
            .from('contacts')
            .insert(contacts)
            .select()
        if (error) throw error
        return data
    },

    async getStatusCounts(listId) {
        const statuses = ['active', 'unsubscribed', 'bounced', 'complained']
        const counts = { active: 0, unsubscribed: 0, bounced: 0, complained: 0 }

        await Promise.all(statuses.map(async (status) => {
            const { count } = await supabase
                .from('contact_list_memberships')
                .select('contacts!inner(status)', { count: 'exact', head: true })
                .eq('contact_list_id', listId)
                .eq('contacts.status', status)

            counts[status] = count || 0
        }))

        return counts
    },

    async bulkUpdateStatus(contactIds, brandId, updateData) {
        const { data, error } = await supabase
            .from('contacts')
            .update(updateData)
            .in('id', contactIds)
            .eq('brand_id', brandId)
            .select()
        if (error) throw error
        return { modifiedCount: data.length, matchedCount: contactIds.length }
    },

    async getBrandTags(brandId) {
        const { data, error } = await supabase
            .from('contacts')
            .select('tags')
            .eq('brand_id', brandId)

        if (error) throw error

        const tagCounts = {};
        data.forEach(row => {
            if (row.tags && Array.isArray(row.tags)) {
                row.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });

        return Object.entries(tagCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    },

    async updateTags(contactIds, brandId, tags, action) {
        const { data: contacts, error } = await supabase
            .from('contacts')
            .select('id, tags')
            .in('id', contactIds)
            .eq('brand_id', brandId)

        if (error) throw error

        let modifiedCount = 0;

        const updates = contacts.map(contact => {
            let currentTags = new Set(contact.tags || []);
            const processingTags = tags.map(t => t.toLowerCase().trim()); // Normalize

            if (action === 'set') {
                currentTags = new Set(processingTags);
            } else if (action === 'add') {
                processingTags.forEach(t => currentTags.add(t));
            } else if (action === 'remove') {
                processingTags.forEach(t => currentTags.delete(t));
            }

            return {
                id: contact.id,
                tags: Array.from(currentTags)
            };
        });

        await Promise.all(updates.map(async (u) => {
            const { error } = await supabase
                .from('contacts')
                .update({ tags: u.tags, updated_at: new Date() })
                .eq('id', u.id)
            if (!error) modifiedCount++;
        }));

        return modifiedCount;
    },

    async removeFromList(listId, contactIds) {
        const { error } = await supabase
            .from('contact_list_memberships')
            .delete()
            .eq('contact_list_id', listId)
            .in('contact_id', contactIds)
        if (error) throw error
    },

    async getEmailsByListIds(listIds, brandId) {
        if (!listIds || listIds.length === 0) return [];

        const { data, error } = await supabase
            .from('contact_list_memberships')
            .select('contacts!inner(email)')
            .in('contact_list_id', listIds)
            .eq('contacts.brand_id', brandId)
            .eq('contacts.status', 'active');

        if (error) throw error;
        return data.map(row => row.contacts.email);
    },

    async getCustomFieldsStats(brandId) {
        const { data, error } = await supabase
            .from('contacts')
            .select('custom_fields')
            .eq('brand_id', brandId)
            .not('custom_fields', 'is', null)
            .order('created_at', { ascending: false })
            .limit(500);

        if (error) throw error;

        const fieldStats = {};

        data.forEach(contact => {
            const fields = contact.custom_fields || {};
            Object.entries(fields).forEach(([key, value]) => {
                if (value === null || value === '') return;

                if (!fieldStats[key]) {
                    fieldStats[key] = { name: key, sampleValues: [], count: 0 };
                }

                fieldStats[key].count++;
                if (fieldStats[key].sampleValues.length < 50) {
                    fieldStats[key].sampleValues.push(value);
                }
            });
        });

        return Object.values(fieldStats).map(stat => {
            const sampleValues = stat.sampleValues;
            let type = 'text';
            let values = [];

            if (sampleValues.length > 0) {
                if (sampleValues.every(v => v === true || v === false || v === 'true' || v === 'false')) {
                    type = 'boolean';
                }
                else if (sampleValues.every(v => typeof v === 'number' || (!isNaN(parseFloat(v)) && isFinite(v)))) {
                    type = 'number';
                }
                else if (sampleValues.every(v => !isNaN(Date.parse(v)) && typeof v === 'string' && v.match(/^\d{4}-\d{2}-\d{2}/))) {
                    type = 'date';
                }
                else {
                    const uniqueValues = [...new Set(sampleValues.filter(v => typeof v === 'string'))];
                    if (uniqueValues.length <= 20 && uniqueValues.length < sampleValues.length * 0.5) {
                        type = 'select';
                        values = uniqueValues.sort();
                    }
                }
            }

            return {
                name: stat.name,
                type,
                values,
                count: stat.count
            };
        }).sort((a, b) => b.count - a.count).slice(0, 50);
    }
}

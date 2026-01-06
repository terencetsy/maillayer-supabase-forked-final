import { usersDb } from '@/lib/db/users';
import { supabaseAdmin } from '@/lib/supabase';

// Uses usersDb (profiles) and Supabase Auth Admin where necessary.

export async function findUserByEmail(email) {
    return await usersDb.getByEmail(email);
}

export async function createUser({ name, email, password, role = 'user' }) {
    // Check if ANY user exists (to set admin) - using direct count for efficiency
    const { count } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true });

    let assignedRole = role;
    if (count === 0) {
        assignedRole = 'admin';
    }

    // Create in Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
    });

    if (error) throw error;

    // Create profile
    if (data.user) {
        await usersDb.create({
            id: data.user.id,
            email,
            name,
            role: assignedRole
        });
    }

    return data.user.id;
}

export async function updateUserProfile(userId, data) {
    const updated = await usersDb.update(userId, data);
    return !!updated;
}

export async function getUserProfile(userId) {
    return await usersDb.getById(userId);
}

export async function getAllUsers() {
    // Not in usersDb, assume direct query or add to db helper
    // Adding direct query here is fine or extend db helper.
    // Extending db helper is cleaner but for now consistent with previous refactor.
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*');

    if (error) throw error;
    return data;
}

export async function hasAdminUser() {
    const { count } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');

    return count > 0;
}

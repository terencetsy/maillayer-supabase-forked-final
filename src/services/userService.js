import { supabase, supabaseAdmin } from '@/lib/supabase';

// Helper to get user via Admin API (bypass RLS for service usage if needed) or just Client
// Using Admin for findUserByEmail to look up any user.

export async function findUserByEmail(email) {
    // Supabase Auth Admin can list users.
    // OR we query 'profiles' table if it syncs all users.
    // 'profiles' is safer/cleaner query.

    // Check profiles first
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

    if (profile) return profile;

    // If not in profiles, check Auth (fallback) - expensive
    // But we generally rely on profiles.
    return null;
}

export async function createUser({ name, email, password, role = 'user' }) {
    // Only used for Admin creation or seed? 
    // Regular signup goes through client auth.
    // If used by backend script:

    // 1. Check if ANY user exists (to set admin)
    // We can check profiles count.

    let assignedRole = role;
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

    if (count === 0) {
        assignedRole = 'admin';
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
    });

    if (error) throw error;

    // Profile SHOULD be created by Trigger.
    // But if we want to ensure or set role immediately:
    if (data.user) {
        await supabaseAdmin.from('profiles').upsert({
            id: data.user.id,
            email,
            name,
            role: assignedRole
        });
    }

    return data.user.id;
}

export async function updateUserProfile(userId, data) {
    const { error } = await supabaseAdmin
        .from('profiles')
        .update(data)
        .eq('id', userId);

    return !error;
}

export async function getUserProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) return null;
    return data;
}

export async function getAllUsers() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*');

    if (error) throw error;
    return data;
}

export async function hasAdminUser() {
    const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');

    return count > 0;
}

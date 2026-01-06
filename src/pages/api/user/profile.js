import { getUserFromRequest, supabaseAdmin } from '@/lib/supabase';

export default async function handler(req, res) {
    try {
        // Authenticate using Supabase logic
        const { user, error: authError } = await getUserFromRequest(req);

        if (authError || !user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;

        if (req.method === 'GET') {
            try {
                // Get user metadata/profile
                // If we have a public 'users' table, query it.
                // Or just return user from auth (user object contains user_metadata)

                // Assuming we might have extra data in a public table or we want to return standard profile
                // For now, return what we have from Auth + metadata

                // If we need to fetch from a public 'users' table:
                /*
                const { data: profile, error } = await supabaseAdmin
                     .from('users')
                     .select('*')
                     .eq('id', userId)
                     .single();
                */

                // Since we migrated, it's safer to rely on Auth User object for name/email
                // and potentially a 'profiles' or 'users' table if it exists.
                // But the Mongoose code returned `name` and `email`.

                const responseData = {
                    id: user.id,
                    email: user.email,
                    name: user.user_metadata?.name || '',
                    role: user.user_metadata?.role || 'user', // Default role
                    createdAt: user.created_at,
                    // validUntil, etc if applicable
                };

                return res.status(200).json(responseData);
            } catch (error) {
                console.error('Get profile error:', error);
                return res.status(500).json({ message: 'Error retrieving user profile' });
            }
        }

        if (req.method === 'PUT') {
            try {
                const { name, email } = req.body;

                if (!name || !email) {
                    return res.status(400).json({ message: 'Missing required fields' });
                }

                // Update Supabase Auth User
                // Note: updating email sends confirmation email by default in Supabase.
                const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                    userId,
                    {
                        email: email,
                        user_metadata: { name: name }
                    }
                );

                if (updateError) {
                    throw updateError;
                }

                // If we have a public users table, update it too
                // await supabaseAdmin.from('users').update({ name, email }).eq('id', userId);

                const u = updatedUser.user;
                return res.status(200).json({
                    id: u.id,
                    email: u.email,
                    name: u.user_metadata?.name,
                    updatedAt: new Date() // approximate
                });
            } catch (error) {
                console.error('Update profile error:', error);
                return res.status(500).json({ message: 'Error updating user profile', error: error.message });
            }
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // This endpoint is deprecated as Supabase handles password updates via client-side Auth SDK
    // or via the recovery link flow which redirects to the frontend.
    // The frontend should handle the 'recovery' event and prompt for a new password,
    // then call supabase.auth.updateUser({ password: newPassword }).

    return res.status(410).json({
        message: 'This endpoint is deprecated. Please use the Supabase client-side password update flow.'
    });
}

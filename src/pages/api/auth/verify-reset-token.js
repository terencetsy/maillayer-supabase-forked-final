export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // This endpoint is deprecated as Supabase handles password resets via client-side Auth Helpers.
    // The user should click the link from Supabase which redirects to the reset-password page handling hash fragment.
    return res.status(410).json({
        message: 'This link is no longer valid. Please request a new password reset.'
    });
}

import { supabaseAdmin } from '@/lib/supabase';
import config from '@/lib/config';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Generate password reset link using Supabase Admin
        // This generates a link like: https://your-project.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=...
        // We can specify a redirect URL to our frontend's reset password page.
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email,
            options: {
                redirectTo: `${config.baseUrl}/reset-password`,
            },
        });

        // We don't want to reveal if a user exists or not for security reasons
        // Supabase returns an error if user not found, but we should mask it or handle it.
        // Actually Supabase 'generateLink' might error if user doesn't exist.

        if (error) {
            // Log error internally
            console.warn('Supabase generateLink warning:', error);
            // Return success message to avoid user enumeration
            return res.status(200).json({
                message: 'If your email exists in our system, you will receive password reset instructions shortly.',
            });
        }

        const { action_link } = data.properties;

        // Call your custom email API with the Supabase action link
        // Replacing the previous 'resetUrl' with 'action_link'
        const emailResponse = await fetch(`https://api.maillayer.com/v1/transactional/76YyfHiWVBUwG4qR`, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer gdqtrk093a0143drb7is5rdcy2xw7552',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                dataVariables: {
                    resetUrl: action_link, // Pass the Supabase recovery link
                },
            }),
        });

        if (!emailResponse.ok) {
            throw new Error('Failed to send password reset email');
        }

        return res.status(200).json({
            message: 'If your email exists in our system, you will receive password reset instructions shortly.',
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

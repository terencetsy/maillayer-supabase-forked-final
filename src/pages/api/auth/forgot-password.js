import crypto from 'crypto';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
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

        // Connect to database
        await connectToDatabase();

        // Find the user
        const user = await User.findOne({ email });

        // We don't want to reveal if a user exists or not for security reasons
        // So we'll always return a success message whether the user exists or not
        if (!user) {
            return res.status(200).json({
                message: 'If your email exists in our system, you will receive password reset instructions shortly.',
            });
        }

        // Generate a reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

        // Update user with reset token
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetTokenExpiry;
        await user.save();

        // Create reset URL
        const resetUrl = `${config.baseUrl}/reset-password?token=${resetToken}`;

        // Call your custom email API
        const emailResponse = await fetch(`https://api.maillayer.com/v1/transactional/76YyfHiWVBUwG4qR`, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer gdqtrk093a0143drb7is5rdcy2xw7552',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: user.email,
                dataVariables: {
                    resetUrl,
                },
            }),
        });

        if (!emailResponse.ok) {
            // If email sending fails, remove the token
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();

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

import { getTeamMemberByToken, acceptInvitation, acceptInvitationNewUser } from '@/services/teamMemberService';
import { findUserByEmail } from '@/services/userService';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { token, name, password } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'Token is required' });
        }

        // Verify token first
        const invitation = await getTeamMemberByToken(token);

        if (!invitation) {
            return res.status(400).json({
                message: 'Invalid or expired invitation link',
            });
        }

        // Check if user exists
        const existingUser = await findUserByEmail(invitation.email);

        if (existingUser) {
            // Existing user - just link the account
            // Pass user ID (Supabase ID)
            const success = await acceptInvitation(token, existingUser.id);

            if (success) {
                return res.status(200).json({
                    message: 'Invitation accepted successfully',
                    redirectTo: '/login',
                });
            }
            return res.status(500).json({ message: 'Failed to accept invitation' });
        }

        // New user - need name and password
        if (!name || !password) {
            return res.status(400).json({
                message: 'Name and password are required for new users',
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters',
            });
        }

        const result = await acceptInvitationNewUser(token, { name, password });

        if (result) {
            return res.status(201).json({
                message: 'Account created and invitation accepted',
                redirectTo: '/login',
            });
        }

        return res.status(500).json({ message: 'Failed to accept invitation' });
    } catch (error) {
        console.error('Accept invite error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

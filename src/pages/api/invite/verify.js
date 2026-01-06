import { getTeamMemberByToken } from '@/services/teamMemberService';
import { findUserByEmail } from '@/services/userService';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ message: 'Token is required' });
        }

        const invitation = await getTeamMemberByToken(token);

        if (!invitation) {
            return res.status(400).json({
                message: 'Invalid or expired invitation link',
            });
        }

        // Check if user already exists
        const existingUser = await findUserByEmail(invitation.email);

        // Populate brandName from invitation.brand (Supabase join returns object)
        const brandName = invitation.brand ? invitation.brand.name : 'Unknown Brand';

        return res.status(200).json({
            email: invitation.email,
            brandName: brandName,
            role: invitation.role,
            userExists: !!existingUser,
        });
    } catch (error) {
        console.error('Verify invite error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

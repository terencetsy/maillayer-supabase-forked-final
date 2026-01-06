import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { createTeamMemberInvite, getTeamMembersByBrandId } from '@/services/teamMemberService';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';
import config from '@/lib/config';

export default async function handler(req, res) {
    try {
        const { user } = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId } = req.query;

        // Get brand and verify ownership (or use checkBrandPermission with MANAGE_TEAM permission)
        // Original code enforced: brand.userId === userId.
        // We can use checkBrandPermission if we have a MANAGE_TEAM role, usually Admin/Owner.
        // Let's stick to brand ownership or 'admin' check. 
        // getBrandById returns snake_case or camel? service returns it.

        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // Only owner can manage team strictly? Or admins?
        // Original: `brand.userId.toString() !== userId`
        // Supabase `brand.user_id` or `brand.userId`. 
        // service `getBrandById` uses `brandsDb` which returns `user_id`.
        // But `brandService` might not map it? 
        // I viewed `brandService.js` in step 955. It returns result of `brandsDb.getById`.
        // `brandsDb.getById` returns raw row -> `user_id`.
        // So we must use `user_id`.

        const isOwner = (brand.user_id || brand.userId) === userId;
        if (!isOwner) {
            // Also allow if user is a team member with high privilege? 
            // Original code was strict: `brand.userId.toString() !== userId`
            return res.status(403).json({ message: 'Only brand owner can manage team' });
        }

        // GET - List team members
        if (req.method === 'GET') {
            const teamMembers = await getTeamMembersByBrandId(brandId);
            return res.status(200).json(teamMembers);
        }

        // POST - Create invitation
        if (req.method === 'POST') {
            const { email, role } = req.body;

            if (!email || !role) {
                return res.status(400).json({ message: 'Email and role are required' });
            }

            if (!['editor', 'viewer'].includes(role)) {
                return res.status(400).json({ message: 'Invalid role' });
            }

            // Check if email is brand owner
            if (email.toLowerCase() === user.email.toLowerCase()) {
                return res.status(400).json({ message: 'Cannot invite yourself' });
            }

            try {
                const { teamMember, inviteToken } = await createTeamMemberInvite({
                    brandId,
                    email,
                    role,
                    invitedBy: userId,
                });

                // Generate invite URL
                const inviteUrl = `${config.baseUrl}/invite/${inviteToken}`;

                return res.status(201).json({
                    teamMember: {
                        id: teamMember.id,
                        email: teamMember.email,
                        role: teamMember.role,
                        status: teamMember.status,
                        invitedAt: teamMember.created_at, // or invited_at
                    },
                    inviteUrl,
                });
            } catch (error) {
                if (error.message && error.message.includes('already')) {
                    return res.status(400).json({
                        message: error.message,
                    });
                }
                // Supabase constraint?
                if (error.code === '23505') { // Unique violation
                    return res.status(400).json({
                        message: 'This email has already been invited to this brand',
                    });
                }
                throw error;
            }
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Team API error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

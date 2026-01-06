import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { getTeamMemberById, updateTeamMemberRole, revokeTeamMember } from '@/services/teamMemberService';

export default async function handler(req, res) {
    try {
        const { user } = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId, memberId } = req.query;

        // Get brand and verify ownership
        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        const isOwner = (brand.user_id || brand.userId) === userId;
        if (!isOwner) {
            return res.status(403).json({ message: 'Only brand owner can manage team' });
        }

        // Verify team member belongs to this brand
        const teamMember = await getTeamMemberById(memberId);
        // Supabase returns snake_case `brand_id`.
        if (!teamMember || (teamMember.brand_id || teamMember.brandId) !== brandId) {
            return res.status(404).json({ message: 'Team member not found' });
        }

        // PUT - Update role
        if (req.method === 'PUT') {
            const { role } = req.body;

            if (!['editor', 'viewer'].includes(role)) {
                return res.status(400).json({ message: 'Invalid role' });
            }

            const success = await updateTeamMemberRole(memberId, role);

            if (success) {
                return res.status(200).json({ message: 'Role updated successfully' });
            }
            return res.status(500).json({ message: 'Failed to update role' });
        }

        // DELETE - Remove team member
        if (req.method === 'DELETE') {
            const success = await revokeTeamMember(memberId);

            if (success) {
                return res.status(200).json({ message: 'Team member removed' });
            }
            return res.status(500).json({ message: 'Failed to remove team member' });
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Team member API error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

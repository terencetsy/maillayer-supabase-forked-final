import { teamMembersDb } from '@/lib/db/teamMembers';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

// Create a new team member invitation
export async function createTeamMemberInvite({ brandId, email, role, invitedBy }) {
    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    // 7 days expiration
    const inviteTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const teamMember = await teamMembersDb.create({
        brand_id: brandId,
        email,
        role,
        invited_by: invitedBy,
        invite_token: inviteToken,
        invite_token_expires: inviteTokenExpires,
        status: 'pending',
    });

    return { teamMember, inviteToken }; // Return simple object
}

// Get all team members for a brand
export async function getTeamMembersByBrandId(brandId) {
    return await teamMembersDb.getByBrandId(brandId);
}

// Get team member by ID
export async function getTeamMemberById(teamMemberId) {
    return await teamMembersDb.getById(teamMemberId);
}

// Get team member by invite token
export async function getTeamMemberByToken(inviteToken) {
    return await teamMembersDb.getByToken(inviteToken);
}

// Accept invitation (existing user)
export async function acceptInvitation(inviteToken, userId) {
    // 1. Get invitation to confirm
    const invitation = await getTeamMemberByToken(inviteToken);
    if (!invitation) return false;

    // 2. Update
    const updated = await teamMembersDb.update(invitation.id, {
        user_id: userId,
        status: 'active',
        accepted_at: new Date().toISOString(),
        invite_token: null,
        invite_token_expires: null
    });

    return !!updated;
}

// Accept invitation (new user - creates user account)
export async function acceptInvitationNewUser(inviteToken, { name, password }) {
    // 1. Get invitation
    const invitation = await getTeamMemberByToken(inviteToken);
    if (!invitation) return null;

    // 2. Create User in Supabase Auth
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: invitation.email,
        password: password,
        user_metadata: { name },
        email_confirm: true // Auto confirm since they came from invite link? Or require confirm? 
        // Typically invite implies verified email if sent there.
    });

    if (userError || !userData.user) {
        console.error('Error creating user for invitation:', userError);
        return null;
    }

    const userId = userData.user.id;

    // 3. Create Profile (if not handled by valid trigger)
    // Assuming we do it manually to be safe or update role
    await supabaseAdmin.from('profiles').insert({
        id: userId,
        name: name,
        role: 'user', // Default role in system, unrelated to team role
        email: invitation.email
    });

    // 4. Update Invitation
    await teamMembersDb.update(invitation.id, {
        user_id: userId,
        status: 'active',
        accepted_at: new Date().toISOString(),
        invite_token: null,
        invite_token_expires: null
    });

    return { user: userData.user, invitation };
}

// Update team member role
export async function updateTeamMemberRole(teamMemberId, role) {
    const updated = await teamMembersDb.update(teamMemberId, { role });
    return !!updated;
}

// Remove team member (revoke access)
export async function revokeTeamMember(teamMemberId) {
    const updated = await teamMembersDb.update(teamMemberId, { status: 'revoked' });
    return !!updated;
}

// Check if user has access to brand
export async function checkBrandAccess(brandId, userId) {
    return await teamMembersDb.checkAccess(brandId, userId);
}

// Get all brands a user has access to
export async function getBrandsAsTeamMember(userId) {
    const memberships = await teamMembersDb.getBrandsForUser(userId);
    // Return brands array if that's what caller expects, or memberships
    // Original service returned memberships populated with brandId.
    // teamMembersDb.getBrandsForUser returns memberships with brand object.
    return memberships;
}

// Regenerate invite token
export async function regenerateInviteToken(teamMemberId) {
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const updated = await teamMembersDb.update(teamMemberId, {
        invite_token: inviteToken,
        invite_token_expires: inviteTokenExpires,
    }); // Note: should ideally check status='pending' where constraint, but update applies by ID.

    if (updated) return inviteToken;
    return null;
}

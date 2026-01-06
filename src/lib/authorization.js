import { supabase } from '@/lib/supabase';
import { brandsDb } from '@/lib/db/brands';

// Permission definitions
export const PERMISSIONS = {
    // Viewer permissions (read-only)
    VIEW_BRAND: 'view_brand',
    VIEW_CAMPAIGNS: 'view_campaigns',
    VIEW_CONTACTS: 'view_contacts',
    VIEW_SEQUENCES: 'view_sequences',
    VIEW_TRANSACTIONAL: 'view_transactional',
    VIEW_INTEGRATIONS: 'view_integrations',
    VIEW_SETTINGS: 'view_settings',

    // Editor permissions (all above plus write)
    EDIT_CAMPAIGNS: 'edit_campaigns',
    EDIT_CONTACTS: 'edit_contacts',
    EDIT_SEQUENCES: 'edit_sequences',
    EDIT_TRANSACTIONAL: 'edit_transactional',
    EDIT_INTEGRATIONS: 'edit_integrations',
    EDIT_SETTINGS: 'edit_settings',

    // Owner-only permissions
    MANAGE_TEAM: 'manage_team',
    DELETE_BRAND: 'delete_brand',
};

// Role permission mapping
const ROLE_PERMISSIONS = {
    owner: Object.values(PERMISSIONS),
    editor: [
        PERMISSIONS.VIEW_BRAND,
        PERMISSIONS.VIEW_CAMPAIGNS,
        PERMISSIONS.VIEW_CONTACTS,
        PERMISSIONS.VIEW_SEQUENCES,
        PERMISSIONS.VIEW_TRANSACTIONAL,
        PERMISSIONS.VIEW_INTEGRATIONS,
        PERMISSIONS.VIEW_SETTINGS,
        PERMISSIONS.EDIT_CAMPAIGNS,
        PERMISSIONS.EDIT_CONTACTS,
        PERMISSIONS.EDIT_SEQUENCES,
        PERMISSIONS.EDIT_TRANSACTIONAL,
        PERMISSIONS.EDIT_INTEGRATIONS,
        PERMISSIONS.EDIT_SETTINGS,
    ],
    viewer: [
        PERMISSIONS.VIEW_BRAND,
        PERMISSIONS.VIEW_CAMPAIGNS,
        PERMISSIONS.VIEW_CONTACTS,
        PERMISSIONS.VIEW_SEQUENCES,
        PERMISSIONS.VIEW_TRANSACTIONAL,
        PERMISSIONS.VIEW_INTEGRATIONS,
        PERMISSIONS.VIEW_SETTINGS,
    ],
};

/**
 * Check if a user has access to a brand and return their role/permissions
 */
export async function getBrandAccessInfo(brandId, userId) {
    try {
        const brand = await brandsDb.getById(brandId);

        if (!brand) {
            return null;
        }

        // Check if owner
        // Ensure standard string comparison for UUIDs
        if (brand.user_id === userId) {
            return {
                role: 'owner',
                permissions: ROLE_PERMISSIONS.owner,
                brand,
            };
        }

        // Check if team member
        const { data: teamMember, error } = await supabase
            .from('team_members')
            .select('*')
            .eq('brand_id', brandId)
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "Relation not found" or "No rows found"
            // console.warn('Team member check error', error);
        }

        if (teamMember) {
            return {
                role: teamMember.role,
                permissions: ROLE_PERMISSIONS[teamMember.role] || [],
                brand,
                teamMemberId: teamMember.id,
            };
        }

        return null;
    } catch (error) {
        console.error('getBrandAccessInfo error:', error);
        return null;
    }
}

/**
 * Check if user has specific permission on a brand
 */
export async function hasPermission(brandId, userId, permission) {
    const accessInfo = await getBrandAccessInfo(brandId, userId);

    if (!accessInfo) {
        return false;
    }

    return accessInfo.permissions.includes(permission);
}

/**
 * Middleware-style function for API routes
 */
export async function checkBrandPermission(brandId, userId, requiredPermission) {
    const accessInfo = await getBrandAccessInfo(brandId, userId);

    if (!accessInfo) {
        return {
            authorized: false,
            status: 403,
            message: 'Not authorized to access this brand',
        };
    }

    if (!accessInfo.permissions.includes(requiredPermission)) {
        return {
            authorized: false,
            status: 403,
            message: 'Insufficient permissions for this action',
        };
    }

    return {
        authorized: true,
        accessInfo,
    };
}

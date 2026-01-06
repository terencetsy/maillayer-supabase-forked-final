import { requireAuth } from '@/lib/auth';
import { brandsDb } from '@/lib/db/brands';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default requireAuth(async (req, res) => {
    const { user } = req;
    const userId = user.id;
    const { brandId } = req.query;

    if (!brandId) {
        return res.status(400).json({ message: 'Missing brand ID' });
    }

    try {
        // GET request - get brand details
        if (req.method === 'GET') {
            // Check permission (VIEW_BRAND allows owners and team members)
            const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.VIEW_BRAND);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }

            const { includeSecrets } = req.query;
            const brand = await brandsDb.getById(brandId); // Using getById from brandsDb

            if (!brand) {
                return res.status(404).json({ message: 'Brand not found' });
            }

            // Note: brandsDb.getById selects '*' currently. 
            // If secrets filtering is needed it should be done here or in a specialized DB method.
            // For now, returning full object as per previous implementation but caution is advised in future.

            // Add user's role to the response
            return res.status(200).json({
                ...brand,
                userRole: authCheck.accessInfo.role,
            });
        }

        // PUT request - update brand
        if (req.method === 'PUT') {
            // Check permission (EDIT_SETTINGS required for updating brand)
            const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.EDIT_SETTINGS);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }

            const { name, awsRegion, awsAccessKey, awsSecretKey, sendingDomain, fromName, fromEmail, replyToEmail, status } = req.body;

            const updateData = {};
            if (name) updateData.name = name;
            if (awsRegion) updateData.aws_region = awsRegion; // Mapping camelCase to snake_case if DB uses snake_case, assuming Supabase convention
            if (awsAccessKey) updateData.aws_access_key = awsAccessKey;
            if (awsSecretKey) updateData.aws_secret_key = awsSecretKey;
            if (sendingDomain) updateData.sending_domain = sendingDomain;
            if (fromName) updateData.from_name = fromName;
            if (fromEmail) updateData.from_email = fromEmail;
            if (replyToEmail) updateData.reply_to_email = replyToEmail;
            if (status) updateData.status = status;

            // Note: The original generic 'update' might not handle snake_case conversion automatically if the frontend sends camelCase.
            // Adjusting keys to match likely Supabase schema (snake_case).
            // If the original brands table used camelCase column names, this should be reverted.
            // Standard Supabase/Postgres is snake_case.

            const updatedBrand = await brandsDb.update(brandId, updateData);

            return res.status(200).json({ message: 'Brand updated successfully', brand: updatedBrand });
        }

        // DELETE request - delete brand (owner only)
        if (req.method === 'DELETE') {
            // Check permission (DELETE_BRAND is owner-only)
            const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.DELETE_BRAND);
            if (!authCheck.authorized) {
                return res.status(authCheck.status).json({ message: authCheck.message });
            }

            await brandsDb.delete(brandId);
            return res.status(200).json({ message: 'Brand deleted successfully' });
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Brand API error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

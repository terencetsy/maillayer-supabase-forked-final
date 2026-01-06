import { requireAuth } from '@/lib/auth';
import { brandsDb } from '@/lib/db/brands';

export default requireAuth(async (req, res) => {
    const { user } = req;
    const userId = user.id;

    try {
        // GET request - fetch brands
        if (req.method === 'GET') {
            const brands = await brandsDb.getByUserId(userId);

            // Transform to match expected frontend structure if needed
            // For now returning direct DB result
            // Note: Team brands logic to be added later
            const brandsWithRole = brands.map(b => ({
                ...b,
                userRole: 'owner'
            }));

            return res.status(200).json(brandsWithRole);
        }

        // POST request - create new brand
        if (req.method === 'POST') {
            const { name, website } = req.body;

            if (!name || !website) {
                return res.status(400).json({ message: 'Missing required fields' });
            }

            const brandData = {
                name,
                website,
                status: 'pending_setup'
            };

            const newBrand = await brandsDb.create(userId, brandData);
            return res.status(201).json(newBrand);
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Brands API error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

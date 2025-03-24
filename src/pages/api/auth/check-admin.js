import { hasAdminUser } from '@/services/userService';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const adminExists = await hasAdminUser();
        return res.status(200).json({ adminExists });
    } catch (error) {
        console.error('Error checking admin existence:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

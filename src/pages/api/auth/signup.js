import { authHelpers } from '@/lib/auth';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Use authHelpers to sign up
        // Note: The helper logic handles profile creation and role assignment
        const { data, error } = await authHelpers.signUp(email, password, name);

        if (error) {
            console.error('Signup error:', error);
            return res.status(400).json({ message: error.message });
        }

        return res.status(201).json({
            message: 'User created successfully',
            user: data.user
        });
    } catch (error) {
        console.error('Signup server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

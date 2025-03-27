import { hasAdminUser } from '@/services/userService';
import User from '@/models/User';
import connectToDatabase from '@/lib/mongodb';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Connect to database
        await connectToDatabase();

        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Check if admin exists already
        const adminExists = await hasAdminUser();

        if (adminExists) {
            return res.status(403).json({ message: 'Signup is disabled as admin already exists' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // Create user - let the model&apos; pre-save hook handle password hashing
        try {
            const user = new User({
                name,
                email,
                password, // The UserSchema pre-save hook will hash this
                role: 'admin', // First user is admin
            });

            await user.save();
            console.log('User created successfully:', user._id);

            return res.status(201).json({
                message: 'User created successfully',
                userId: user._id,
            });
        } catch (error) {
            console.error('Error saving user:', error);
            return res.status(500).json({ message: 'Error creating user: ' + error.message });
        }
    } catch (error) {
        console.error('Signup error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

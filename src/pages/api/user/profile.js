import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import mongoose from 'mongoose';

export default async function handler(req, res) {
    try {
        // Connect to database
        await connectToDatabase();

        // Get session directly from server
        const session = await getServerSession(req, res, authOptions);
        console.log('Server session:', session);

        if (!session || !session.user) {
            return res.status(401).json({ message: 'Unauthorized - No session' });
        }

        if (!session.user.id) {
            console.error('Session user has no ID:', session.user);
            return res.status(401).json({ message: 'Unauthorized - No user ID in session' });
        }

        const userId = session.user.id;

        if (req.method === 'GET') {
            try {
                // Find user by ID
                const user = await User.findById(userId).select('-password');

                if (!user) {
                    return res.status(404).json({ message: 'User not found' });
                }

                return res.status(200).json(user);
            } catch (error) {
                console.error('Get profile error:', error);
                return res.status(500).json({ message: 'Error retrieving user profile' });
            }
        }

        if (req.method === 'PUT') {
            try {
                const { name, email } = req.body;

                if (!name || !email) {
                    return res.status(400).json({ message: 'Missing required fields' });
                }

                // Update user
                const updatedUser = await User.findByIdAndUpdate(
                    userId,
                    {
                        name,
                        email,
                        updatedAt: new Date(),
                    },
                    { new: true }
                ).select('-password');

                if (!updatedUser) {
                    return res.status(404).json({ message: 'User not found or not updated' });
                }

                return res.status(200).json(updatedUser);
            } catch (error) {
                console.error('Update profile error:', error);
                return res.status(500).json({ message: 'Error updating user profile' });
            }
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

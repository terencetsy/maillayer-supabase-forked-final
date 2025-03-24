import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';

export async function findUserByEmail(email) {
    await connectToDatabase();
    return User.findOne({ email }).lean();
}

export async function createUser({ name, email, password, role = 'user' }) {
    await connectToDatabase();

    const userCount = await User.countDocuments();

    if (userCount === 0) {
        role = 'admin';
    }

    const user = new User({
        name,
        email,
        password,
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    await user.save();
    return user._id;
}

export async function updateUserProfile(userId, data) {
    await connectToDatabase();

    const updateData = {
        ...data,
        updatedAt: new Date(),
    };

    const result = await User.updateOne({ _id: userId }, { $set: updateData });

    return result.modifiedCount > 0;
}

export async function getUserProfile(userId) {
    await connectToDatabase();
    const user = await User.findById(userId).lean();

    if (user) {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    return null;
}

export async function getAllUsers() {
    await connectToDatabase();
    const users = await User.find({}).select('-password').lean();

    return users;
}

export async function hasAdminUser() {
    await connectToDatabase();
    const adminCount = await User.countDocuments({ role: 'admin' });
    return adminCount > 0;
}

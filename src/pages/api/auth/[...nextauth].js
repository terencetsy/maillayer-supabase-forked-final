import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import config from '@/lib/config';

// Set NEXTAUTH_URL if not already set (important for server-side operations)
if (!process.env.NEXTAUTH_URL && typeof window === 'undefined') {
    process.env.NEXTAUTH_URL = config.baseUrl;
}

export const authOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                await connectToDatabase();

                // Find user by email
                const user = await User.findOne({ email: credentials.email }).select('+password');

                // Check if user exists and password matches
                if (!user || !(await user.comparePassword(credentials.password))) {
                    throw new Error('Invalid email or password');
                }

                return {
                    id: user._id.toString(),
                    email: user.email,
                    name: user.name,
                    role: user.role,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            console.log('JWT callback called');
            if (user) {
                token.id = user.id;
                token.role = user.role;
            }
            return token;
        },
        async session({ session, token }) {
            console.log('JWT callback called, session');
            if (token) {
                session.user.id = token.id;
                session.user.role = token.role;
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
        error: '/login',
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        updateAge: 7 * 24 * 60 * 60, // 7 days
        refreshWhenOffline: false, // Don't refresh when offline
        refreshInterval: 0,
    },
    jwt: {
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    // Use the secret from our centralized config
    secret: config.nextAuthSecret,
    // Use the environment flag from our config for debug mode
    debug: config.isDevelopment,
};

export default NextAuth(authOptions);

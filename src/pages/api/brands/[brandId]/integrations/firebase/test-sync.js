// src/pages/api/brands/[id]/integrations/firebase/test-sync.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getIntegrationByType } from '@/services/integrationService';
import { admin } from '@/lib/firebase-admin';

export default async function handler(req, res) {
    // Check if method is POST
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Authenticate the user
        const session = await getServerSession(req, res, authOptions);
        if (!session) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { brandId } = req.query;
        const { integrationId } = req.body;

        // Validate the request
        if (!brandId) {
            return res.status(400).json({ message: 'Brand ID is required' });
        }

        // Get the integration
        const integration = await getIntegrationByType('firebase', brandId, session.user.id);

        if (!integration) {
            return res.status(404).json({ message: 'Firebase integration not found' });
        }

        // Initialize Firebase Admin SDK with the service account
        const serviceAccount = integration.config.serviceAccount;
        if (!serviceAccount) {
            return res.status(400).json({ message: 'Firebase service account configuration is missing' });
        }

        // If Firebase app is already initialized, use the existing one
        let firebaseApp;
        let auth;

        try {
            // Try to get the existing app
            firebaseApp = admin.app(`brand-${brandId}`);
            auth = admin.auth(firebaseApp);
        } catch (error) {
            // App doesn't exist, initialize it
            try {
                firebaseApp = admin.initializeApp(
                    {
                        credential: admin.credential.cert(serviceAccount),
                        databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
                    },
                    `brand-${brandId}`
                );

                auth = admin.auth(firebaseApp);
            } catch (initError) {
                console.error('Error initializing Firebase app:', initError);
                return res.status(500).json({ message: 'Failed to initialize Firebase: ' + initError.message });
            }
        }

        // Make a test request to list users (limit to 1 to just test the connection)
        try {
            const listUsersResult = await auth.listUsers(1);
            const userCount = await getTotalUserCount(auth);

            return res.status(200).json({
                success: true,
                userCount,
                sampleUser: listUsersResult.users.length > 0 ? sanitizeUserData(listUsersResult.users[0]) : null,
            });
        } catch (authError) {
            console.error('Error listing Firebase users:', authError);
            return res.status(500).json({ message: 'Error connecting to Firebase Auth: ' + authError.message });
        }
    } catch (error) {
        console.error('Error testing Firebase connection:', error);
        return res.status(500).json({ message: 'Server error: ' + error.message });
    }
}

// Get the total count of users in Firebase Auth
async function getTotalUserCount(auth) {
    try {
        // List users with small page size to get the total count
        const result = await auth.listUsers(1);
        return result.pageToken ? '> 1000' : result.users.length;
    } catch (error) {
        console.error('Error getting total user count:', error);
        return 'Unknown';
    }
}

// Sanitize user data to only return what we need
function sanitizeUserData(user) {
    return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        phoneNumber: user.phoneNumber,
        emailVerified: user.emailVerified,
        disabled: user.disabled,
    };
}

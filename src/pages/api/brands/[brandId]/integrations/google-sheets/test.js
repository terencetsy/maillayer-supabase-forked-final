// src/pages/api/brands/[id]/integrations/google-sheets/test.js
import { getUserFromRequest } from '@/lib/supabase';
import { getIntegrationByType } from '@/services/integrationService';
import { google } from 'googleapis';

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Authenticate the user
        const { user } = await getUserFromRequest(req, res);
        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { brandId } = req.query;

        // Get the Google Sheets integration
        const integration = await getIntegrationByType('google_sheets', brandId, user.id);

        if (!integration) {
            return res.status(404).json({ message: 'Google Sheets integration not found' });
        }

        // Create Google Sheets API client with proper scopes
        const serviceAccount = integration.config.serviceAccount;
        const auth = new google.auth.JWT({
            email: serviceAccount.client_email,
            key: serviceAccount.private_key,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets.readonly',
                'https://www.googleapis.com/auth/drive.readonly', // Add Drive readonly scope
            ],
        });

        // Test the connection by listing available spreadsheets
        const drive = google.drive({ version: 'v3', auth });

        try {
            const response = await drive.files.list({
                q: "mimeType='application/vnd.google-apps.spreadsheet'",
                fields: 'files(id, name)',
            });

            const spreadsheets = response.data.files.map((file) => ({
                id: file.id,
                name: file.name,
            }));

            return res.status(200).json({
                success: true,
                spreadsheets,
                message: `Successfully connected to Google Sheets. Found ${spreadsheets.length} spreadsheets.`,
            });
        } catch (driveError) {
            console.error('Google Drive API error:', driveError);

            // If there's a permission issue, provide a more specific message
            if (driveError.status === 403) {
                return res.status(403).json({
                    message: 'Permission denied: The service account does not have access to these files. Make sure to share your Google Sheets with the service account email: ' + serviceAccount.client_email,
                });
            }

            throw driveError;
        }
    } catch (error) {
        console.error('Error testing Google Sheets connection:', error);
        return res.status(500).json({ message: 'Error connecting to Google Sheets: ' + error.message });
    }
}

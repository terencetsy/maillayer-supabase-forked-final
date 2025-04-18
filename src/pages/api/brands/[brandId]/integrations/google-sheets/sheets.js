// src/pages/api/brands/[id]/integrations/google-sheets/sheets.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { getIntegrationByType } from '@/services/integrationService';
import { google } from 'googleapis';

export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Authenticate the user
        const session = await getServerSession(req, res, authOptions);
        if (!session) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { brandId } = req.query;

        // Get the Google Sheets integration
        const integration = await getIntegrationByType('google_sheets', brandId, session.user.id);

        if (!integration) {
            return res.status(404).json({ message: 'Google Sheets integration not found' });
        }

        // Create Google Sheets API client
        const serviceAccount = integration.config.serviceAccount;
        const auth = new google.auth.JWT({
            email: serviceAccount.client_email,
            key: serviceAccount.private_key,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets.readonly',
                'https://www.googleapis.com/auth/drive.readonly', // Add Drive readonly scope
            ],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // List all spreadsheets
        const drive = google.drive({ version: 'v3', auth });
        const response = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.spreadsheet'",
            fields: 'files(id, name, webViewLink)',
        });

        const spreadsheets = await Promise.all(
            response.data.files.map(async (file) => {
                try {
                    // Get sheets in each spreadsheet
                    const sheetResponse = await sheets.spreadsheets.get({
                        spreadsheetId: file.id,
                        fields: 'sheets.properties',
                    });

                    const sheetsList = sheetResponse.data.sheets.map((sheet) => ({
                        id: sheet.properties.sheetId.toString(),
                        name: sheet.properties.title,
                        index: sheet.properties.index,
                    }));

                    return {
                        id: file.id,
                        name: file.name,
                        url: file.webViewLink,
                        sheets: sheetsList,
                    };
                } catch (error) {
                    console.error(`Error fetching sheets for spreadsheet ${file.id}:`, error);
                    return {
                        id: file.id,
                        name: file.name,
                        url: file.webViewLink,
                        sheets: [],
                        error: error.message,
                    };
                }
            })
        );

        return res.status(200).json({ sheets: spreadsheets });
    } catch (error) {
        console.error('Error fetching Google Sheets:', error);
        return res.status(500).json({ message: 'Error fetching Google Sheets: ' + error.message });
    }
}

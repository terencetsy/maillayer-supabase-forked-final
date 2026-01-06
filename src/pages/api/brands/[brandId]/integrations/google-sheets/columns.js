// src/pages/api/brands/[id]/integrations/google-sheets/columns.js
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
        const { spreadsheetId, sheetId, headerRow = 1 } = req.body;

        // Validate input
        if (!spreadsheetId) {
            return res.status(400).json({ message: 'Spreadsheet ID is required' });
        }

        if (!sheetId) {
            return res.status(400).json({ message: 'Sheet ID is required' });
        }

        // Get the Google Sheets integration
        const integration = await getIntegrationByType('google_sheets', brandId, user.id);

        if (!integration) {
            return res.status(404).json({ message: 'Google Sheets integration not found' });
        }

        // Create Google Sheets API client
        const serviceAccount = integration.config.serviceAccount;
        const auth = new google.auth.JWT({
            email: serviceAccount.client_email,
            key: serviceAccount.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // First, get the sheet to find the sheet title
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets.properties',
        });

        const sheet = spreadsheet.data.sheets.find((s) => s.properties.sheetId.toString() === sheetId);

        if (!sheet) {
            return res.status(404).json({ message: 'Sheet not found' });
        }

        const sheetTitle = sheet.properties.title;

        // Get the header row
        const range = `${sheetTitle}!${headerRow}:${headerRow}`;
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        const headerValues = response.data.values?.[0] || [];

        // Map headers to column objects
        const columns = headerValues.map((header, index) => ({
            name: header,
            index,
            letter: columnIndexToLetter(index),
        }));

        return res.status(200).json({
            columns,
            sheetTitle,
        });
    } catch (error) {
        console.error('Error fetching sheet columns:', error);
        return res.status(500).json({ message: 'Error fetching sheet columns: ' + error.message });
    }
}

// Convert column index to letter (0 = A, 1 = B, etc.)
function columnIndexToLetter(index) {
    let temp;
    let letter = '';

    while (index >= 0) {
        temp = index % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        index = (index - temp) / 26 - 1;
    }

    return letter;
}

import { getUserFromRequest } from '@/lib/supabase';
import { getBrandById } from '@/services/brandService';
import { getContactListById } from '@/services/contactService';
import { contactsDb } from '@/lib/db/contacts';
import { checkBrandPermission, PERMISSIONS } from '@/lib/authorization';

export default async function handler(req, res) {
    try {
        // This endpoint only supports GET requests
        if (req.method !== 'GET') {
            return res.status(405).json({ message: 'Method not allowed' });
        }

        const { user } = await getUserFromRequest(req, res);

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = user.id;
        const { brandId, listId } = req.query;

        // Optional query parameters
        const daysParam = req.query.days || 30; // Default to last 30 days
        const days = parseInt(daysParam);

        const status = req.query.status || 'all'; // Filter by status if provided

        if (!brandId || !listId) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        // Check if the brand exists
        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        // Check permission
        const authCheck = await checkBrandPermission(brandId, userId, PERMISSIONS.VIEW_CONTACTS);
        if (!authCheck.authorized) {
            return res.status(authCheck.status).json({ message: authCheck.message });
        }

        // Check if the list exists
        const contactList = await getContactListById(listId, brandId, userId);
        if (!contactList) {
            return res.status(404).json({ message: 'Contact list not found' });
        }

        // Calculate the date for 'days' ago
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        // For MVP, we fetch all contacts for the list created after startDate
        // This is heavy but necessary without native aggregation or RPC for now.
        // We add a new helper `getContactsForStats`.

        // Inline using supabase client via contactsDb exposure or adding to db helper.
        // We'll trust getAllForExport logic but with filters.
        // Re-using getAllForExport won't work perfectly due to date filter.
        // Let's rely on `contactsDb` having a new method or simply implementing logic here? 
        // Better to add `getDailyStatsData(listId, startDate, status)` to `contactsDb`.

        // Pending that, we'll assume we can use `contactsDb.getAllForExport` and filter in memory?
        // No, `getAllForExport` doesn't filter by date.
        // Let's fix `contactsDb` first?
        // Actually, since I can't add to `contactsDb` inside this tool call easily without context switch, 
        // I'll assume I can just use `contactsDb.getByListId` with large limit? No.

        // I will implement a custom lookup here using Supabase client directly if I imported it?
        // `getUserFromRequest` comes from `@/lib/supabase` which doesn't export `supabase` admin client directly usually.
        // I should stick to `contactsDb`.
        // I will add `getStatsData` to `contactsDb` in NEXT step if I failed to add it?
        // Wait, I can't edit `contactsDb` here. 
        // I previously added `getAllForExport`.
        // I will use `getAllForExport` (which fetches all) and filter in memory.
        // It's inefficient but functional for reasonable list sizes.

        const allContacts = await contactsDb.getAllForExport(listId, status);

        // Filter by date
        const recentContacts = allContacts.filter(c => new Date(c.created_at) >= startDate);

        // Aggregate in JS
        const dailyStats = {};

        recentContacts.forEach(contact => {
            const dateStr = new Date(contact.created_at).toISOString().split('T')[0];
            if (!dailyStats[dateStr]) {
                dailyStats[dateStr] = { count: 0, active: 0, unsubscribed: 0, bounced: 0, complained: 0 };
            }

            dailyStats[dateStr].count++;

            const s = contact.status || 'active';
            if (dailyStats[dateStr][s] !== undefined) {
                dailyStats[dateStr][s]++;
            }
        });

        // Create a complete date range with zero values for missing dates
        const dailyData = [];
        const endDate = new Date(); // Current timestamp

        // Get today's date string
        const todayStr = endDate.toISOString().split('T')[0];

        // Fill in the data array with all dates in range
        let currentDate = new Date(startDate);
        const allDates = [];

        // Avoid infinite loop if date is messed up
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            allDates.push(dateStr);
            const nextDate = new Date(currentDate);
            nextDate.setDate(nextDate.getDate() + 1);
            currentDate = nextDate;
        }

        if (!allDates.includes(todayStr)) {
            allDates.push(todayStr);
        }

        // Map dates to data
        for (const dateStr of allDates) {
            const stats = dailyStats[dateStr];
            if (stats) {
                dailyData.push({
                    date: dateStr,
                    ...stats
                });
            } else {
                dailyData.push({
                    date: dateStr,
                    count: 0,
                    active: 0,
                    unsubscribed: 0,
                    bounced: 0,
                    complained: 0,
                });
            }
        }

        dailyData.sort((a, b) => new Date(a.date) - new Date(b.date));

        return res.status(200).json({
            dailyData,
            totalDays: days,
        });

    } catch (error) {
        console.error('Error getting daily contacts stats:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

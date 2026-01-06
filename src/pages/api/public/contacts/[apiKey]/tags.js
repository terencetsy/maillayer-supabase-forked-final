// src/pages/api/public/contacts/[apiKey]/tags.js
import { contactListsDb } from '@/lib/db/contactLists';
import { contactsDb } from '@/lib/db/contacts';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        const { apiKey } = req.query;
        const { email, tags, action = 'add' } = req.body;

        if (!apiKey) {
            return res.status(400).json({ success: false, message: 'API key required' });
        }

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email required' });
        }

        if (!tags || !Array.isArray(tags) || tags.length === 0) {
            return res.status(400).json({ success: false, message: 'Tags array required' });
        }

        // Find the contact list by API key
        const contactList = await contactListsDb.getByApiKey(apiKey);

        if (!contactList) {
            return res.status(401).json({ success: false, message: 'Invalid or disabled API key' });
        }

        // Check domain if restrictions are set (use snake_case for DB columns)
        const allowedDomains = contactList.allowed_domains || contactList.allowedDomains;
        const origin = req.headers.origin || req.headers.referer;

        if (allowedDomains && allowedDomains.length > 0 && origin) {
            const originDomain = new URL(origin).hostname;
            const isAllowed = allowedDomains.some((d) => originDomain === d || originDomain.endsWith(`.${d}`));
            if (!isAllowed) {
                return res.status(403).json({ success: false, message: 'Domain not allowed' });
            }
        }

        const normalizedTags = tags.map((t) => t.toLowerCase().trim());

        // Find and update the contact
        // Helper `updateTagsByEmail` finds by email + brandId and updates tags
        const brandId = contactList.brand_id || contactList.brandId;
        const updatedContact = await contactsDb.updateTagsByEmail(email.toLowerCase(), brandId, normalizedTags, action);

        if (!updatedContact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Tags updated successfully',
            contactId: updatedContact.id,
            tags: updatedContact.tags,
        });
    } catch (error) {
        console.error('Error updating contact tags:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

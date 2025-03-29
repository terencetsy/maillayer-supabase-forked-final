// lib/tokenUtils.js - CommonJS version
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key'; // Use a strong secret!

// Generate unsubscribe token
function generateUnsubscribeToken(contactId, brandId, campaignId = null) {
    const payload = {
        contactId,
        brandId,
        campaignId,
        type: 'unsubscribe',
    };

    // Create token that expires in 1 year
    return jwt.sign(payload, SECRET_KEY, { expiresIn: '1y' });
}

// Verify the token is valid
function verifyUnsubscribeToken(token) {
    try {
        jwt.verify(token, SECRET_KEY);
        return true;
    } catch (error) {
        return false;
    }
}

// Decode the token to extract contactId and other info
function decodeUnsubscribeToken(token) {
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        return {
            contactId: decoded.contactId,
            brandId: decoded.brandId,
            campaignId: decoded.campaignId,
        };
    } catch (error) {
        return {};
    }
}

module.exports = {
    generateUnsubscribeToken,
    verifyUnsubscribeToken,
    decodeUnsubscribeToken,
};

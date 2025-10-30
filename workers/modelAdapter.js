// workers/modelAdapter.js
// This adapter loads ES Module models in a CommonJS environment
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

// Connect to MongoDB
async function connectToDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Worker connected to MongoDB');
        return true;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

// After connection, the models should be available directly from mongoose
// No need to redefine schemas because they're already defined in models/*

module.exports = {
    connectToDB,
    getModels: () => ({
        Campaign: mongoose.models.Campaign,
        Contact: mongoose.models.Contact,
        Brand: mongoose.models.Brand,
        ContactList: mongoose.models.ContactList,
        User: mongoose.models.User,
        TrackingEvent: mongoose.models.TrackingEvent,
    }),
};

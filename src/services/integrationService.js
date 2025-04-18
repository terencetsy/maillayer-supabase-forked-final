import connectToDatabase from '@/lib/mongodb';
import Integration from '@/models/Integration';
import mongoose from 'mongoose';

// Get all integrations for a brand
export async function getIntegrationsByBrandId(brandId, userId) {
    await connectToDatabase();

    const integrations = await Integration.find({
        brandId: new mongoose.Types.ObjectId(brandId),
        userId: new mongoose.Types.ObjectId(userId),
    }).sort({ createdAt: -1 });

    return integrations;
}

// Get a specific integration
export async function getIntegrationById(integrationId, brandId, userId) {
    await connectToDatabase();

    const integration = await Integration.findOne({
        _id: new mongoose.Types.ObjectId(integrationId),
        brandId: new mongoose.Types.ObjectId(brandId),
        userId: new mongoose.Types.ObjectId(userId),
    });

    return integration;
}

// Get integration by type for a brand
export async function getIntegrationByType(type, brandId, userId) {
    await connectToDatabase();

    const integration = await Integration.findOne({
        type,
        brandId: new mongoose.Types.ObjectId(brandId),
        userId: new mongoose.Types.ObjectId(userId),
    });

    return integration;
}

// Create a new integration
export async function createIntegration(integrationData) {
    await connectToDatabase();

    const integration = new Integration({
        ...integrationData,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    await integration.save();
    return integration;
}

// Update an integration
// Update the updateIntegration function in src/services/integrationService.js:

export async function updateIntegration(integrationId, brandId, userId, updateData) {
    await connectToDatabase();

    // Deep copy the updateData to avoid modifying the original
    const dataToUpdate = JSON.parse(JSON.stringify(updateData));

    // Ensure config and tableSyncs are properly handled
    if (dataToUpdate.config) {
        // Make sure tableSyncs is an array if it exists
        if ('tableSyncs' in dataToUpdate.config) {
            if (!Array.isArray(dataToUpdate.config.tableSyncs)) {
                console.warn('tableSyncs is not an array, setting to empty array');
                dataToUpdate.config.tableSyncs = [];
            }
        }
    }

    try {
        const integration = await Integration.findOneAndUpdate(
            {
                _id: new mongoose.Types.ObjectId(integrationId),
                brandId: new mongoose.Types.ObjectId(brandId),
                userId: new mongoose.Types.ObjectId(userId),
            },
            {
                ...dataToUpdate,
                updatedAt: new Date(),
            },
            {
                new: true, // Return the updated document
                runValidators: true, // Run schema validators
            }
        );

        return integration;
    } catch (error) {
        console.error('Error updating integration:', error);
        throw error;
    }
}

// Delete an integration
export async function deleteIntegration(integrationId, brandId, userId) {
    await connectToDatabase();

    const result = await Integration.deleteOne({
        _id: new mongoose.Types.ObjectId(integrationId),
        brandId: new mongoose.Types.ObjectId(brandId),
        userId: new mongoose.Types.ObjectId(userId),
    });

    return result.deletedCount > 0;
}

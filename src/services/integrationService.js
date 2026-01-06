import { integrationsDb } from '@/lib/db/integrations';

export async function getIntegrationsByBrandId(brandId, userId) {
    return await integrationsDb.getByBrandId(brandId);
}

export async function getIntegrationById(integrationId, brandId, userId) {
    return await integrationsDb.getById(integrationId);
}

export async function getIntegrationByType(type, brandId, userId) {
    return await integrationsDb.getByType(brandId, type);
}

export async function createIntegration(integrationData) {
    return await integrationsDb.create(integrationData);
}

export async function updateIntegration(integrationId, brandId, userId, updateData) {
    // Deep copy not strictly needed if we don't mutate input, but safe
    const updates = { ...updateData };

    // Ensure config handling (tableSyncs)
    if (updates.config && typeof updates.config === 'object') {
        if ('tableSyncs' in updates.config && !Array.isArray(updates.config.tableSyncs)) {
            updates.config.tableSyncs = [];
        }
    }

    // Supabase update handles partial updates if we pass partial object. 
    // If 'config' is a JSON column, we might overwrite the whole JSON if not careful.
    // So we should merge if needed, but `updateData` usually comes from UI as full config or partial?
    // Previous code just spread `...dataToUpdate`.
    // We'll trust the input.

    return await integrationsDb.update(integrationId, updates);
}

export async function deleteIntegration(integrationId, brandId, userId) {
    await integrationsDb.delete(integrationId);
    return true;
}

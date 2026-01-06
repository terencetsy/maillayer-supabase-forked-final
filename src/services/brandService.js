import { brandsDb } from '@/lib/db/brands';

export async function createBrand(brandData) {
    const { userId, ...rest } = brandData;
    // Ensure userId is present
    if (!userId) throw new Error('userId is required to create a brand');

    // Map any camelCase fields to snake_case if necessary, though brandsDb might handle standard fields.
    // Assuming rest contains: name, emailProvider, etc.
    // We should map them.
    const mappedData = {};
    Object.keys(rest).forEach(key => {
        const snaked = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        mappedData[snaked] = rest[key];
    });

    const brand = await brandsDb.create(userId, mappedData);
    return brand;
}

export async function getBrandsByUserId(userId) {
    return await brandsDb.getByUserId(userId);
}

export async function getBrandById(brandId, includeSecrets = false) {
    const brand = await brandsDb.getById(brandId);

    if (!brand) return null;

    if (!includeSecrets) {
        // Remove secrets
        const secrets = ['aws_secret_key', 'sendgrid_api_key', 'mailgun_api_key', 'smtp_password'];
        secrets.forEach(key => {
            delete brand[key];
        });
    }

    return brand;
}

export async function updateBrand(brandId, updateData) {
    const mappedUpdates = {};
    Object.keys(updateData).forEach(key => {
        const snaked = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        mappedUpdates[snaked] = updateData[key];
    });

    const updatedBrand = await brandsDb.update(brandId, mappedUpdates);
    return !!updatedBrand;
}

export async function deleteBrand(brandId) {
    await brandsDb.delete(brandId);
    return true;
}

export async function hasBrands(userId) {
    const brands = await brandsDb.getByUserId(userId);
    return brands && brands.length > 0;
}

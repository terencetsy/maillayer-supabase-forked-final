import { brandsDb } from '@/lib/db/brands';

export async function createBrand(brandData) {
    // brandsDb.create requires userId. brandData usually has it or it's passed separately.
    // The previous implementation took brandData which likely contained userId.
    // brandsDb.create signature: (userId, brandData)
    // We should extract userId from brandData if possible, or adapt.
    // Inspecting brandsDb: `insert({ ...brandData, user_id: userId })`
    // So we need to pass userId as first arg.

    const { userId, ...rest } = brandData;
    const brand = await brandsDb.create(userId, rest);

    // Map snake_case to camelCase if needed, or keeping it as is if the app adapts.
    // Mongoose models uses camelCase. Supabase returns snake_case.
    // We should probably map it to preserve compatibility for now, or ensure callers handle snake_case.
    // Given the scale, mapping might be safer.
    // But `brandsDb` returns snake_case.
    // Let's inspect `brandsDb` usage in other files I refactored.
    // In `verification` I adapted to snake_case.
    // In `contact-lists` APIs, they use `getBrandById`.
    // If I return snake_case here, those APIs might break if they access `brand.someProperty`.
    // Eg `verification/check-domain.js` was using `brand.awsRegion`.
    // I refactored those to `brand.aws_region`.
    // But what about files I DID NOT refactor?
    // `contact-lists` uses `brand.id`?
    // `contact-lists/index.js` uses `getBrandById(brandId)`.
    // Then `contactService.createContactList` uses `brandId`.
    // It doesn't seem to access brand properties heavily.
    // But let's look at `contact-lists/index.js` again.
    // It checks `if (!brand)`.
    // `contact-lists/active-counts.js` checks `if (!brand)`.
    // `contacts/count.js` checks `if (!brand)`.
    // These seem fine.

    return brand;
}

export async function getBrandsByUserId(userId) {
    return await brandsDb.getByUserId(userId);
}

export async function getBrandById(brandId, includeSecrets = false) {
    const brand = await brandsDb.getById(brandId);

    if (!brand) return null;

    if (!includeSecrets) {
        // Remove secrets if not requested
        // List of secret keys in snake_case
        const secrets = ['aws_secret_key', 'sendgrid_api_key', 'mailgun_api_key', 'smtp_password'];
        secrets.forEach(key => {
            delete brand[key];
        });

        // Also remove camelCase versions if they somehow exist (unlikely from Supabase)
        const camelSecrets = ['awsSecretKey', 'sendgridApiKey', 'mailgunApiKey', 'smtpPassword'];
        camelSecrets.forEach(key => {
            delete brand[key];
        });
    }

    return brand;
}

export async function updateBrand(brandId, updateData) {
    // updateData might be camelCase. brandsDb expects matching column names (snake_case).
    // We might need to map keys.
    // Or we assume updateData is already snake_case where it comes from new code.
    // But legacy code calls this with camelCase.
    // For safety, we should map common camelCase fields to snake_case.

    const mappedUpdates = {};
    Object.keys(updateData).forEach(key => {
        // Simple mapping from camelCase to snake_case equivalent for known fields
        // or just use a utilitarian converter.
        // For now, let's look at common fields.
        let snaked = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

        // Special cases if any?
        // `awsRegion` -> `aws_region` (Correct)
        // `usageLimit` -> `usage_limit` (Correct)

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

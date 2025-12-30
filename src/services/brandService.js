import connectToDatabase from '@/lib/mongodb';
import Brand from '@/models/Brand';

export async function createBrand(brandData) {
    await connectToDatabase();

    const brand = new Brand({
        ...brandData,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    await brand.save();
    return brand;
}

export async function getBrandsByUserId(userId) {
    await connectToDatabase();
    const brands = await Brand.find({ userId }).sort({ createdAt: -1 }).lean();
    return brands;
}

export async function getBrandById(brandId, includeSecrets = false) {
    await connectToDatabase();

    const query = Brand.findById(brandId);

    if (includeSecrets) {
        // Include all provider secret keys
        query.select('+awsSecretKey +sendgridApiKey +mailgunApiKey +smtpPassword');
    }

    const brand = await query.lean();
    return brand;
}

export async function updateBrand(brandId, updateData) {
    await connectToDatabase();

    const result = await Brand.updateOne(
        { _id: brandId },
        {
            $set: {
                ...updateData,
                updatedAt: new Date(),
            },
        }
    );

    return result.modifiedCount > 0;
}

export async function deleteBrand(brandId) {
    await connectToDatabase();
    const result = await Brand.deleteOne({ _id: brandId });
    return result.deletedCount > 0;
}

export async function hasBrands(userId) {
    await connectToDatabase();
    const count = await Brand.countDocuments({ userId });
    return count > 0;
}

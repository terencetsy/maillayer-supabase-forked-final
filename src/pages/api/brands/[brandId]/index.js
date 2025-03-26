import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getBrandById, updateBrand, deleteBrand } from '@/services/brandService';

export default async function handler(req, res) {
    try {
        // Connect to database
        await connectToDatabase();

        // Get session directly from server
        const session = await getServerSession(req, res, authOptions);

        if (!session || !session.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = session.user.id;
        const { brandId } = req.query;

        if (!brandId) {
            return res.status(400).json({ message: 'Missing brand ID' });
        }

        // GET request - get brand details
        if (req.method === 'GET') {
            try {
                const includeSecrets = req.query.includeSecrets === 'true';
                const brand = await getBrandById(brandId, includeSecrets);

                if (!brand) {
                    return res.status(404).json({ message: 'Brand not found' });
                }

                // Verify owner
                if (brand.userId.toString() !== userId) {
                    return res.status(403).json({ message: 'Not authorized to access this brand' });
                }

                return res.status(200).json(brand);
            } catch (error) {
                console.error('Error fetching brand:', error);
                return res.status(500).json({ message: 'Error fetching brand' });
            }
        }

        // PUT request - update brand
        if (req.method === 'PUT') {
            try {
                const brand = await getBrandById(brandId);

                if (!brand) {
                    return res.status(404).json({ message: 'Brand not found' });
                }

                // Verify owner
                if (brand.userId.toString() !== userId) {
                    return res.status(403).json({ message: 'Not authorized to update this brand' });
                }

                const { name, awsRegion, awsAccessKey, awsSecretKey, sendingDomain, fromName, fromEmail, replyToEmail, status } = req.body;

                const updateData = {};

                if (name) updateData.name = name;
                if (awsRegion) updateData.awsRegion = awsRegion;
                if (awsAccessKey) updateData.awsAccessKey = awsAccessKey;
                if (awsSecretKey) updateData.awsSecretKey = awsSecretKey;
                if (sendingDomain) updateData.sendingDomain = sendingDomain;
                if (fromName) updateData.fromName = fromName;
                if (fromEmail) updateData.fromEmail = fromEmail;
                if (replyToEmail) updateData.replyToEmail = replyToEmail;
                if (status) updateData.status = status;

                const success = await updateBrand(brandId, updateData);

                if (success) {
                    return res.status(200).json({ message: 'Brand updated successfully' });
                } else {
                    return res.status(500).json({ message: 'Failed to update brand' });
                }
            } catch (error) {
                console.error('Error updating brand:', error);
                return res.status(500).json({ message: 'Error updating brand' });
            }
        }

        // DELETE request - delete brand
        if (req.method === 'DELETE') {
            try {
                const brand = await getBrandById(brandId);

                if (!brand) {
                    return res.status(404).json({ message: 'Brand not found' });
                }

                // Verify owner
                if (brand.userId.toString() !== userId) {
                    return res.status(403).json({ message: 'Not authorized to delete this brand' });
                }

                const success = await deleteBrand(brandId);

                if (success) {
                    return res.status(200).json({ message: 'Brand deleted successfully' });
                } else {
                    return res.status(500).json({ message: 'Failed to delete brand' });
                }
            } catch (error) {
                console.error('Error deleting brand:', error);
                return res.status(500).json({ message: 'Error deleting brand' });
            }
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

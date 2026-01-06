import { getUserFromRequest } from '@/lib/supabase';
import formidable from 'formidable';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Disable the default body parser to handle form data
export const config = {
    api: {
        bodyParser: false,
    },
};

// Detect storage provider from environment variables
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER?.toLowerCase() || 'digitalocean';

// Initialize S3 client based on the storage provider
const s3Client = new S3Client({
    endpoint: process.env.STORAGE_ENDPOINT,
    region: STORAGE_PROVIDER === 'cloudflare' ? 'auto' : 'us-east-1',
    credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY,
        secretAccessKey: process.env.STORAGE_SECRET_KEY,
    },
    // Add forcePathStyle for Cloudflare R2 compatibility
    ...(STORAGE_PROVIDER === 'cloudflare' && { forcePathStyle: true }),
});

export default async function handler(req, res) {
    // Check authentication
    const { user } = await getUserFromRequest(req, res);
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Parse the form data
        const form = formidable({
            maxFiles: 1,
            maxFileSize: 5 * 1024 * 1024, // 5MB limit
            filter: (part) => {
                // Accept only images
                return part.mimetype?.includes('image') || false;
            },
        });

        const [fields, files] = await form.parse(req);

        // If no file is uploaded
        if (!files.file || !files.file[0]) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const file = files.file[0];

        // Generate a unique filename
        const fileExt = path.extname(file.originalFilename);
        const fileName = `${uuidv4()}${fileExt}`;

        // Read the file
        const fileData = fs.readFileSync(file.filepath);

        // Prepare upload parameters
        const uploadParams = {
            Bucket: process.env.STORAGE_BUCKET,
            Key: `campaign-images/${fileName}`,
            Body: fileData,
            ContentType: file.mimetype,
            // Include ACL for both providers
            ACL: 'public-read',
        };

        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        // Generate the URL based on provider
        let fileUrl;

        if (STORAGE_PROVIDER === 'cloudflare') {
            // For Cloudflare R2 - require public URL for public access
            if (!process.env.STORAGE_PUBLIC_URL) {
                throw new Error('STORAGE_PUBLIC_URL is required for Cloudflare R2 public access');
            }
            fileUrl = `${process.env.STORAGE_PUBLIC_URL}/campaign-images/${fileName}`;
        } else {
            // For DigitalOcean Spaces
            fileUrl = `${process.env.STORAGE_PUBLIC_URL}/campaign-images/${fileName}`;
        }

        // Return success response
        return res.status(200).json({
            message: 'File uploaded successfully',
            url: fileUrl,
        });
    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ message: 'Error uploading image' });
    }
}

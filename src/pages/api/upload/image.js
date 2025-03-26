import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
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

// Initialize S3 client for DigitalOcean Spaces
const s3Client = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT,
    region: 'us-east-1', // DO Spaces use this region for API
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET,
    },
});

export default async function handler(req, res) {
    // Check authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user) {
        return res.status(401).json({ message: 'Unauthorized' });
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

        // Upload to DigitalOcean Spaces
        const uploadParams = {
            Bucket: process.env.DO_SPACES_BUCKET,
            Key: `campaign-images/${fileName}`,
            Body: fileData,
            ACL: 'public-read',
            ContentType: file.mimetype,
        };

        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        // Generate the URL
        const fileUrl = `${process.env.DO_SPACES_URL}/campaign-images/${fileName}`;

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

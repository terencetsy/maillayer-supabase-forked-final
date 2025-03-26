// src/lib/imageUploadService.js

/**
 * Uploads an image to DigitalOcean Spaces
 * @param {File} file - The image file to upload
 * @returns {Promise<string>} - The URL of the uploaded image
 */
export async function uploadImageToSpaces(file) {
    try {
        // Create a form data object
        const formData = new FormData();
        formData.append('file', file);

        // Send the file to your backend API for upload
        const response = await fetch('/api/upload/image', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin',
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to upload image');
        }

        const data = await response.json();
        return data.url; // Return the URL of the uploaded image
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
}

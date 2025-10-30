// src/services/clientEmailSequenceService.js
export async function updateEmailSequence(brandId, sequenceId, updateData) {
    try {
        console.log('Client sending update:', updateData); // Debug log

        const response = await fetch(`/api/brands/${brandId}/email-sequences/${sequenceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify(updateData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update sequence');
        }

        const data = await response.json();
        console.log('Client received response:', data); // Debug log

        return data;
    } catch (error) {
        console.error('Error updating sequence:', error);
        throw error;
    }
}

export async function getEmailSequences(brandId) {
    try {
        const response = await fetch(`/api/brands/${brandId}/email-sequences`, {
            credentials: 'same-origin',
        });

        if (!response.ok) {
            throw new Error('Failed to fetch sequences');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching sequences:', error);
        throw error;
    }
}

export async function getEmailSequence(brandId, sequenceId) {
    try {
        const response = await fetch(`/api/brands/${brandId}/email-sequences/${sequenceId}`, {
            credentials: 'same-origin',
        });

        if (!response.ok) {
            throw new Error('Failed to fetch sequence');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching sequence:', error);
        throw error;
    }
}

export async function createEmailSequence(brandId, sequenceData) {
    try {
        const response = await fetch(`/api/brands/${brandId}/email-sequences`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify(sequenceData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create sequence');
        }

        return await response.json();
    } catch (error) {
        console.error('Error creating sequence:', error);
        throw error;
    }
}

export async function deleteEmailSequence(brandId, sequenceId) {
    try {
        const response = await fetch(`/api/brands/${brandId}/email-sequences/${sequenceId}`, {
            method: 'DELETE',
            credentials: 'same-origin',
        });

        if (!response.ok) {
            throw new Error('Failed to delete sequence');
        }

        return await response.json();
    } catch (error) {
        console.error('Error deleting sequence:', error);
        throw error;
    }
}

export async function getSequenceEnrollments(brandId, sequenceId, options = {}) {
    try {
        const params = new URLSearchParams(options);
        const response = await fetch(`/api/brands/${brandId}/email-sequences/${sequenceId}/enrollments?${params}`, {
            credentials: 'same-origin',
        });

        if (!response.ok) {
            throw new Error('Failed to fetch enrollments');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching enrollments:', error);
        throw error;
    }
}

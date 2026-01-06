import { sequencesDb } from '@/lib/db/sequences';

export async function createEmailSequence(sequenceData) {
    const { emails, ...mainData } = sequenceData;

    // 1. Create Sequence
    const sequence = await sequencesDb.create(mainData.brandId, mainData.userId, mainData);

    // 2. Create Steps (Emails)
    if (emails && emails.length > 0) {
        const steps = Promise.all(emails.map((email, index) => {
            return sequencesDb.createStep(sequence.id, {
                subject: email.subject,
                content: email.content,
                delay: email.delay || 0,
                order_index: index,
                // other fields
            });
        }));
        await steps;
    }

    return await sequencesDb.getById(sequence.id);
}

export async function getEmailSequencesByBrandId(brandId, userId) {
    return await sequencesDb.getByBrandId(brandId);
}

export async function getEmailSequenceById(sequenceId, brandId = null) {
    // Note: authorization usually handled by API middleware checking brand access
    return await sequencesDb.getById(sequenceId);
}

export async function updateEmailSequence(sequenceId, brandId, updateData) {
    const { emails, ...mainUpdates } = updateData;

    // 1. Update main sequence details
    if (Object.keys(mainUpdates).length > 0) {
        await sequencesDb.update(sequenceId, mainUpdates);
    }

    // 2. Update steps (emails)
    if (emails && Array.isArray(emails)) {
        const existingSteps = await sequencesDb.getSteps(sequenceId);

        const stepUpdates = emails.map((email, index) => {
            // If email has an ID and matches existing step, update it
            if (email.id && existingSteps.find(s => s.id === email.id)) {
                return sequencesDb.updateStep(email.id, {
                    subject: email.subject,
                    content: email.content,
                    delay: email.delay || 0,
                    order_index: index,
                });
            } else {
                // Create new step
                return sequencesDb.createStep(sequenceId, {
                    subject: email.subject,
                    content: email.content,
                    delay: email.delay || 0,
                    order_index: index,
                });
            }
        });

        await Promise.all(stepUpdates);

        // Cleanup: Delete steps not in the new list (if needed)
        // For simplistic sync:
        const inboundIds = emails.map(e => e.id).filter(Boolean);
        const toDelete = existingSteps.filter(s => !inboundIds.includes(s.id));
        if (toDelete.length > 0) {
            await Promise.all(toDelete.map(s => sequencesDb.deleteStep(s.id)));
        }
    }

    return await sequencesDb.getById(sequenceId);
}

export async function deleteEmailSequence(sequenceId, brandId) {
    await sequencesDb.delete(sequenceId);
    return true;
}

export async function enrollContactInSequence(contactId, sequenceId, brandId, userId) {
    return await sequencesDb.enrollContact(sequenceId, contactId);
}

export async function getSequenceEnrollments(sequenceId, options = {}) {
    // Placeholder: Need enrollments query helper
    return { enrollments: [], pagination: {} };
}

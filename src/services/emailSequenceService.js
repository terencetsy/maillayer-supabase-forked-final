// src/services/emailSequenceService.js
import connectToDatabase from '@/lib/mongodb';
import EmailSequence from '@/models/EmailSequence';
import SequenceEnrollment from '@/models/SequenceEnrollment';
import Contact from '@/models/Contact';
import mongoose from 'mongoose';

export async function createEmailSequence(sequenceData) {
    await connectToDatabase();

    // Generate unique IDs for emails if not provided
    if (sequenceData.emails && sequenceData.emails.length > 0) {
        sequenceData.emails = sequenceData.emails.map((email, index) => ({
            id: email.id || `email-${Date.now()}-${index}`,
            ...email,
        }));
    }

    const sequence = new EmailSequence({
        ...sequenceData,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    await sequence.save();
    return sequence;
}

export async function getEmailSequencesByBrandId(brandId, userId) {
    await connectToDatabase();

    const sequences = await EmailSequence.find({
        brandId: new mongoose.Types.ObjectId(brandId),
        userId: new mongoose.Types.ObjectId(userId),
    }).sort({ createdAt: -1 });

    return sequences;
}

export async function getEmailSequenceById(sequenceId, userId) {
    await connectToDatabase();

    const sequence = await EmailSequence.findOne({
        _id: new mongoose.Types.ObjectId(sequenceId),
        userId: new mongoose.Types.ObjectId(userId),
    });

    return sequence;
}

// src/services/emailSequenceService.js (update the updateEmailSequence function)
export async function updateEmailSequence(sequenceId, userId, updateData) {
    await connectToDatabase();

    console.log('Service updating sequence:', sequenceId, updateData); // Debug log

    // If updating emails, ensure they have IDs
    if (updateData.emails) {
        updateData.emails = updateData.emails.map((email, index) => ({
            id: email.id || `email-${Date.now()}-${index}`,
            ...email,
        }));
    }

    // Validate status transitions
    if (updateData.status && updateData.status !== 'draft') {
        const sequence = await EmailSequence.findOne({
            _id: new mongoose.Types.ObjectId(sequenceId),
            userId: new mongoose.Types.ObjectId(userId),
        });

        if (sequence) {
            // Check if sequence is ready to be activated
            if (updateData.status === 'active') {
                // Must have trigger configured
                const triggerConfig = updateData.triggerConfig || sequence.triggerConfig;
                const triggerType = updateData.triggerType || sequence.triggerType;

                if (triggerType === 'contact_list' && !triggerConfig?.contactListIds?.length) {
                    throw new Error('Please configure trigger lists before activating');
                }

                // Must have at least one email
                const emailsToCheck = updateData.emails || sequence.emails;
                if (!emailsToCheck || emailsToCheck.length === 0) {
                    throw new Error('Please add at least one email before activating');
                }

                // Check if all emails are configured
                const incompleteEmails = emailsToCheck.filter((email) => !email.subject || !email.content);
                if (incompleteEmails.length > 0) {
                    throw new Error('Please complete all email configurations before activating');
                }
            }
        }
    }

    // Prepare the update object
    const updateObject = {
        ...updateData,
        updatedAt: new Date(),
    };

    console.log('Updating with object:', updateObject); // Debug log

    const result = await EmailSequence.findOneAndUpdate(
        {
            _id: new mongoose.Types.ObjectId(sequenceId),
            userId: new mongoose.Types.ObjectId(userId),
        },
        {
            $set: updateObject,
        },
        {
            new: true, // Return the updated document
            runValidators: true,
        }
    );

    if (!result) {
        console.log('No sequence found to update'); // Debug log
        return null;
    }

    console.log('Sequence updated successfully:', result); // Debug log

    return result;
}
export async function deleteEmailSequence(sequenceId, userId) {
    await connectToDatabase();

    const result = await EmailSequence.deleteOne({
        _id: new mongoose.Types.ObjectId(sequenceId),
        userId: new mongoose.Types.ObjectId(userId),
    });

    return result.deletedCount > 0;
}

export async function enrollContactInSequence(contactId, sequenceId, brandId, userId) {
    await connectToDatabase();

    // Check if contact is already enrolled
    const existingEnrollment = await SequenceEnrollment.findOne({
        contactId: new mongoose.Types.ObjectId(contactId),
        sequenceId: new mongoose.Types.ObjectId(sequenceId),
    });

    if (existingEnrollment) {
        return { success: false, message: 'Contact already enrolled in this sequence' };
    }

    // Check if contact is active
    const contact = await Contact.findById(contactId);
    if (!contact || contact.status !== 'active' || contact.isUnsubscribed) {
        return { success: false, message: 'Contact is not eligible for enrollment' };
    }

    // Create enrollment
    const enrollment = new SequenceEnrollment({
        sequenceId: new mongoose.Types.ObjectId(sequenceId),
        contactId: new mongoose.Types.ObjectId(contactId),
        brandId: new mongoose.Types.ObjectId(brandId),
        userId: new mongoose.Types.ObjectId(userId),
        currentStep: 0,
        enrolledAt: new Date(),
    });

    await enrollment.save();

    // Update sequence stats
    await EmailSequence.updateOne(
        { _id: new mongoose.Types.ObjectId(sequenceId) },
        {
            $inc: {
                'stats.totalEnrolled': 1,
                'stats.totalActive': 1,
            },
        }
    );

    return { success: true, enrollment };
}

export async function getSequenceEnrollments(sequenceId, options = {}) {
    await connectToDatabase();

    const { page = 1, limit = 50, status = '' } = options;
    const skip = (page - 1) * limit;

    const query = {
        sequenceId: new mongoose.Types.ObjectId(sequenceId),
    };

    if (status) {
        query.status = status;
    }

    const enrollments = await SequenceEnrollment.find(query).populate('contactId', 'email firstName lastName status').sort({ enrolledAt: -1 }).skip(skip).limit(limit);

    const total = await SequenceEnrollment.countDocuments(query);

    return {
        enrollments,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
}

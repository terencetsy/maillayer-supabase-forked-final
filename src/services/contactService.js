import connectToDatabase from '@/lib/mongodb';
import Contact from '@/models/Contact';
import ContactList from '@/models/ContactList';
import mongoose from 'mongoose';

// Get all contact lists for a brand
export async function getContactListsByBrandId(brandId, userId) {
    await connectToDatabase();

    const contactLists = await ContactList.find({
        brandId: new mongoose.Types.ObjectId(brandId),
        userId: new mongoose.Types.ObjectId(userId),
    }).sort({ createdAt: -1 });

    return contactLists;
}

// Get a specific contact list
export async function getContactListById(listId, brandId, userId) {
    await connectToDatabase();

    const contactList = await ContactList.findOne({
        _id: new mongoose.Types.ObjectId(listId),
        brandId: new mongoose.Types.ObjectId(brandId),
        userId: new mongoose.Types.ObjectId(userId),
    });

    return contactList;
}

// Create a new contact list
export async function createContactList(listData) {
    await connectToDatabase();

    const contactList = new ContactList({
        ...listData,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    await contactList.save();
    return contactList;
}

// Update a contact list
export async function updateContactList(listId, brandId, userId, updateData) {
    await connectToDatabase();

    const contactList = await ContactList.findOneAndUpdate(
        {
            _id: new mongoose.Types.ObjectId(listId),
            brandId: new mongoose.Types.ObjectId(brandId),
            userId: new mongoose.Types.ObjectId(userId),
        },
        {
            ...updateData,
            updatedAt: new Date(),
        },
        { new: true }
    );

    return contactList;
}

// Delete a contact list and its contacts
export async function deleteContactList(listId, brandId, userId) {
    await connectToDatabase();

    // Delete all contacts in the list
    await Contact.deleteMany({
        listId: new mongoose.Types.ObjectId(listId),
        brandId: new mongoose.Types.ObjectId(brandId),
        userId: new mongoose.Types.ObjectId(userId),
    });

    // Delete the list itself
    const result = await ContactList.deleteOne({
        _id: new mongoose.Types.ObjectId(listId),
        brandId: new mongoose.Types.ObjectId(brandId),
        userId: new mongoose.Types.ObjectId(userId),
    });

    return result.deletedCount > 0;
}

// Get contacts from a list with pagination and search
export async function getContactsByListId(listId, brandId, userId, options = {}) {
    await connectToDatabase();

    const { page = 1, limit = 20, sortField = 'email', sortOrder = 'asc', search = '' } = options;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    // Build the query
    const query = {
        listId: new mongoose.Types.ObjectId(listId),
        brandId: new mongoose.Types.ObjectId(brandId),
        userId: new mongoose.Types.ObjectId(userId),
    };

    // Add search filter if provided
    if (search) {
        query.$or = [{ email: { $regex: search, $options: 'i' } }, { firstName: { $regex: search, $options: 'i' } }, { lastName: { $regex: search, $options: 'i' } }];
    }

    // Build the sort option
    const sortOption = {};
    sortOption[sortField] = sortDirection;

    // Count total matching contacts
    const totalContacts = await Contact.countDocuments(query);
    const totalPages = Math.ceil(totalContacts / limit);

    // Fetch the contacts
    const contacts = await Contact.find(query).sort(sortOption).skip(skip).limit(limit);

    return {
        contacts,
        totalContacts,
        totalPages,
        currentPage: page,
    };
}

// Add contacts to a list
// Add contacts to a list
export async function addContactsToList(listId, brandId, userId, contacts, skipDuplicates = false) {
    await connectToDatabase();

    // Prepare contacts for insertion
    const contactsToInsert = contacts.map((contact) => ({
        ...contact,
        email: contact.email.toLowerCase().trim(),
        listId: new mongoose.Types.ObjectId(listId),
        brandId: new mongoose.Types.ObjectId(brandId),
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: new Date(),
        updatedAt: new Date(),
    }));

    let importResult = {
        total: contactsToInsert.length,
        imported: 0,
        skipped: 0,
    };

    // Always check for existing emails, regardless of skipDuplicates setting
    const existingEmails = new Set();
    const existingContacts = await Contact.find(
        {
            listId: new mongoose.Types.ObjectId(listId),
        },
        'email'
    );

    existingContacts.forEach((contact) => {
        existingEmails.add(contact.email.toLowerCase());
    });

    // Filter contacts based on duplicates
    const newContacts = [];
    const duplicateContacts = [];

    contactsToInsert.forEach((contact) => {
        if (existingEmails.has(contact.email.toLowerCase())) {
            duplicateContacts.push(contact);
        } else {
            // Add to our new set to also check for duplicates within the current batch
            if (!existingEmails.has(contact.email.toLowerCase())) {
                newContacts.push(contact);
                // Add to the set so we detect duplicates within the import itself
                existingEmails.add(contact.email.toLowerCase());
            } else {
                duplicateContacts.push(contact);
            }
        }
    });

    importResult.skipped = duplicateContacts.length;

    // If skipDuplicates is true, we'll add only the new contacts
    // If it's false and there are duplicates, we'll throw an error
    if (!skipDuplicates && duplicateContacts.length > 0) {
        throw {
            code: 11000,
            message: `Found ${duplicateContacts.length} duplicate emails. Set skipDuplicates to true to ignore them.`,
            duplicates: duplicateContacts.map((c) => c.email),
        };
    }

    // Insert the new contacts
    if (newContacts.length > 0) {
        try {
            const result = await Contact.insertMany(newContacts);
            importResult.imported = result.length;

            // Update the contact count in the list
            await ContactList.updateOne({ _id: new mongoose.Types.ObjectId(listId) }, { $inc: { contactCount: result.length }, updatedAt: new Date() });
        } catch (error) {
            console.error('Error inserting contacts:', error);
            throw error;
        }
    }

    return importResult;
}

// Delete contacts from a list
export async function deleteContactsFromList(listId, brandId, userId, contactIds) {
    await connectToDatabase();

    // Convert string IDs to ObjectIds
    const objectIds = contactIds.map((id) => new mongoose.Types.ObjectId(id));

    // Delete the contacts
    const result = await Contact.deleteMany({
        _id: { $in: objectIds },
        listId: new mongoose.Types.ObjectId(listId),
        brandId: new mongoose.Types.ObjectId(brandId),
        userId: new mongoose.Types.ObjectId(userId),
    });

    // Update the contact count in the list
    if (result.deletedCount > 0) {
        await ContactList.updateOne({ _id: new mongoose.Types.ObjectId(listId) }, { $inc: { contactCount: -result.deletedCount }, updatedAt: new Date() });
    }

    return {
        deletedCount: result.deletedCount,
    };
}

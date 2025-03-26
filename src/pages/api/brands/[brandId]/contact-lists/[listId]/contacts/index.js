import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import mongoose from 'mongoose';
import { getBrandById } from '@/services/brandService';

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
        const { brandId, listId } = req.query;

        if (!brandId || !listId) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        // Check if the brand belongs to the user
        const brand = await getBrandById(brandId);
        if (!brand) {
            return res.status(404).json({ message: 'Brand not found' });
        }

        if (brand.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized to access this brand' });
        }

        // Get the contact list schema and check if the list exists
        const ContactList =
            mongoose.models.ContactList ||
            mongoose.model(
                'ContactList',
                new mongoose.Schema({
                    name: String,
                    description: String,
                    brandId: mongoose.Schema.Types.ObjectId,
                    userId: mongoose.Schema.Types.ObjectId,
                    contactCount: { type: Number, default: 0 },
                    createdAt: { type: Date, default: Date.now },
                    updatedAt: { type: Date, default: Date.now },
                })
            );

        const contactList = await ContactList.findOne({
            _id: new mongoose.Types.ObjectId(listId),
            brandId: new mongoose.Types.ObjectId(brandId),
            userId: new mongoose.Types.ObjectId(userId),
        });

        if (!contactList) {
            return res.status(404).json({ message: 'Contact list not found' });
        }

        // Define Contact schema
        const Contact =
            mongoose.models.Contact ||
            mongoose.model(
                'Contact',
                new mongoose.Schema({
                    email: { type: String, required: true, lowercase: true, trim: true },
                    firstName: { type: String, trim: true },
                    lastName: { type: String, trim: true },
                    phone: { type: String, trim: true },
                    listId: mongoose.Schema.Types.ObjectId,
                    brandId: mongoose.Schema.Types.ObjectId,
                    userId: mongoose.Schema.Types.ObjectId,
                    createdAt: { type: Date, default: Date.now },
                    updatedAt: { type: Date, default: Date.now },
                })
            );

        // GET - Fetch contacts in a list
        if (req.method === 'GET') {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;
            const sortField = req.query.sort || 'email';
            const sortOrder = req.query.order === 'desc' ? -1 : 1;
            const search = req.query.search || '';

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
            sortOption[sortField] = sortOrder;

            // Count total matching contacts
            const totalContacts = await Contact.countDocuments(query);
            const totalPages = Math.ceil(totalContacts / limit);

            // Fetch the contacts
            const contacts = await Contact.find(query).sort(sortOption).skip(skip).limit(limit);

            return res.status(200).json({
                contacts,
                totalContacts,
                totalPages,
                currentPage: page,
            });
        }

        // POST - Add contacts to a list
        if (req.method === 'POST') {
            const { contacts: newContacts, skipDuplicates = false } = req.body;

            if (!newContacts || !Array.isArray(newContacts) || newContacts.length === 0) {
                return res.status(400).json({ message: 'No contacts provided' });
            }

            // Validate email addresses
            const invalidEmails = newContacts.filter((contact) => {
                return !contact.email || !contact.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
            });

            if (invalidEmails.length > 0) {
                return res.status(400).json({
                    message: 'Some contacts have invalid email addresses',
                    invalidEntries: invalidEmails,
                });
            }

            // Prepare contacts for insertion with brandId, listId, and userId
            const contactsToInsert = newContacts.map((contact) => ({
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

            // If skipDuplicates is true, check for existing emails
            if (skipDuplicates) {
                const existingEmails = new Set();

                // Get all existing emails in this list
                const existingContacts = await Contact.find(
                    {
                        listId: new mongoose.Types.ObjectId(listId),
                        brandId: new mongoose.Types.ObjectId(brandId),
                        userId: new mongoose.Types.ObjectId(userId),
                    },
                    'email'
                );

                existingContacts.forEach((contact) => {
                    existingEmails.add(contact.email.toLowerCase());
                });

                // Filter out duplicates
                const uniqueContacts = contactsToInsert.filter((contact) => {
                    const isDuplicate = existingEmails.has(contact.email.toLowerCase());
                    if (isDuplicate) {
                        importResult.skipped++;
                    }
                    return !isDuplicate;
                });

                // Insert only unique contacts
                if (uniqueContacts.length > 0) {
                    const result = await Contact.insertMany(uniqueContacts);
                    importResult.imported = result.length;

                    // Update the contact count in the list
                    await ContactList.updateOne({ _id: new mongoose.Types.ObjectId(listId) }, { $inc: { contactCount: result.length }, updatedAt: new Date() });
                }
            } else {
                // Insert all contacts (duplicates will be rejected by MongoDB if email has a unique index)
                try {
                    const result = await Contact.insertMany(contactsToInsert);
                    importResult.imported = result.length;

                    // Update the contact count in the list
                    await ContactList.updateOne({ _id: new mongoose.Types.ObjectId(listId) }, { $inc: { contactCount: result.length }, updatedAt: new Date() });
                } catch (error) {
                    if (error.code === 11000) {
                        // Duplicate key error
                        return res.status(400).json({
                            message: 'Duplicate emails found. Set skipDuplicates to true to ignore them.',
                            error: error.message,
                        });
                    }
                    throw error;
                }
            }

            return res.status(201).json(importResult);
        }

        // DELETE - Delete contacts from a list
        if (req.method === 'DELETE') {
            const { contactIds } = req.body;

            if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
                return res.status(400).json({ message: 'No contact IDs provided' });
            }

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

            return res.status(200).json({
                deletedCount: result.deletedCount,
            });
        }

        return res.status(405).json({ message: 'Method not allowed' });
    } catch (error) {
        console.error('Error handling contacts:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
}

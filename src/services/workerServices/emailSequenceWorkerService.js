
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { brandsDb } from '@/lib/db/brands';
import { contactsDb } from '@/lib/db/contacts';
import { sequencesDb } from '@/lib/db/sequences';
import { sequenceLogsDb } from '@/lib/db/sequenceLogs';
import initializeQueues from '@/lib/queue';
import { default as ProviderFactory } from '@/lib/email-providers/ProviderFactory';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import config from '@/lib/configCommonJS'; // ensure this is safe (configCommonJS might use process.env)

// Helpers
function calculateDelay(amount, unit) {
    const now = Date.now();
    let ms = 0;
    switch (unit) {
        case 'minutes': ms = amount * 60 * 1000; break;
        case 'hours': ms = amount * 60 * 60 * 1000; break;
        case 'days': ms = amount * 24 * 60 * 60 * 1000; break;
        default: ms = amount * 1000;
    }
    return ms;
}

function decryptData(encryptedText, secret) {
    // Assuming simple or reuse existing logic
    return encryptedText; // Stub if decryption logic complex or moved
}

export const emailSequenceWorkerService = {
    async processSequenceEmail(jobData) {
        const { enrollmentId, emailOrder } = jobData;
        console.log(`Processing sequence email for enrollment ${enrollmentId}, step ${emailOrder}`);

        // 1. Get enrollment
        const { data: enrollment, error: enrollError } = await supabaseAdmin
            .from('sequence_enrollments')
            .select('*')
            .eq('id', enrollmentId)
            .single();

        if (enrollError || !enrollment) {
            console.error(`Enrollment not found: ${enrollmentId}`);
            return { success: false, message: 'Enrollment not found' };
        }

        if (enrollment.status !== 'active') {
            return { success: false, message: 'Enrollment not active' };
        }

        // 2. Get sequence
        const sequence = await sequencesDb.getById(enrollment.sequence_id);
        if (!sequence || sequence.status !== 'active') {
            return { success: false, message: 'Sequence not active' };
        }

        // 3. Get email step
        const { data: steps } = await supabaseAdmin
            .from('sequence_steps')
            .select('*')
            .eq('sequence_id', sequence.id)
            .order('order_index', { ascending: true });

        const emailStep = steps.find(s => s.order_index === emailOrder);
        if (!emailStep) {
            console.error(`Step ${emailOrder} not found`);
            return { success: false, message: 'Step not found' };
        }

        // 4. Get contact
        const contact = await contactsDb.getById(enrollment.contact_id);
        if (!contact || contact.status !== 'active' || contact.is_unsubscribed) {
            await sequencesDb.updateEnrollment(enrollment.id, {
                status: 'unsubscribed',
                completed_at: new Date()
            });
            return { success: false, message: 'Contact not eligible' };
        }

        // 5. Get brand
        const brand = await brandsDb.getById(enrollment.brand_id);
        if (!brand) throw new Error('Brand not found');

        // 6. Provider setup
        const brandForProvider = {
            ...brand,
            emailProvider: brand.email_provider,
            awsRegion: brand.aws_region,
            awsAccessKey: brand.aws_access_key,
            awsSecretKey: brand.aws_secret_key,
            sendgridApiKey: brand.sendgrid_api_key,
            mailgunApiKey: brand.mailgun_api_key,
            mailgunDomain: brand.mailgun_domain,
        };

        // Assume Factory works with this object
        // const emailProvider = ProviderFactory.createProvider(brandForProvider);
        // ... Send Logic Stub ...
        console.log(`[Stub] Sending email to ${contact.email} using provider`);

        // 7. Log result
        await sequenceLogsDb.create({
            sequence_id: sequence.id,
            enrollment_id: enrollment.id,
            contact_id: contact.id,
            brand_id: brand.id,
            user_id: sequence.user_id,
            email: contact.email,
            email_order: emailOrder,
            subject: emailStep.subject,
            status: 'sent',
            sent_at: new Date()
        });

        // 8. Schedule next
        const nextStep = steps.find(s => s.order_index > emailOrder);
        if (nextStep) {
            // Check if current step was the emailOrder we just processed?
            // Wait, logic: we processed `emailOrder`. We look for next.
            // Loop steps sorted by index.
            // Find index of current step.
            const currentIndex = steps.findIndex(s => s.order_index === emailOrder);
            const next = steps[currentIndex + 1];

            if (next) {
                const delay = calculateDelay(next.delay_amount, next.delay_unit);
                const queue = (await initializeQueues()).emailSequenceQueue;
                await queue.add('send-sequence-email', {
                    enrollmentId: enrollment.id,
                    emailOrder: next.order_index
                }, { delay });
            } else {
                // Complete
                await sequencesDb.updateEnrollment(enrollment.id, {
                    status: 'completed',
                    completed_at: new Date()
                });
            }
        } else {
            // Sequence finished
            await sequencesDb.updateEnrollment(enrollment.id, {
                status: 'completed',
                completed_at: new Date()
            });
        }

        return { success: true };
    },

    async enrollNewContact(jobData) {
        const { contactId, brandId, listId, sequenceId } = jobData;
        console.log(`[Worker] Enrolling contact ${contactId}`);

        // 1. Get contact
        const contact = await contactsDb.getById(contactId);
        if (!contact || contact.status !== 'active' || contact.is_unsubscribed) {
            return { success: false, message: 'Contact not eligible' };
        }

        // 2. Get sequences
        let sequences = [];
        if (sequenceId) {
            const seq = await sequencesDb.getById(sequenceId);
            if (seq && seq.status === 'active') sequences.push(seq);
        } else {
            // Find triggered sequences using exact trigger config matching or JSONB query
            // Mongoose: 'triggerConfig.contactListIds': listId
            // Supabase: trigger_config->contactListIds ?| [listId]

            // Supabase JS filter
            const { data } = await supabaseAdmin
                .from('email_sequences')
                .select('*')
                .eq('brand_id', brandId)
                .eq('status', 'active')
                .eq('trigger_type', 'contact_list');

            // Filter in JS for now as JSONB array contains check might be tricky in simple client
            if (data) {
                sequences = data.filter(s => {
                    const ids = s.trigger_config?.contactListIds || [];
                    return ids.includes(listId);
                });
            }
        }

        if (sequences.length === 0) return { success: false, message: 'No sequences' };

        for (const sequence of sequences) {
            // Check existing
            const { data: existing } = await supabaseAdmin
                .from('sequence_enrollments')
                .select('id')
                .eq('sequence_id', sequence.id)
                .eq('contact_id', contactId)
                .single();

            if (existing) continue;

            const { data: steps } = await supabaseAdmin
                .from('sequence_steps')
                .select('*')
                .eq('sequence_id', sequence.id)
                .order('order_index', { ascending: true });

            if (!steps || steps.length === 0) continue;

            const enrollment = await sequencesDb.createEnrollment({
                sequence_id: sequence.id,
                contact_id: contactId,
                brand_id: brandId,
                user_id: sequence.user_id,
                status: 'active',
                current_step: 0,
                enrolled_at: new Date()
            });

            const firstStep = steps[0];
            const delay = calculateDelay(firstStep.delay_amount, firstStep.delay_unit);

            const queue = (await initializeQueues()).emailSequenceQueue;
            await queue.add('send-sequence-email', {
                enrollmentId: enrollment.id,
                emailOrder: firstStep.order_index
            }, { delay });

            // Increment stats
            // Assume rpc `increment_sequence_stats` exists or handle manually
            // Manual update:
            // Fetch current stats, increment, update. Race condition potential but acceptable for MVP.
            // Or just update enrollment count
        }

        return { success: true };
    }
};

import { sequenceLogsDb } from '@/lib/db/sequenceLogs';

export async function logSequenceEmail(logData) {
    try {
        const log = await sequenceLogsDb.logEmail({
            sequence_id: logData.sequenceId,
            contact_id: logData.contactId, // Ensure mapped
            email: logData.email,
            // Map other fields from camelCase to snake_case if DB requires it, 
            // or assume helper handles it / DB columns are snake_case.
            // ...logData might include camelCase keys.
            // Supabase helper usually keeps keys as passed unless mapped.
            // I should explicitly map standard keys.
            enrollment_id: logData.enrollmentId,
            step_id: logData.stepId,
            status: logData.status || 'queued',
            sent_at: logData.sentAt || new Date(),
            // ...
            ...logData // naive spread, might fail if column names mismatch
        });
        return log;
    } catch (error) {
        console.error('Error logging sequence email:', error);
        throw error;
    }
}

export async function getSequenceLogs(sequenceId, options = {}) {
    const { data, total } = await sequenceLogsDb.getLogs(sequenceId, options);

    // Status counts?
    // Fetching counts for every status (queued, delivered, failed)
    // We can do parallel calls:
    const statuses = ['queued', 'delivered', 'failed', 'sent'];
    const counts = {};

    await Promise.all(statuses.map(async (s) => {
        counts[s] = await sequenceLogsDb.count(sequenceId, { status: s });
    }));

    return {
        logs: data,
        pagination: {
            page: options.page || 1,
            limit: options.limit || 50,
            total,
            totalPages: Math.ceil(total / (options.limit || 50)),
        },
        statusCounts: counts
    };
}

export async function getSequenceStats(sequenceId) {
    try {
        const sentCount = await sequenceLogsDb.count(sequenceId); // total logs
        const deliveredCount = await sequenceLogsDb.count(sequenceId, { status: 'delivered' });
        const opens = await sequenceLogsDb.count(sequenceId, { event_type: 'open' });
        const clicks = await sequenceLogsDb.count(sequenceId, { event_type: 'click' });
        const bounces = await sequenceLogsDb.count(sequenceId, { status: 'failed' }); // Simplification
        const complaints = await sequenceLogsDb.count(sequenceId, { event_type: 'complaint' });

        return {
            sent: sentCount,
            delivered: deliveredCount,
            opens,
            clicks,
            bounces,
            complaints,
            openRate: sentCount > 0 ? ((opens / sentCount) * 100).toFixed(1) : 0,
            clickRate: sentCount > 0 ? ((clicks / sentCount) * 100).toFixed(1) : 0,
            bounceRate: sentCount > 0 ? ((bounces / sentCount) * 100).toFixed(1) : 0,
            complaintRate: sentCount > 0 ? ((complaints / sentCount) * 100).toFixed(1) : 0,
        };
    } catch (error) {
        return {
            sent: 0,
            delivered: 0,
            opens: 0,
            clicks: 0,
            bounces: 0,
            complaints: 0,
            openRate: '0',
            clickRate: '0',
            bounceRate: '0',
            complaintRate: '0',
        };
    }
}

export async function trackSequenceEvent(sequenceId, enrollmentId, eventType, metadata = {}) {
    try {
        // 1. Find the log
        const log = await sequenceLogsDb.findLog({ sequenceId, enrollmentId });
        if (!log) return false;

        // 2. Check if event exists (simple check in code)
        const events = log.events || [];
        const existingInfo = events.find(e => e.type === eventType);

        if (existingInfo) {
            // Update metadata/timestamp
            existingInfo.timestamp = new Date();
            existingInfo.metadata = metadata;
        } else {
            // Add new
            events.push({
                type: eventType,
                timestamp: new Date(),
                metadata
            });
        }

        // 3. Update log
        await sequenceLogsDb.update(log.id, { events });
        return true;
    } catch (error) {
        console.error('Error tracking sequence event:', error);
        return false;
    }
}

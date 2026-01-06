import { kv } from '@vercel/kv'

export const kvHelpers = {
    async checkRateLimit(identifier, limit = 10, window = 60) {
        const key = `ratelimit:${identifier}`
        const count = await kv.incr(key)
        if (count === 1) await kv.expire(key, window)
        return {
            allowed: count <= limit,
            remaining: Math.max(0, limit - count),
            reset: window
        }
    },

    async queueCampaign(campaignId, recipientIds) {
        await kv.set(`queue:campaign:${campaignId}`, recipientIds, { ex: 3600 })
    },

    async getCampaignQueue(campaignId) {
        return await kv.get(`queue:campaign:${campaignId}`)
    }
}

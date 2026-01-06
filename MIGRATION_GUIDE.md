# 🚀 MAILLAYER SUPABASE MIGRATION GUIDE

**Complete step-by-step guide to migrate from MongoDB + NextAuth + Redis to Supabase + Vercel KV**

Last Updated: January 6, 2026 | Created by: Comet AI Assistant

---

## 📋 WHAT'S BEEN COMPLETED

✅ **Supabase Database Schema** - `supabase-schema.sql` created and run in Supabase  
✅ **Supabase Client** - `/src/lib/supabase.js` created in repo

---

## 🎯 TODO CHECKLIST

### Phase 1: Core Setup (Tomorrow Morning)
- [ ] 1. Install dependencies
- [ ] 2. Create auth.js
- [ ] 3. Create kv.js  
- [ ] 4. Create db helper files
- [ ] 5. Set environment variables

### Phase 2: Migration
- [/] 6. Migrate API routes
- [ ] 7. Update auth pages
- [ ] 8. Replace Mongoose imports
- [ ] 9. Test features

### Phase 3: Theme
- [ ] 10. Convert to light mode

---

## 📦 STEP 1: INSTALL DEPENDENCIES

### Remove:
```bash
npm uninstall mongoose next-auth ioredis bull bcrypt
```

### Install:
```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs @supabase/auth-helpers-react @vercel/kv
```

---

## 🔐 STEP 2: `/src/lib/auth.js`

```javascript
import { supabase, supabaseAdmin } from './supabase'

export const authHelpers = {
  async signUp(email, password, name) {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { name } }
    })
    if (error) return { data: null, error }
    
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id, name, role: 'user'
      })
    }
    return { data, error: null }
  },

  async signIn(email, password) {
    return await supabase.auth.signInWithPassword({ email, password })
  },

  async signOut() {
    return await supabase.auth.signOut()
  },

  async getUser() {
    return await supabase.auth.getUser()
  }
}

export async function getUserFromRequest(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return { user: null, error: new Error('No token') }
  return await supabaseAdmin.auth.getUser(token)
}

export function requireAuth(handler) {
  return async (req, res) => {
    const { user, error } = await getUserFromRequest(req)
    if (error || !user) return res.status(401).json({ error: 'Unauthorized' })
    req.user = user
    return handler(req, res)
  }
}
```

---

## ⚡ STEP 3: `/src/lib/kv.js`

```javascript
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
```

---

## 🗄️ STEP 4: `/src/lib/db/brands.js`

```javascript
import { supabase } from '../supabase'

export const brandsDb = {
  async getByUserId(userId) {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async getById(brandId) {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .single()
    if (error) throw error
    return data
  },

  async create(userId, brandData) {
    const { data, error } = await supabase
      .from('brands')
      .insert({ ...brandData, user_id: userId })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(brandId, updates) {
    const { data, error } = await supabase
      .from('brands')
      .update(updates)
      .eq('id', brandId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(brandId) {
    const { error } = await supabase.from('brands').delete().eq('id', brandId)
    if (error) throw error
  }
}
```

---

## 📇 STEP 5: `/src/lib/db/contacts.js`

```javascript
import { supabase } from '../supabase'

export const contactsDb = {
  async getByBrandId(brandId, { limit = 50, offset = 0, search = '' } = {}) {
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
    }

    const { data, error, count } = await query
    if (error) throw error
    return { data, total: count }
  },

  async getById(contactId) {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single()
    if (error) throw error
    return data
  },

  async create(brandId, userId, contactData) {
    const { data, error } = await supabase
      .from('contacts')
      .insert({ ...contactData, brand_id: brandId, user_id: userId })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(contactId, updates) {
    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', contactId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(contactId) {
    const { error } = await supabase.from('contacts').delete().eq('id', contactId)
    if (error) throw error
  },

  async addToList(contactId, listId) {
    const { error } = await supabase
      .from('contact_list_memberships')
      .insert({ contact_id: contactId, contact_list_id: listId })
    if (error) throw error
  }
}
```

---

## 📧 STEP 6: `/src/lib/db/campaigns.js`

```javascript
import { supabase } from '../supabase'

export const campaignsDb = {
  async getByBrandId(brandId) {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async getById(campaignId) {
    const { data, error} = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()
    if (error) throw error
    return data
  },

  async create(brandId, userId, campaignData) {
    const { data, error } = await supabase
      .from('campaigns')
      .insert({ ...campaignData, brand_id: brandId, user_id: userId })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(campaignId, updates) {
    const { data, error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', campaignId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async updateStats(campaignId, stats) {
    const { error } = await supabase
      .from('campaigns')
      .update(stats)
      .eq('id', campaignId)
    if (error) throw error
  }
}
```

---

## 🔄 STEP 7: `/src/lib/db/sequences.js`

```javascript
import { supabase } from '../supabase'

export const sequencesDb = {
  async getByBrandId(brandId) {
    const { data, error } = await supabase
      .from('email_sequences')
      .select(`
        *,
        sequence_steps (*)
      `)
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async getById(sequenceId) {
    const { data, error } = await supabase
      .from('email_sequences')
      .select(`
        *,
        sequence_steps (*)
      `)
      .eq('id', sequenceId)
      .single()
    if (error) throw error
    return data
  },

  async create(brandId, userId, sequenceData) {
    const { data, error } = await supabase
      .from('email_sequences')
      .insert({ ...sequenceData, brand_id: brandId, user_id: userId })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async createStep(sequenceId, stepData) {
    const { data, error } = await supabase
      .from('sequence_steps')
      .insert({ ...stepData, sequence_id: sequenceId })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async enrollContact(sequenceId, contactId) {
    const { data, error } = await supabase
      .from('sequence_enrollments')
      .insert({ sequence_id: sequenceId, contact_id: contactId, status: 'active' })
      .select()
      .single()
    if (error) throw error
    return data
  }
}
```

---

## 🎨 STEP 8: LIGHT MODE THEME

Update `/src/styles/globals.scss`:

```scss
// Replace dark colors with light
$white: #ffffff;
$light-bg: #fafafa;
$light-100: #f5f5f5;
$light-300: #e0e0e0;
$light-900: #212121;

// Update body
body {
  background: $light-bg;
  color: $light-900;
}

// Update surfaces
.card, .modal, .sidebar {
  background: $white;
  color: $light-900;
}
```

---

## 🔧 STEP 9: EXAMPLE API ROUTE MIGRATION

### Before (Mongoose):
```javascript
import Brand from '@/models/Brand'

export default async function handler(req, res) {
  const brands = await Brand.find({ userId: req.user.id })
  res.json(brands)
}
```

### After (Supabase):
```javascript
import { brandsDb } from '@/lib/db/brands'
import { requireAuth } from '@/lib/auth'

export default requireAuth(async (req, res) => {
  const brands = await brandsDb.getByUserId(req.user.id)
  res.json(brands)
})
```

---

## ✅ FINAL CHECKLIST

- [ ] All files created
- [ ] Dependencies installed
- [ ] Environment variables set
- [ ] API routes migrated
- [ ] Auth pages updated
- [ ] Theme converted to light
- [ ] Local testing complete
- [ ] Deploy to Vercel

---

## 🆘 NEED HELP?

Refer to:
- Supabase docs: https://supabase.com/docs
- Vercel KV docs: https://vercel.com/docs/storage/vercel-kv
- Your supabase-schema.sql file for table structures

---

**Created: January 6, 2026 at 9 PM SGT**  
**Ready for implementation tomorrow!** 🚀

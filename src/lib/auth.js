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

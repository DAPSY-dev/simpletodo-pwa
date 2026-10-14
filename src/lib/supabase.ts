import { createClient } from '@supabase/supabase-js'
import type { AuthSession } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)
const client = isSupabaseConfigured ? createClient(url, anonKey) : null
type BrowserAuth = {
  getSession: () => Promise<{ data: { session: AuthSession | null } }>
  onAuthStateChange: (callback: (event: string, session: AuthSession | null) => void) => {
    data: { subscription: { unsubscribe: () => void } }
  }
  signInWithPassword: (credentials: {
    email: string
    password: string
  }) => Promise<{ data: { session: AuthSession | null }; error: Error | null }>
  signUp: (credentials: {
    email: string
    password: string
    options?: { data?: Record<string, unknown> }
  }) => Promise<{ data: { session: AuthSession | null }; error: Error | null }>
  updateUser: (attributes: {
    data?: Record<string, unknown>
    email?: string
    password?: string
  }) => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
}
export const supabase = client as typeof client extends null
  ? null
  : typeof client & { auth: BrowserAuth }

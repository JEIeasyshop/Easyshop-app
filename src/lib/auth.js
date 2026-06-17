// src/lib/auth.js
import { supabase } from './supabaseClient'

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// Role from user_metadata (set via SQL: raw_user_meta_data = '{"role":"owner"}')
export function getUserRole(session) {
  return session?.user?.user_metadata?.role || 'admin'
}

export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => subscription.unsubscribe()
}

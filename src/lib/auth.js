// lib/auth.js
import { supabase } from './supabaseClient';

// Real email/password auth. RLS policies (auth.uid() is not null) now
// gate access to actual credentialed users — not anyone who calls a
// public anonymous sign-in endpoint.

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Returns 'owner' or 'admin' from the current session's user metadata.
// Defaults to 'admin' (least privilege) if role is not set.
export function getUserRole(session) {
  return session?.user?.user_metadata?.role || 'admin';
}

// Subscribe to auth state changes (login/logout). Returns an
// unsubscribe function.
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => subscription.unsubscribe();
}



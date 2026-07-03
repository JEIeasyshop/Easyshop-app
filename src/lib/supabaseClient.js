// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'
import { useState, useEffect } from 'react'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnon)

// ── Keep-alive ping ──────────────────────────────────────
// Supabase free tier pauses after 7 days of inactivity.
// This pings the DB every 4 days while the app is open,
// and also once immediately on app load.
const PING_INTERVAL_MS = 4 * 24 * 60 * 60 * 1000 // 4 days

async function pingSupabase() {
  try {
    // Lightweight read — just fetch 1 row from orders
    await supabase.from('orders').select('id').limit(1)
  } catch (_) {
    // Silently ignore — app still works even if ping fails
  }
}

export function useKeepAlive() {
  useEffect(() => {
    pingSupabase() // immediate ping on mount
    const timer = setInterval(pingSupabase, PING_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])
}

// ── Live activity ticker ─────────────────────────────────
// Shows a live timestamp + order count in the header so
// the app always looks "live" even during quiet periods.
export function useLiveTicker(orders = []) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const pad  = n => String(n).padStart(2, '0')
  const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`
  const dateStr = time.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })

  return { timeStr, dateStr, orderCount: orders.length }
}

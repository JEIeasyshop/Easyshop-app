// src/lib/data.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'

// ── Stage definitions ────────────────────────────────────
export const STAGE_LABELS = {
  1: 'Ordered',
  2: 'Arrived at warehouse',
  3: 'Sent to destination',
  4: 'Received at destination',
  5: 'Sent to customer',
  6: 'Received by customer',
}

export function getStageLabel(serviceType, stage) {
  return STAGE_LABELS[stage] || 'Unknown'
}

export function getStageSequence(serviceType) {
  return serviceType === 'full_service' ? [1, 2, 3, 4, 5, 6] : [2, 3, 4, 5, 6]
}

export function isFinalStage(order, trackingRow) {
  if (!trackingRow) return false
  const seq = getStageSequence(order.service_type)
  return trackingRow.current_stage === seq[seq.length - 1]
}

// ── Main hook ────────────────────────────────────────────
export function useAppData() {
  const [orders, setOrders]             = useState([])
  const [tracking, setTracking]         = useState([])
  const [invoices, setInvoices]         = useState([])
  const [completedOrders, setCompleted] = useState([])
  const [carriers, setCarriers]         = useState([])
  const [customers, setCustomers]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)

  // Full reload from DB
  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [o, t, inv, c, car, cust] = await Promise.all([
        supabase.from('orders').select('*').order('order_date', { ascending: false }),
        supabase.from('tracking_status').select('*'),
        supabase.from('invoices').select('*'),
        supabase.from('completed_orders').select('*').order('completed_at', { ascending: false }),
        supabase.from('carriers').select('*').eq('active', true),
        supabase.from('customers').select('*').order('name'),
      ])
      if (o.error)    throw o.error
      if (t.error)    throw t.error
      if (inv.error)  throw inv.error
      if (c.error)    throw c.error
      if (car.error)  throw car.error
      if (cust.error) throw cust.error

      setOrders(o.data      || [])
      setTracking(t.data    || [])
      setInvoices(inv.data  || [])
      setCompleted(c.data   || [])
      setCarriers(car.data  || [])
      setCustomers(cust.data || [])
    } catch (err) {
      console.error('useAppData reload:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  // Optimistic local patch — avoids full reload for small writes (JEI pattern)
  const patchOrder = useCallback((id, patch) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o))
  }, [])

  const patchInvoice = useCallback((orderId, patch) => {
    setInvoices(prev => prev.map(inv =>
      inv.order_id === orderId ? { ...inv, ...patch } : inv
    ))
  }, [])

  // ── ORDERS ───────────────────────────────────────────────
  const addOrder = useCallback(async (orderData) => {
    const { data, error } = await supabase.from('orders').insert(orderData).select().single()
    if (error) throw error

    // Auto-create tracking row — start stage depends on service type
    const startStage = orderData.service_type === 'full_service' ? 1 : 2
    const { error: te } = await supabase.from('tracking_status').insert({
      order_id:      data.id,
      current_stage: startStage,
      stage_history: [{ stage: startStage, timestamp: new Date().toISOString() }],
    })
    if (te) throw te

    // Auto-create empty invoice row so it's ready to populate
    const { error: ie } = await supabase.from('invoices').insert({
      order_id:         data.id,
      base_price:       data.computed_total || 0,
      additional_costs: data.additional_costs || [],
      total:            data.computed_total || 0,
      currency:         data.computed_currency || data.rate_currency || 'USD',
    })
    if (ie) throw ie

    await reload()
    return data
  }, [reload])

  const updateOrder = useCallback(async (id, updates) => {
    const { error } = await supabase.from('orders')
      .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
    patchOrder(id, updates)
  }, [patchOrder])

  // ── TRACKING ─────────────────────────────────────────────
  const updateTracking = useCallback(async (orderId, updates) => {
    const { error } = await supabase.from('tracking_status')
      .update({ ...updates, updated_at: new Date().toISOString() }).eq('order_id', orderId)
    if (error) throw error
    // Optimistic update tracking state
    setTracking(prev => prev.map(t =>
      t.order_id === orderId ? { ...t, ...updates } : t
    ))
  }, [])

  const advanceStage = useCallback(async (orderId, newStage, note = '') => {
    const current = tracking.find(t => t.order_id === orderId)
    if (!current) throw new Error('Tracking record not found')
    const newHistory = [
      ...(current.stage_history || []),
      { stage: newStage, timestamp: new Date().toISOString(), note },
    ]
    await updateTracking(orderId, { current_stage: newStage, stage_history: newHistory })
  }, [tracking, updateTracking])

  // ── INVOICES ─────────────────────────────────────────────
  const upsertInvoice = useCallback(async (orderId, invoiceData) => {
    const { data, error } = await supabase.from('invoices').upsert(
      { order_id: orderId, ...invoiceData, updated_at: new Date().toISOString() },
      { onConflict: 'order_id' }
    ).select().single()
    if (error) throw error
    patchInvoice(orderId, invoiceData)
    return data
  }, [patchInvoice])

  // Add a cost line to an invoice (optimistic, no full reload)
  const addInvoiceCost = useCallback(async (orderId, description, amount, currency = 'USD') => {
    const invoice  = invoices.find(inv => inv.order_id === orderId)
    const existing = invoice?.additional_costs || []
    const newCosts = [...existing, { description, amount: parseFloat(amount), currency }]
    const newTotal = (invoice?.base_price || 0) + newCosts.reduce((s, c) => s + Number(c.amount), 0)
    await upsertInvoice(orderId, {
      base_price:       invoice?.base_price || 0,
      additional_costs: newCosts,
      total:            newTotal,
      currency:         invoice?.currency || 'USD',
    })
  }, [invoices, upsertInvoice])

  // Update base price on invoice (called when completing to lock computed total)
  const lockInvoiceTotal = useCallback(async (orderId, total, currency, usdRate = null, sgdRate = null) => {
    const invoice  = invoices.find(inv => inv.order_id === orderId)
    const extras   = invoice?.additional_costs || []
    const extraAmt = extras.reduce((s, c) => s + Number(c.amount), 0)
    await upsertInvoice(orderId, {
      base_price:       total - extraAmt,
      additional_costs: extras,
      total,
      currency,
      ...(usdRate != null ? { usd_rate: usdRate } : {}),
      ...(sgdRate != null ? { sgd_rate: sgdRate } : {}),
    })
  }, [invoices, upsertInvoice])

  // ── COMPLETE ORDER ────────────────────────────────────────
  // Mirrors JEI: snapshot everything → insert completed_orders → delete active rows
  const completeOrder = useCallback(async (orderId) => {
    const order      = orders.find(o => o.id === orderId)
    const trackingRow = tracking.find(t => t.order_id === orderId)
    const invoiceRow  = invoices.find(i => i.order_id === orderId)
    if (!order) throw new Error('Order not found')

    // Insert denormalised snapshot (historical record stable even if schema changes)
    const { error: ie } = await supabase.from('completed_orders').insert({
      original_order_id: orderId,
      order_snapshot:    order,
      tracking_snapshot: trackingRow || null,
      invoice_snapshot:  invoiceRow  || null,
    })
    if (ie) throw ie

    // Remove from all active tables (FK cascade handles tracking + invoices,
    // but explicit deletes for clarity)
    await supabase.from('invoices').delete().eq('order_id', orderId)
    await supabase.from('tracking_status').delete().eq('order_id', orderId)
    const { error: de } = await supabase.from('orders').delete().eq('id', orderId)
    if (de) throw de

    await reload()
  }, [orders, tracking, invoices, reload])

  // Revert completed → back to active (JEI pattern: sets completed=false)
  // For our snapshot model: re-insert order/tracking/invoice from snapshot
  const revertCompleted = useCallback(async (completedId) => {
    const rec = completedOrders.find(c => c.id === completedId)
    if (!rec) throw new Error('Completed record not found')

    const { order_snapshot: o, tracking_snapshot: t, invoice_snapshot: inv } = rec

    // Re-insert order (strip id so DB generates new or keep original)
    const { error: oe } = await supabase.from('orders').insert({
      ...o, updated_at: new Date().toISOString()
    })
    if (oe) throw oe

    if (t) {
      await supabase.from('tracking_status').insert({
        ...t, updated_at: new Date().toISOString()
      })
    }
    if (inv) {
      await supabase.from('invoices').insert({
        ...inv, updated_at: new Date().toISOString()
      })
    }

    // Delete from completed
    await supabase.from('completed_orders').delete().eq('id', completedId)
    await reload()
  }, [completedOrders, reload])

  // Permanent delete from completed
  const deleteCompleted = useCallback(async (completedId) => {
    const { error } = await supabase.from('completed_orders').delete().eq('id', completedId)
    if (error) throw error
    setCompleted(prev => prev.filter(c => c.id !== completedId))
  }, [])

  // Cleanup auto-expired completed orders (run on mount)
  const cleanupExpired = useCallback(async () => {
    await supabase.from('completed_orders')
      .delete().lt('auto_delete_after', new Date().toISOString())
    await reload()
  }, [reload])

  // ── CUSTOMERS ─────────────────────────────────────────────
  const addCustomer = useCallback(async (customerData) => {
    const { data, error } = await supabase.from('customers')
      .insert(customerData).select().single()
    if (error) throw error
    setCustomers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }, [])

  const updateCustomer = useCallback(async (id, updates) => {
    const { error } = await supabase.from('customers')
      .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
  }, [])

  const deleteCustomer = useCallback(async (id) => {
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) throw error
    setCustomers(prev => prev.filter(c => c.id !== id))
  }, [])

  return {
    // Data
    orders, tracking, invoices, completedOrders, carriers, customers,
    loading, error,
    // Core
    reload, patchOrder, patchInvoice,
    // Orders
    addOrder, updateOrder,
    // Tracking
    updateTracking, advanceStage,
    // Invoices
    upsertInvoice, addInvoiceCost, lockInvoiceTotal,
    // Complete / archive
    completeOrder, revertCompleted, deleteCompleted, cleanupExpired,
    // Customers
    addCustomer, updateCustomer, deleteCustomer,
  }
}

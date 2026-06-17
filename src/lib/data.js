// src/lib/data.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'

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

export function useAppData() {
  const [orders, setOrders]               = useState([])
  const [tracking, setTracking]           = useState([])
  const [invoices, setInvoices]           = useState([])
  const [completedOrders, setCompleted]   = useState([])
  const [carriers, setCarriers]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [o, t, inv, c, car] = await Promise.all([
        supabase.from('orders').select('*').order('order_date', { ascending: false }),
        supabase.from('tracking_status').select('*'),
        supabase.from('invoices').select('*'),
        supabase.from('completed_orders').select('*').order('completed_at', { ascending: false }),
        supabase.from('carriers').select('*').eq('active', true),
      ])
      if (o.error)   throw o.error
      if (t.error)   throw t.error
      if (inv.error) throw inv.error
      if (c.error)   throw c.error
      if (car.error) throw car.error

      setOrders(o.data   || [])
      setTracking(t.data || [])
      setInvoices(inv.data || [])
      setCompleted(c.data  || [])
      setCarriers(car.data || [])
    } catch (err) {
      console.error('useAppData:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  // ── Orders ──────────────────────────────────────────────
  const addOrder = useCallback(async (orderData) => {
    const { data, error } = await supabase.from('orders').insert(orderData).select().single()
    if (error) throw error

    const startStage = orderData.service_type === 'full_service' ? 1 : 2
    const { error: te } = await supabase.from('tracking_status').insert({
      order_id: data.id,
      current_stage: startStage,
      stage_history: [{ stage: startStage, timestamp: new Date().toISOString() }],
    })
    if (te) throw te

    await reload()
    return data
  }, [reload])

  const updateOrder = useCallback(async (id, updates) => {
    const { error } = await supabase.from('orders')
      .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
    await reload()
  }, [reload])

  // ── Tracking ─────────────────────────────────────────────
  const updateTracking = useCallback(async (orderId, updates) => {
    const { error } = await supabase.from('tracking_status')
      .update({ ...updates, updated_at: new Date().toISOString() }).eq('order_id', orderId)
    if (error) throw error
    await reload()
  }, [reload])

  const advanceStage = useCallback(async (orderId, newStage, note = '') => {
    const current = tracking.find(t => t.order_id === orderId)
    if (!current) throw new Error('Tracking record not found')
    const newHistory = [
      ...(current.stage_history || []),
      { stage: newStage, timestamp: new Date().toISOString(), note },
    ]
    await updateTracking(orderId, { current_stage: newStage, stage_history: newHistory })
  }, [tracking, updateTracking])

  // ── Invoices ─────────────────────────────────────────────
  const upsertInvoice = useCallback(async (orderId, invoiceData) => {
    const { error } = await supabase.from('invoices').upsert(
      { order_id: orderId, ...invoiceData, updated_at: new Date().toISOString() },
      { onConflict: 'order_id' }
    )
    if (error) throw error
    await reload()
  }, [reload])

  const addAdditionalCost = useCallback(async (orderId, description, amount) => {
    const invoice     = invoices.find(inv => inv.order_id === orderId)
    const existing    = invoice?.additional_costs || []
    const newCosts    = [...existing, { description, amount }]
    const newTotal    = (invoice?.base_price || 0) + newCosts.reduce((s, c) => s + Number(c.amount), 0)
    await upsertInvoice(orderId, {
      base_price: invoice?.base_price || 0,
      additional_costs: newCosts,
      total: newTotal,
    })
  }, [invoices, upsertInvoice])

  // ── Complete order ────────────────────────────────────────
  const completeOrder = useCallback(async (orderId) => {
    const order      = orders.find(o => o.id === orderId)
    const trackingRow = tracking.find(t => t.order_id === orderId)
    const invoiceRow  = invoices.find(i => i.order_id === orderId)
    if (!order) throw new Error('Order not found')

    const { error: ie } = await supabase.from('completed_orders').insert({
      original_order_id: orderId,
      order_snapshot:    order,
      tracking_snapshot: trackingRow || null,
      invoice_snapshot:  invoiceRow  || null,
    })
    if (ie) throw ie

    await supabase.from('invoices').delete().eq('order_id', orderId)
    await supabase.from('tracking_status').delete().eq('order_id', orderId)
    await supabase.from('orders').delete().eq('id', orderId)
    await reload()
  }, [orders, tracking, invoices, reload])

  const cleanupExpired = useCallback(async () => {
    await supabase.from('completed_orders').delete().lt('auto_delete_after', new Date().toISOString())
    await reload()
  }, [reload])

  return {
    orders, tracking, invoices, completedOrders, carriers,
    loading, error, reload,
    addOrder, updateOrder,
    updateTracking, advanceStage,
    upsertInvoice, addAdditionalCost,
    completeOrder, cleanupExpired,
  }
}

// lib/data.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

const STAGE_LABELS_FULL = {
  1: 'Ordered',
  2: 'Package arrived in warehouse',
  3: 'Package sent to destination',
  4: 'Received in destination',
  5: 'Sent to customer',
  6: 'Received by customer',
};

// shipping_only skips stage 1 — same labels, just starts at 2
const STAGE_LABELS_SHIPPING_ONLY = {
  2: STAGE_LABELS_FULL[2],
  3: STAGE_LABELS_FULL[3],
  4: STAGE_LABELS_FULL[4],
  5: STAGE_LABELS_FULL[5],
  6: STAGE_LABELS_FULL[6],
};

export function getStageLabel(serviceType, stage) {
  const map = serviceType === 'full_service' ? STAGE_LABELS_FULL : STAGE_LABELS_SHIPPING_ONLY;
  return map[stage] || 'Unknown';
}

export function getStageSequence(serviceType) {
  return serviceType === 'full_service' ? [1, 2, 3, 4, 5, 6] : [2, 3, 4, 5, 6];
}

export function useAppData() {
  const [orders, setOrders] = useState([]);
  const [tracking, setTracking] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [pricingRates, setPricingRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, trackingRes, invoicesRes, completedRes, carriersRes, ratesRes] = await Promise.all([
        supabase.from('orders').select('*').order('order_date', { ascending: false }),
        supabase.from('tracking_status').select('*'),
        supabase.from('invoices').select('*'),
        supabase.from('completed_orders').select('*').order('completed_at', { ascending: false }),
        supabase.from('carriers').select('*').eq('active', true),
        supabase.from('pricing_rates').select('*').eq('active', true),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (trackingRes.error) throw trackingRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (completedRes.error) throw completedRes.error;
      if (carriersRes.error) throw carriersRes.error;
      if (ratesRes.error) throw ratesRes.error;

      setOrders(ordersRes.data || []);
      setTracking(trackingRes.data || []);
      setInvoices(invoicesRes.data || []);
      setCompletedOrders(completedRes.data || []);
      setCarriers(carriersRes.data || []);
      setPricingRates(ratesRes.data || []);
    } catch (err) {
      console.error('useAppData reload error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // --- ORDERS ---
  const addOrder = useCallback(async (orderData) => {
    const { data, error } = await supabase.from('orders').insert(orderData).select().single();
    if (error) throw error;

    // auto-create tracking row, starting stage depends on service_type
    const startStage = orderData.service_type === 'full_service' ? 1 : 2;
    const { error: trackingError } = await supabase.from('tracking_status').insert({
      order_id: data.id,
      current_stage: startStage,
      stage_history: [{ stage: startStage, timestamp: new Date().toISOString() }],
    });
    if (trackingError) throw trackingError;

    await reload();
    return data;
  }, [reload]);

  const updateOrder = useCallback(async (id, updates) => {
    const { error } = await supabase
      .from('orders')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await reload();
  }, [reload]);

  // --- TRACKING ---
  const updateTracking = useCallback(async (orderId, updates) => {
    const { error } = await supabase
      .from('tracking_status')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('order_id', orderId);
    if (error) throw error;
    await reload();
  }, [reload]);

  const advanceStage = useCallback(async (orderId, newStage, note = '') => {
    const current = tracking.find((t) => t.order_id === orderId);
    if (!current) throw new Error('Tracking record not found');

    const newHistory = [
      ...(current.stage_history || []),
      { stage: newStage, timestamp: new Date().toISOString(), note },
    ];

    await updateTracking(orderId, {
      current_stage: newStage,
      stage_history: newHistory,
    });
  }, [tracking, updateTracking]);

  // --- INVOICES ---
  const upsertInvoice = useCallback(async (orderId, invoiceData) => {
    const { error } = await supabase
      .from('invoices')
      .upsert(
        { order_id: orderId, ...invoiceData, updated_at: new Date().toISOString() },
        { onConflict: 'order_id' }
      );
    if (error) throw error;
    await reload();
  }, [reload]);

  const addAdditionalCost = useCallback(async (orderId, description, amount) => {
    const invoice = invoices.find((inv) => inv.order_id === orderId);
    const existingCosts = invoice?.additional_costs || [];
    const newCosts = [...existingCosts, { description, amount }];
    const newTotal = (invoice?.base_price || 0) + newCosts.reduce((sum, c) => sum + Number(c.amount), 0);

    await upsertInvoice(orderId, {
      base_price: invoice?.base_price || 0,
      additional_costs: newCosts,
      total: newTotal,
    });
  }, [invoices, upsertInvoice]);

  // --- COMPLETE ORDER (move to completed_orders, delete from active tables) ---
  const completeOrder = useCallback(async (orderId) => {
    const order = orders.find((o) => o.id === orderId);
    const trackingRow = tracking.find((t) => t.order_id === orderId);
    const invoiceRow = invoices.find((inv) => inv.order_id === orderId);

    if (!order) throw new Error('Order not found');

    const { error: insertError } = await supabase.from('completed_orders').insert({
      original_order_id: orderId,
      order_snapshot: order,
      tracking_snapshot: trackingRow || null,
      invoice_snapshot: invoiceRow || null,
    });
    if (insertError) throw insertError;

    // delete from active tables (tracking & invoices cascade via FK, but explicit for clarity)
    await supabase.from('invoices').delete().eq('order_id', orderId);
    await supabase.from('tracking_status').delete().eq('order_id', orderId);
    await supabase.from('orders').delete().eq('id', orderId);

    await reload();
  }, [orders, tracking, invoices, reload]);

  // --- CLEANUP EXPIRED COMPLETED ORDERS (call on mount / via scheduled job) ---
  const cleanupExpiredCompleted = useCallback(async () => {
    const { error } = await supabase
      .from('completed_orders')
      .delete()
      .lt('auto_delete_after', new Date().toISOString());
    if (error) throw error;
    await reload();
  }, [reload]);

  return {
    orders,
    tracking,
    invoices,
    completedOrders,
    carriers,
    pricingRates,
    loading,
    error,
    reload,
    addOrder,
    updateOrder,
    updateTracking,
    advanceStage,
    upsertInvoice,
    addAdditionalCost,
    completeOrder,
    cleanupExpiredCompleted,
  };
}

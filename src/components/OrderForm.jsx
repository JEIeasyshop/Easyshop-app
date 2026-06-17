// src/components/OrderForm.jsx
import { useState, useMemo } from 'react'
import { X, Plus, Trash2, ExternalLink } from 'lucide-react'
import { chargeableWeight, calcShippingOnly, formatCurrency } from '../lib/pricing'

const DIRECTIONS = [
  { value: 'us_jkt', label: 'US → JKT' },
  { value: 'jkt_us', label: 'JKT → US' },
  { value: 'other',  label: 'Other' },
]
const SERVICES = [
  { value: 'full_service',  title: 'Full Service',   desc: 'Order pickup + warehouse + shipping' },
  { value: 'shipping_only', title: 'Shipping Only',  desc: 'Drop-off at warehouse, ship only' },
]
const STEPS = ['Information', 'Goods & Pricing', 'Additional Notes']

const emptyForm = {
  // Step 1 — Information (reordered per request)
  customer_name:        '',
  contact_number:       '',
  order_date:           new Date().toISOString().split('T')[0],
  direction:            '',
  direction_other_note: '',
  delivery_address:     '',
  service_type:         '',
  // Step 2 — Goods & Pricing
  goods_description:    '',
  goods_link:           '',            // product/order link
  order_tracking_link:  '',            // shipment tracking link
  eta_date:             '',            // estimated arrival date
  weight_unit:          'kg',
  weight_kg:            '',
  weight_lb:            '',
  length_cm: '', width_cm: '', height_cm: '',
  length_in: '', width_in: '', height_in: '',
  qty:                  1,
  // Full service pricing
  full_service_price:   '',            // manual price entry
  full_service_currency:'USD',
  full_service_pricing_notes: '',
  // Shipping only pricing
  rate_per_kg:          '',
  rate_currency:        'USD',
  vol_divisor:          5000,
  additional_costs:     [],            // [{ description, amount }]
  // Step 3
  additional_notes:     '',
}

export default function OrderForm({ onSubmit, onClose }) {
  const [step, setStep]     = useState(0)
  const [form, setForm]     = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set        = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isMetric   = form.weight_unit === 'kg'
  const isFull     = form.service_type === 'full_service'
  const isShipping = form.service_type === 'shipping_only'

  // ── Live pricing (shipping only) ─────────────────────────
  const pricing = useMemo(() => {
    if (!isShipping) return null
    return calcShippingOnly({
      rate:            form.rate_per_kg,
      currency:        form.rate_currency,
      additionalCosts: form.additional_costs,
      weightUnit:      form.weight_unit,
      weightKg:        form.weight_kg,
      weightLb:        form.weight_lb,
      lengthCm: form.length_cm, widthCm: form.width_cm, heightCm: form.height_cm,
      lengthIn: form.length_in, widthIn: form.width_in, heightIn: form.height_in,
      divisor:  form.vol_divisor,
      qty:      form.qty,
    })
  }, [isShipping, form.rate_per_kg, form.rate_currency, form.additional_costs,
      form.weight_unit, form.weight_kg, form.weight_lb,
      form.length_cm, form.width_cm, form.height_cm,
      form.length_in, form.width_in, form.height_in,
      form.vol_divisor, form.qty])

  // ── Additional costs helpers ──────────────────────────────
  const addCost    = () => set('additional_costs', [...form.additional_costs, { description:'', amount:'' }])
  const updateCost = (i, field, val) => set('additional_costs',
    form.additional_costs.map((c, idx) => idx === i ? { ...c, [field]: val } : c))
  const removeCost = (i) => set('additional_costs',
    form.additional_costs.filter((_, idx) => idx !== i))

  // ── Validation ────────────────────────────────────────────
  const validate = () => {
    if (step === 0) {
      if (!form.customer_name.trim()) return 'Customer name is required.'
      if (!form.direction)            return 'Please select a direction.'
      if (form.direction === 'other' && !form.direction_other_note.trim())
        return 'Please describe the direction.'
      if (!form.service_type)         return 'Please select a service type.'
    }
    if (step === 1) {
      if (!form.goods_description.trim()) return 'Goods description is required.'
    }
    return null
  }

  const next = () => {
    const err = validate(); if (err) { setError(err); return }
    setError(''); setStep(s => s + 1)
  }
  const back = () => { setError(''); setStep(s => s - 1) }

  // ── Submit ────────────────────────────────────────────────
  const submit = async () => {
    setSaving(true); setError('')
    try {
      const p = { ...form }
      // Normalise weights
      if (form.weight_unit === 'lb') {
        p.weight_lb = form.weight_lb || null
        p.weight_kg = form.weight_lb ? +(parseFloat(form.weight_lb) * 0.453592).toFixed(3) : null
      } else {
        p.weight_kg = form.weight_kg || null
        p.weight_lb = form.weight_kg ? +(parseFloat(form.weight_kg) * 2.20462).toFixed(3) : null
      }
      ;['length_cm','width_cm','height_cm','length_in','width_in','height_in'].forEach(k => {
        p[k] = form[k] ? parseFloat(form[k]) : null
      })
      p.qty         = parseInt(form.qty) || 1
      p.rate_per_kg = parseFloat(form.rate_per_kg) || null
      p.eta_date    = form.eta_date || null

      // Store computed price
      if (pricing) {
        p.computed_base_price      = pricing.basePrice
        p.computed_total           = pricing.total
        p.computed_currency        = pricing.currency
        p.chargeable_weight_kg     = pricing.weightBreakdown.chargeableKg
      } else if (isFull && form.full_service_price) {
        p.computed_base_price  = parseFloat(form.full_service_price)
        p.computed_total       = parseFloat(form.full_service_price)
        p.computed_currency    = form.full_service_currency
      }

      await onSubmit(p)
    } catch (err) {
      setError(err.message || 'Failed to save.')
      setSaving(false)
    }
  }

  return (
    <div className="overlay">
      <div className="wizard-modal">

        {/* Header */}
        <div className="wizard-header">
          <div className="flex-between">
            <div>
              <div className="wizard-title">New Order</div>
              <div className="wizard-subtitle">Step {step + 1} of {STEPS.length} — {STEPS[step]}</div>
            </div>
            <button className="btn-ghost" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="wizard-progress mt-12">
            {STEPS.map((_, i) => (
              <div key={i} className={`w-step ${i < step ? 'done' : i === step ? 'active' : ''}`} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="wizard-body">
          {error && <div className="login-error" style={{marginBottom:16}}>{error}</div>}

          {/* ═══ STEP 0 — Information ═══ */}
          {step === 0 && <>
            {/* 1. Customer name */}
            <div className="form-group">
              <label className="form-label">Customer Name</label>
              <input className="form-input" type="text" placeholder="Full name"
                value={form.customer_name}
                onChange={e => set('customer_name', e.target.value)} />
            </div>

            {/* 2. Contact number */}
            <div className="form-group">
              <label className="form-label">
                Contact Number <span className="optional">(optional)</span>
              </label>
              <input className="form-input" type="tel" placeholder="+62 812 3456 7890"
                value={form.contact_number}
                onChange={e => set('contact_number', e.target.value)} />
            </div>

            {/* 3. Order date */}
            <div className="form-group">
              <label className="form-label">Order Date</label>
              <input className="form-input" type="date" value={form.order_date}
                onChange={e => set('order_date', e.target.value)} />
            </div>

            {/* 4. Direction */}
            <div className="form-group">
              <label className="form-label">Direction</label>
              <div className="radio-group">
                {DIRECTIONS.map(d => (
                  <label key={d.value}
                    className={`radio-pill ${form.direction === d.value ? 'selected' : ''}`}>
                    <input type="radio" name="direction" value={d.value}
                      checked={form.direction === d.value}
                      onChange={() => set('direction', d.value)} />
                    {d.label}
                  </label>
                ))}
              </div>
              {form.direction === 'other' && (
                <input className="form-input mt-8" type="text"
                  placeholder="Describe the route…"
                  value={form.direction_other_note}
                  onChange={e => set('direction_other_note', e.target.value)} />
              )}
            </div>

            {/* 5. Delivery address */}
            <div className="form-group">
              <label className="form-label">
                Delivery Address <span className="optional">(optional)</span>
              </label>
              <textarea className="form-textarea" style={{minHeight:72}}
                placeholder="Street, city, postal code…"
                value={form.delivery_address}
                onChange={e => set('delivery_address', e.target.value)} />
            </div>

            {/* Type of service */}
            <div className="form-group">
              <label className="form-label">Type of Service</label>
              <div className="radio-group">
                {SERVICES.map(s => (
                  <label key={s.value}
                    className={`radio-pill radio-pill-card ${form.service_type === s.value ? 'selected' : ''}`}>
                    <input type="radio" name="service_type" value={s.value}
                      checked={form.service_type === s.value}
                      onChange={() => set('service_type', s.value)} />
                    <span className="pill-title">{s.title}</span>
                    <span className="pill-desc">{s.desc}</span>
                  </label>
                ))}
              </div>
            </div>
          </>}

          {/* ═══ STEP 1 — Goods & Pricing ═══ */}
          {step === 1 && <>
            {/* Goods description */}
            <div className="form-group">
              <label className="form-label">Goods Description</label>
              <textarea className="form-textarea"
                placeholder="Describe the items being shipped…"
                value={form.goods_description}
                onChange={e => set('goods_description', e.target.value)} />
            </div>

            {/* Product / order link (full service only) */}
            {isFull && (
              <div className="form-group">
                <label className="form-label">
                  Order / Product Link <span className="optional">(optional)</span>
                </label>
                <input className="form-input" type="url" placeholder="https://amazon.com/…"
                  value={form.goods_link}
                  onChange={e => set('goods_link', e.target.value)} />
                <div className="form-hint">Tap to open the product page directly</div>
              </div>
            )}

            {/* Shipment tracking link + ETA — shown for both service types */}
            <div className="form-group">
              <label className="form-label">
                Shipment Tracking Link <span className="optional">(optional)</span>
              </label>
              <input className="form-input" type="url" placeholder="https://tracking.carrier.com/…"
                value={form.order_tracking_link}
                onChange={e => set('order_tracking_link', e.target.value)} />
              <div className="form-hint">Customer can tap to track the package directly</div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Estimated Arrival Date <span className="optional">(optional)</span>
              </label>
              <input className="form-input" type="date" value={form.eta_date}
                onChange={e => set('eta_date', e.target.value)} />
            </div>

            {/* Weight unit toggle */}
            <div className="form-group">
              <label className="form-label">Unit System</label>
              <div className="radio-group">
                {['kg','lb'].map(u => (
                  <label key={u} className={`radio-pill ${form.weight_unit === u ? 'selected' : ''}`}>
                    <input type="radio" name="wu" value={u}
                      checked={form.weight_unit === u}
                      onChange={() => set('weight_unit', u)} />
                    {u === 'kg' ? 'Metric (kg / cm)' : 'Imperial (lb / in)'}
                  </label>
                ))}
              </div>
            </div>

            {/* Weight + qty */}
            <div className="form-row">
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Weight ({isMetric ? 'kg' : 'lb'})</label>
                <input className="form-input" type="number" min="0" step="0.01"
                  placeholder={`e.g. 2.5 ${isMetric ? 'kg' : 'lb'}`}
                  value={isMetric ? form.weight_kg : form.weight_lb}
                  onChange={e => set(isMetric ? 'weight_kg' : 'weight_lb', e.target.value)} />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Qty (items)</label>
                <input className="form-input" type="number" min="1" step="1"
                  value={form.qty}
                  onChange={e => set('qty', e.target.value)} />
              </div>
            </div>

            {/* Dimensions */}
            <div className="form-group mt-16">
              <label className="form-label">
                Dimensions ({isMetric ? 'cm' : 'in'}) <span className="optional">(optional)</span>
              </label>
              <div className="form-row-3">
                {(isMetric
                  ? [['length_cm','L'],['width_cm','W'],['height_cm','H']]
                  : [['length_in','L'],['width_in','W'],['height_in','H']]
                ).map(([key, lbl]) => (
                  <div key={key}>
                    <div className="text-sm text-muted" style={{marginBottom:4}}>
                      {lbl} ({isMetric ? 'cm' : 'in'})
                    </div>
                    <input className="form-input" type="number" min="0" step="0.1" placeholder="0"
                      value={form[key]} onChange={e => set(key, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            {/* ── PRICING BLOCK ── */}
            <div className="pricing-block mt-16">

              {/* FULL SERVICE — simple price entry + additional costs */}
              {isFull && <>
                <div className="pricing-block-title">PRICING — FULL SERVICE</div>

                <div className="form-group">
                  <label className="form-label">
                    Price <span className="optional">(optional — leave blank to fill at invoice)</span>
                  </label>
                  <div className="rate-input-row">
                    <input className="form-input" type="number" min="0" step="0.01"
                      placeholder="0.00"
                      value={form.full_service_price}
                      onChange={e => set('full_service_price', e.target.value)} />
                    <select className="form-select" style={{width:90}}
                      value={form.full_service_currency}
                      onChange={e => set('full_service_currency', e.target.value)}>
                      <option value="USD">USD</option>
                      <option value="IDR">IDR</option>
                    </select>
                  </div>
                </div>

                {/* Additional costs */}
                <div className="form-group" style={{marginBottom:0}}>
                  <div className="flex-between" style={{marginBottom:8}}>
                    <label className="form-label" style={{marginBottom:0}}>Additional Costs</label>
                    <button className="btn-add-cost" onClick={addCost}>
                      <Plus size={13} /> Add cost
                    </button>
                  </div>
                  {form.additional_costs.length === 0
                    ? <p className="text-sm text-muted">No additional costs yet.</p>
                    : form.additional_costs.map((c, i) => (
                      <div key={i} className="additional-cost-row">
                        <input className="form-input" type="text" placeholder="Description"
                          value={c.description}
                          onChange={e => updateCost(i, 'description', e.target.value)} />
                        <input className="form-input" type="number" min="0" step="0.01"
                          placeholder="Amount" style={{width:110}}
                          value={c.amount}
                          onChange={e => updateCost(i, 'amount', e.target.value)} />
                        <button className="btn-ghost" onClick={() => removeCost(i)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  }
                </div>
              </>}

              {/* SHIPPING ONLY — full calculated pricing */}
              {isShipping && <>
                <div className="pricing-block-title">PRICING — SHIPPING ONLY</div>

                {/* Volumetric divisor */}
                <div className="form-group">
                  <label className="form-label">Volumetric Divisor</label>
                  <div className="radio-group">
                    {[5000, 6000].map(d => (
                      <label key={d} className={`radio-pill ${form.vol_divisor === d ? 'selected' : ''}`}>
                        <input type="radio" name="divisor" value={d}
                          checked={form.vol_divisor === d}
                          onChange={() => set('vol_divisor', d)} />
                        {d.toLocaleString()}
                      </label>
                    ))}
                  </div>
                  <div className="form-hint">5000 = standard air · 6000 = sea / some couriers</div>
                </div>

                {/* Weight breakdown */}
                {pricing?.weightBreakdown && (
                  <div className="weight-compare">
                    <div className="weight-compare-row">
                      <span>Actual weight</span>
                      <span>{pricing.weightBreakdown.actualKg} kg</span>
                    </div>
                    {pricing.weightBreakdown.volumetricKg !== null && (
                      <div className="weight-compare-row">
                        <span>Volumetric weight (÷{form.vol_divisor.toLocaleString()})</span>
                        <span>{pricing.weightBreakdown.volumetricKg} kg</span>
                      </div>
                    )}
                    <div className="weight-compare-row chargeable">
                      <span>
                        Chargeable weight
                        {pricing.weightBreakdown.usedVolumetric ? ' (volumetric wins)'
                          : pricing.weightBreakdown.volumetricKg !== null ? ' (actual wins)' : ''}
                      </span>
                      <span>{pricing.weightBreakdown.chargeableKg} kg</span>
                    </div>
                  </div>
                )}

                {/* Rate per kg */}
                <div className="form-group">
                  <label className="form-label">Rate per kg</label>
                  <div className="rate-input-row">
                    <input className="form-input" type="number" min="0" step="0.01"
                      placeholder="0"
                      value={form.rate_per_kg}
                      onChange={e => set('rate_per_kg', e.target.value)} />
                    <select className="form-select" style={{width:90}}
                      value={form.rate_currency}
                      onChange={e => set('rate_currency', e.target.value)}>
                      <option value="USD">USD</option>
                      <option value="IDR">IDR</option>
                    </select>
                  </div>
                </div>

                {/* Additional costs */}
                <div className="form-group">
                  <div className="flex-between" style={{marginBottom:8}}>
                    <label className="form-label" style={{marginBottom:0}}>Additional Costs</label>
                    <button className="btn-add-cost" onClick={addCost}>
                      <Plus size={13} /> Add cost
                    </button>
                  </div>
                  {form.additional_costs.length === 0
                    ? <p className="text-sm text-muted">No additional costs yet.</p>
                    : form.additional_costs.map((c, i) => (
                      <div key={i} className="additional-cost-row">
                        <input className="form-input" type="text" placeholder="Description"
                          value={c.description}
                          onChange={e => updateCost(i, 'description', e.target.value)} />
                        <input className="form-input" type="number" min="0" step="0.01"
                          placeholder="Amount" style={{width:110}}
                          value={c.amount}
                          onChange={e => updateCost(i, 'amount', e.target.value)} />
                        <button className="btn-ghost" onClick={() => removeCost(i)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  }
                </div>

                {/* Live total */}
                {pricing && (
                  <div className="pricing-summary">
                    <div className="pricing-summary-row">
                      <span>
                        Weight charge ({pricing.weightBreakdown.chargeableKg} kg ×{' '}
                        {formatCurrency(parseFloat(form.rate_per_kg) || 0, form.rate_currency)}/kg)
                      </span>
                      <span>{formatCurrency(pricing.basePrice, pricing.currency)}</span>
                    </div>
                    {pricing.additionalTotal > 0 && (
                      <div className="pricing-summary-row">
                        <span>Additional costs</span>
                        <span>{formatCurrency(pricing.additionalTotal, pricing.currency)}</span>
                      </div>
                    )}
                    <div className="pricing-summary-total">
                      <span>Total</span>
                      <span>{formatCurrency(pricing.total, pricing.currency)}</span>
                    </div>
                  </div>
                )}
              </>}
            </div>
          </>}

          {/* ═══ STEP 2 — Additional Notes ═══ */}
          {step === 2 && <>
            {/* Show tracking link + ETA as read-only preview if filled */}
            {(form.order_tracking_link || form.eta_date) && (
              <div style={{
                background:'var(--navy-pale)', border:'1px solid var(--gray-200)',
                borderRadius:'var(--r-md)', padding:'12px 14px', marginBottom:18
              }}>
                {form.order_tracking_link && (
                  <div className="flex-center gap-8 text-sm" style={{marginBottom: form.eta_date ? 6 : 0}}>
                    <span className="text-muted">Tracking link:</span>
                    <a href={form.order_tracking_link} target="_blank" rel="noreferrer"
                      className="flex-center gap-4" style={{color:'var(--blue)', fontWeight:600}}>
                      Open link <ExternalLink size={11} />
                    </a>
                  </div>
                )}
                {form.eta_date && (
                  <div className="flex-center gap-8 text-sm">
                    <span className="text-muted">Estimated arrival:</span>
                    <span style={{fontWeight:600}}>
                      {new Date(form.eta_date).toLocaleDateString('en-GB',
                        {day:'2-digit', month:'long', year:'numeric'})}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                Additional Notes <span className="optional">(optional)</span>
              </label>
              <textarea className="form-textarea" style={{minHeight:180}}
                placeholder="Special handling instructions, delivery preferences, anything else…"
                value={form.additional_notes}
                onChange={e => set('additional_notes', e.target.value)} />
            </div>
          </>}
        </div>

        {/* Footer */}
        <div className="wizard-footer">
          <button className="btn btn-outline" onClick={step === 0 ? onClose : back}>
            {step === 0 ? 'Cancel' : '← Back'}
          </button>
          {step < STEPS.length - 1
            ? <button className="btn btn-primary" onClick={next}>Continue →</button>
            : <button className="btn btn-gold btn-lg" onClick={submit} disabled={saving}>
                {saving ? 'Creating…' : '✓ Create Order'}
              </button>
          }
        </div>
      </div>
    </div>
  )
}

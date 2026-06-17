// src/components/OrderForm.jsx
import { useState } from 'react'
import { X } from 'lucide-react'

const DIRECTIONS = [
  { value: 'us_jkt', label: 'US → JKT' },
  { value: 'jkt_us', label: 'JKT → US' },
  { value: 'other',  label: 'Other' },
]
const SERVICES = [
  { value: 'full_service',  title: 'Full Service',   desc: 'Order pickup + warehouse + shipping' },
  { value: 'shipping_only', title: 'Shipping Only',  desc: 'Drop-off at warehouse, ship only' },
]
const STEPS = ['Information', 'Goods & Details', 'Additional Notes']

const empty = {
  order_date: new Date().toISOString().split('T')[0],
  customer_name: '',
  direction: '',
  direction_other_note: '',
  service_type: '',
  goods_description: '',
  goods_link: '',
  weight_unit: 'kg',
  weight_kg: '', weight_lb: '',
  length_cm: '', width_cm: '', height_cm: '',
  length_in: '', width_in: '', height_in: '',
  additional_notes: '',
}

export default function OrderForm({ onSubmit, onClose }) {
  const [step, setStep]     = useState(0)
  const [form, setForm]     = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    if (step === 0) {
      if (!form.customer_name.trim()) return 'Customer name is required.'
      if (!form.direction)            return 'Please select a direction.'
      if (form.direction === 'other' && !form.direction_other_note.trim()) return 'Please describe the direction.'
      if (!form.service_type)         return 'Please select a service type.'
    }
    if (step === 1) {
      if (!form.goods_description.trim()) return 'Goods description is required.'
    }
    return null
  }

  const next = () => {
    const err = validate()
    if (err) { setError(err); return }
    setError(''); setStep(s => s + 1)
  }

  const back = () => { setError(''); setStep(s => s - 1) }

  const submit = async () => {
    setSaving(true); setError('')
    try {
      const p = { ...form }
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
      await onSubmit(p)
    } catch (err) {
      setError(err.message || 'Failed to save.')
      setSaving(false)
    }
  }

  const isMetric = form.weight_unit === 'kg'

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

          {/* Step 0 — Information */}
          {step === 0 && <>
            <div className="form-row mb-16">
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Order Date</label>
                <input className="form-input" type="date" value={form.order_date}
                  onChange={e => set('order_date', e.target.value)} />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Customer Name</label>
                <input className="form-input" type="text" placeholder="Full name"
                  value={form.customer_name} onChange={e => set('customer_name', e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Direction</label>
              <div className="radio-group">
                {DIRECTIONS.map(d => (
                  <label key={d.value} className={`radio-pill ${form.direction === d.value ? 'selected' : ''}`}>
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

          {/* Step 1 — Goods & Details */}
          {step === 1 && <>
            <div className="form-group">
              <label className="form-label">Goods Description</label>
              <textarea className="form-textarea"
                placeholder="Describe the items being shipped…"
                value={form.goods_description}
                onChange={e => set('goods_description', e.target.value)} />
            </div>

            {form.service_type === 'full_service' && (
              <div className="form-group">
                <label className="form-label">
                  Order Link <span className="optional">(optional)</span>
                </label>
                <input className="form-input" type="url" placeholder="https://…"
                  value={form.goods_link} onChange={e => set('goods_link', e.target.value)} />
                <div className="form-hint">Tap to open the product page directly</div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Unit</label>
              <div className="radio-group">
                {['kg','lb'].map(u => (
                  <label key={u} className={`radio-pill ${form.weight_unit === u ? 'selected' : ''}`}>
                    <input type="radio" name="wu" value={u}
                      checked={form.weight_unit === u} onChange={() => set('weight_unit', u)} />
                    {u === 'kg' ? 'Metric (kg / cm)' : 'Imperial (lb / in)'}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Weight ({isMetric ? 'kg' : 'lb'})</label>
              <input className="form-input" type="number" min="0" step="0.01"
                placeholder={`e.g. 2.5 ${isMetric ? 'kg' : 'lb'}`}
                value={isMetric ? form.weight_kg : form.weight_lb}
                onChange={e => set(isMetric ? 'weight_kg' : 'weight_lb', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">
                Dimensions ({isMetric ? 'cm' : 'in'}) <span className="optional">(optional)</span>
              </label>
              <div className="form-row-3">
                {(isMetric
                  ? [['length_cm','L (cm)'],['width_cm','W (cm)'],['height_cm','H (cm)']]
                  : [['length_in','L (in)'],['width_in','W (in)'],['height_in','H (in)']]
                ).map(([key, lbl]) => (
                  <div key={key}>
                    <div className="text-sm text-muted" style={{marginBottom:4}}>{lbl}</div>
                    <input className="form-input" type="number" min="0" step="0.1" placeholder="0"
                      value={form[key]} onChange={e => set(key, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          </>}

          {/* Step 2 — Notes */}
          {step === 2 && (
            <div className="form-group">
              <label className="form-label">
                Additional Notes <span className="optional">(optional)</span>
              </label>
              <textarea className="form-textarea" style={{minHeight:160}}
                placeholder="Special handling instructions, delivery preferences, anything else…"
                value={form.additional_notes}
                onChange={e => set('additional_notes', e.target.value)} />
            </div>
          )}
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

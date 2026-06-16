// components/OrderForm.jsx
import { useState } from 'react';

const DIRECTIONS = [
  { value: 'us_jkt', label: 'US → JKT' },
  { value: 'jkt_us', label: 'JKT → US' },
  { value: 'other',  label: 'Other' },
];
const SERVICES = [
  { value: 'full_service',   label: 'Full Service', desc: 'Order pickup + shipping' },
  { value: 'shipping_only',  label: 'Shipping Only', desc: 'Drop-off at warehouse' },
];

const STEPS = ['Information', 'Goods & Details', 'Additional Notes'];

const empty = {
  order_date: new Date().toISOString().split('T')[0],
  customer_name: '',
  direction: '',
  direction_other_note: '',
  service_type: '',
  goods_description: '',
  goods_link: '',
  weight_unit: 'kg',
  weight_kg: '',
  weight_lb: '',
  length_cm: '', width_cm: '', height_cm: '',
  length_in: '', width_in: '', height_in: '',
  additional_notes: '',
};

export default function OrderForm({ onSubmit, onClose }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const validateStep = () => {
    if (step === 0) {
      if (!form.customer_name.trim()) return 'Customer name is required.';
      if (!form.direction) return 'Please select a direction.';
      if (form.direction === 'other' && !form.direction_other_note.trim()) return 'Please describe the direction.';
      if (!form.service_type) return 'Please select a service type.';
    }
    if (step === 1) {
      if (!form.goods_description.trim()) return 'Goods description is required.';
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      // Convert weights if needed
      const payload = { ...form };
      if (form.weight_unit === 'lb') {
        payload.weight_kg = form.weight_lb ? (parseFloat(form.weight_lb) * 0.453592).toFixed(2) : null;
        payload.weight_lb = form.weight_lb || null;
      } else {
        payload.weight_kg = form.weight_kg || null;
        payload.weight_lb = form.weight_kg ? (parseFloat(form.weight_kg) * 2.20462).toFixed(2) : null;
      }
      // Clean numeric fields
      ['length_cm','width_cm','height_cm','length_in','width_in','height_in'].forEach(k => {
        payload[k] = form[k] ? parseFloat(form[k]) : null;
      });
      await onSubmit(payload);
    } catch (err) {
      setError(err.message || 'Failed to save order.');
      setSaving(false);
    }
  };

  return (
    <div className="wizard-overlay">
      <div className="wizard-modal">
        <div className="wizard-header">
          <h2>New Order</h2>
          <div className="wizard-steps">
            {STEPS.map((_, i) => (
              <div key={i} className={`wizard-step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`} />
            ))}
          </div>
          <div className="wizard-step-label">Step {step + 1} of {STEPS.length} — {STEPS[step]}</div>
        </div>

        <div className="wizard-body">
          {error && <div className="login-error" style={{marginBottom:16}}>{error}</div>}

          {/* ── Step 0: Information ── */}
          {step === 0 && (
            <>
              <div className="form-group">
                <label className="form-label">Order Date</label>
                <input className="form-input" type="date" value={form.order_date}
                  onChange={e => set('order_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Customer Name</label>
                <input className="form-input" type="text" placeholder="Full name"
                  value={form.customer_name} onChange={e => set('customer_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Direction</label>
                <div className="radio-group">
                  {DIRECTIONS.map(d => (
                    <label key={d.value} className={`radio-option ${form.direction === d.value ? 'selected' : ''}`}>
                      <input type="radio" name="direction" value={d.value}
                        checked={form.direction === d.value}
                        onChange={() => set('direction', d.value)} />
                      {d.label}
                    </label>
                  ))}
                </div>
                {form.direction === 'other' && (
                  <input className="form-input" style={{marginTop:10}} type="text"
                    placeholder="Describe the direction..."
                    value={form.direction_other_note}
                    onChange={e => set('direction_other_note', e.target.value)} />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Type of Service</label>
                <div className="radio-group">
                  {SERVICES.map(s => (
                    <label key={s.value} className={`radio-option ${form.service_type === s.value ? 'selected' : ''}`}
                      style={{flexDirection:'column', alignItems:'flex-start', padding:'10px 14px'}}>
                      <input type="radio" name="service_type" value={s.value}
                        checked={form.service_type === s.value}
                        onChange={() => set('service_type', s.value)} />
                      <span style={{fontWeight:600}}>{s.label}</span>
                      <span style={{fontSize:11, color:'var(--gray-400)', fontWeight:400}}>{s.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step 1: Goods & Details ── */}
          {step === 1 && (
            <>
              <div className="form-group">
                <label className="form-label">Goods Description</label>
                <textarea className="form-textarea" placeholder="Describe the items being shipped..."
                  value={form.goods_description}
                  onChange={e => set('goods_description', e.target.value)} />
              </div>
              {form.service_type === 'full_service' && (
                <div className="form-group">
                  <label className="form-label">Order Link <span style={{color:'var(--gray-400)',fontWeight:400,textTransform:'none'}}>(optional)</span></label>
                  <input className="form-input" type="url" placeholder="https://..."
                    value={form.goods_link} onChange={e => set('goods_link', e.target.value)} />
                  <div className="form-hint">Customer can tap to open the product page</div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Weight Unit</label>
                <div className="radio-group">
                  {['kg','lb'].map(u => (
                    <label key={u} className={`radio-option ${form.weight_unit === u ? 'selected' : ''}`}>
                      <input type="radio" name="weight_unit" value={u}
                        checked={form.weight_unit === u}
                        onChange={() => set('weight_unit', u)} />
                      {u}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Weight ({form.weight_unit})</label>
                <input className="form-input" type="number" min="0" step="0.01"
                  placeholder={`e.g. 2.5 ${form.weight_unit}`}
                  value={form.weight_unit === 'kg' ? form.weight_kg : form.weight_lb}
                  onChange={e => set(form.weight_unit === 'kg' ? 'weight_kg' : 'weight_lb', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Dimensions ({form.weight_unit === 'kg' ? 'cm' : 'in'}) <span style={{color:'var(--gray-400)',fontWeight:400,textTransform:'none'}}>(optional)</span></label>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
                  {(form.weight_unit === 'kg'
                    ? [['length_cm','L'],['width_cm','W'],['height_cm','H']]
                    : [['length_in','L'],['width_in','W'],['height_in','H']]
                  ).map(([key, lbl]) => (
                    <div key={key}>
                      <div style={{fontSize:11, color:'var(--gray-400)', marginBottom:4}}>{lbl}</div>
                      <input className="form-input" type="number" min="0" step="0.1"
                        placeholder="0"
                        value={form[key]} onChange={e => set(key, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Notes ── */}
          {step === 2 && (
            <div className="form-group">
              <label className="form-label">Additional Notes <span style={{color:'var(--gray-400)',fontWeight:400,textTransform:'none'}}>(optional)</span></label>
              <textarea className="form-textarea" style={{minHeight:160}}
                placeholder="Special instructions, handling notes, delivery preferences..."
                value={form.additional_notes}
                onChange={e => set('additional_notes', e.target.value)} />
            </div>
          )}
        </div>

        <div className="wizard-footer">
          <button className="btn btn-outline" onClick={step === 0 ? onClose : () => { setError(''); setStep(s => s - 1); }}>
            {step === 0 ? 'Cancel' : '← Back'}
          </button>
          {step < STEPS.length - 1
            ? <button className="btn btn-primary" onClick={next}>Next →</button>
            : <button className="btn btn-gold" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Saving...' : '✓ Create Order'}
              </button>
          }
        </div>
      </div>
    </div>
  );
}

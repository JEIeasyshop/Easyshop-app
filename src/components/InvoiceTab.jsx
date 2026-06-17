// src/components/InvoiceTab.jsx
// Design: matches JEI Invoices tab — list at top, expanded invoice doc below,
// add cost line, conversion rates box, complete button
import { useState } from 'react'
import { FileText, Printer, CheckCircle, Plus, X } from 'lucide-react'
import { getStageSequence, isFinalStage } from '../lib/data'
import { formatCurrency } from '../lib/pricing'
import { generateInvoicePDF } from '../lib/pdf'

const DIR_LABEL = { us_jkt: 'US → JKT', jkt_us: 'JKT → US' }

// Default FX fallbacks
const DEFAULT_USD_IDR = 15850
const DEFAULT_SGD_IDR = 11900

export default function InvoiceTab({
  orders, tracking, invoices,
  addInvoiceCost, lockInvoiceTotal, completeOrder,
}) {
  const [selectedId, setSelectedId] = useState(null)
  const [confirmId, setConfirmId]   = useState(null)
  const [completing, setCompleting] = useState(false)

  // Add cost line state
  const [costDesc, setCostDesc]     = useState('')
  const [costAmt, setCostAmt]       = useState('')
  const [costCur, setCostCur]       = useState('IDR')
  const [savingCost, setSavingCost] = useState(false)

  // Per-invoice FX rates (matches JEI: stored per invoice, not global)
  const [usdRate, setUsdRate]       = useState('')
  const [sgdRate, setSgdRate]       = useState('')
  const [savingRates, setSavingRates] = useState(false)

  // Only show orders at final tracking stage
  const invoiceReady = orders.filter(o => {
    const t = tracking.find(t => t.order_id === o.id)
    return isFinalStage(o, t)
  })

  const getInv = (oid) => invoices.find(i => i.order_id === oid)
  const getTrow = (oid) => tracking.find(t => t.order_id === oid)

  const selected = invoiceReady.find(o => o.id === selectedId)
  const selInv   = selected ? getInv(selected.id) : null
  const selTrow  = selected ? getTrow(selected.id) : null

  // When selecting an order, pre-fill saved rates if any
  const selectOrder = (oid) => {
    setSelectedId(prev => prev === oid ? null : oid)
    const inv = getInv(oid)
    setUsdRate(inv?.usd_rate?.toString() || '')
    setSgdRate(inv?.sgd_rate?.toString() || '')
    setCostDesc(''); setCostAmt(''); setCostCur('IDR')
  }

  // Build fee lines (same as before — drives both UI and PDF)
  const buildFeeLines = (order, inv) => {
    const lines = []
    const cur   = inv?.currency || order?.rate_currency || 'USD'
    if (order.service_type === 'shipping_only' && order.computed_base_price != null) {
      lines.push({
        label: `${DIR_LABEL[order.direction] || 'Shipping'} (${order.chargeable_weight_kg || order.weight_kg || '?'} kg × ${formatCurrency(order.rate_per_kg || 0, cur)})`,
        amount: order.computed_base_price, currency: cur,
      })
    } else if (order.service_type === 'full_service' && (inv?.base_price || 0) > 0) {
      lines.push({ label: 'Full Service Fee', amount: inv.base_price, currency: cur })
    }
    ;(order.additional_costs || []).forEach(c =>
      lines.push({ label: c.description, amount: Number(c.amount), currency: cur })
    )
    ;(inv?.additional_costs || []).forEach(c =>
      lines.push({ label: c.description, amount: Number(c.amount), currency: c.currency || cur })
    )
    return lines
  }

  // Convert amount to IDR using saved or default rates
  const toIDR = (amount, currency, uR, sR) => {
    const fxU = parseFloat(uR) || DEFAULT_USD_IDR
    const fxS = parseFloat(sR) || DEFAULT_SGD_IDR
    if (currency === 'USD') return amount * fxU
    if (currency === 'SGD') return amount * fxS
    return amount // already IDR
  }

  const handleAddCost = async (oid) => {
    if (!costDesc.trim() || !costAmt) return
    setSavingCost(true)
    try {
      await addInvoiceCost(oid, costDesc.trim(), parseFloat(costAmt), costCur)
      setCostDesc(''); setCostAmt('')
    } finally { setSavingCost(false) }
  }

  const handleSaveRates = async (oid) => {
    setSavingRates(true)
    try {
      const inv = getInv(oid)
      await lockInvoiceTotal(oid, inv?.total || 0, inv?.currency || 'USD',
        parseFloat(usdRate) || null, parseFloat(sgdRate) || null)
    } finally { setSavingRates(false) }
  }

  const handleComplete = async (oid) => {
    setCompleting(true)
    try {
      const inv   = getInv(oid)
      const order = orders.find(o => o.id === oid)
      if (inv) await lockInvoiceTotal(oid, inv.total, inv.currency || order?.rate_currency || 'USD',
        parseFloat(usdRate) || null, parseFloat(sgdRate) || null)
      await completeOrder(oid)
      setConfirmId(null); setSelectedId(null)
    } finally { setCompleting(false) }
  }

  const payBadge = (tRow) => {
    const p = tRow?.payment || 'Unpaid'
    const cls = p === 'Paid' ? 'badge-green' : p === 'Invoiced' ? 'badge-amber' : 'badge-red'
    return <span className={`badge ${cls}`}>{p}</span>
  }

  return (
    <div>
      <div className="page-header">
        <h2>Invoices</h2>
        <p>Delivered orders are billable. Complete an invoice to archive it from active views.</p>
      </div>

      {invoiceReady.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><FileText size={26} /></div>
            <h3>No invoices ready</h3>
            <p>Advance a shipment to "Received by customer" in Tracking to generate an invoice.</p>
          </div>
        </div>
      ) : (<>
        {/* Invoice list — clickable rows at top */}
        <div className="inv-list">
          {invoiceReady.map(order => {
            const inv    = getInv(order.id)
            const tRow   = getTrow(order.id)
            const lines  = buildFeeLines(order, inv)
            const total  = lines.reduce((s, l) => s + l.amount, 0)
            const cur    = inv?.currency || order?.rate_currency || 'USD'
            const isSel  = selectedId === order.id
            const savedU = inv?.usd_rate
            const savedS = inv?.sgd_rate
            const totalIDR = lines.reduce((s, l) =>
              s + toIDR(l.amount, l.currency, savedU || usdRate, savedS || sgdRate), 0)

            return (
              <div key={order.id}
                className={`inv-row ${isSel ? 'inv-row-active' : ''}`}
                onClick={() => selectOrder(order.id)}>
                <div className="flex-center gap-10">
                  <FileText size={14} style={{color:'var(--navy)', opacity:0.6}} />
                  <span className="text-mono text-sm" style={{color:'var(--navy)', fontWeight:600}}>
                    ORD-{order.id?.substring(0,6).toUpperCase()}
                  </span>
                  <span style={{fontWeight:600}}>{order.customer_name}</span>
                  <span className="text-muted text-sm">
                    {DIR_LABEL[order.direction] || order.direction_other_note || 'Other'} ·{' '}
                    {order.goods_description || '—'}
                  </span>
                </div>
                <div className="flex-center gap-10">
                  {payBadge(tRow)}
                  <span style={{fontWeight:700, fontSize:14}}>
                    Rp {Math.round(totalIDR).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Expanded invoice doc — matches JEI InvoiceDoc */}
        {selected && selInv !== undefined && (() => {
          const lines  = buildFeeLines(selected, selInv)
          const total  = lines.reduce((s, l) => s + l.amount, 0)
          const cur    = selInv?.currency || selected?.rate_currency || 'USD'
          const savedU = selInv?.usd_rate
          const savedS = selInv?.sgd_rate
          const effU   = parseFloat(usdRate) || savedU || DEFAULT_USD_IDR
          const effS   = parseFloat(sgdRate) || savedS || DEFAULT_SGD_IDR
          const totalIDR = lines.reduce((s, l) => s + toIDR(l.amount, l.currency, effU, effS), 0)
          const pay    = selTrow?.payment || 'Unpaid'

          return (
            <div className="inv-doc">
              {/* Doc header */}
              <div className="inv-doc-header">
                <div className="flex-center gap-12">
                  <img src="/logo.png" alt="JEI" style={{width:44, height:44, objectFit:'contain'}} />
                  <div>
                    <div style={{fontFamily:'var(--font-brand)', fontWeight:800, fontSize:14, color:'var(--navy)'}}>
                      JON EXPRESS INTERNATIONAL
                    </div>
                    <div className="text-sm text-muted">Freight forwarding · US → SG → ID</div>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontFamily:'var(--font-brand)', fontWeight:800, fontSize:22, color:'var(--navy)'}}>
                    INVOICE
                  </div>
                  <div className="text-sm text-muted">INV-{selected.id?.substring(0,6).toUpperCase()}</div>
                  <div className="text-sm text-muted">Issued</div>
                </div>
              </div>

              <hr />

              {/* Meta row */}
              <div className="inv-meta-row">
                <div>
                  <div className="inv-meta-label">BILL TO</div>
                  <div className="inv-meta-value">{selected.customer_name}</div>
                </div>
                <div>
                  <div className="inv-meta-label">SHIPMENT</div>
                  <div className="inv-meta-value">
                    {selTrow?.tracking_number || `ORD-${selected.id?.substring(0,6).toUpperCase()}`}
                    {selTrow?.track_us_sg_carrier && ` · ${selTrow.track_us_sg_carrier}`}
                  </div>
                </div>
                <div>
                  <div className="inv-meta-label">STATUS</div>
                  <div className="inv-meta-value" style={{color:'var(--green)', fontWeight:700}}>Delivered</div>
                </div>
                <div>
                  <div className="inv-meta-label">PAYMENT</div>
                  <div>{(() => {
                    const cls = pay === 'Paid' ? 'badge-green' : pay === 'Invoiced' ? 'badge-amber' : 'badge-red'
                    return <span className={`badge ${cls}`}>{pay}</span>
                  })()}</div>
                </div>
              </div>

              <hr />

              {/* Fee lines table */}
              <table style={{width:'100%', borderCollapse:'collapse', marginBottom:16}}>
                <thead>
                  <tr>
                    <th style={{textAlign:'left', padding:'8px 0', fontSize:11, color:'var(--gray-400)',
                      textTransform:'uppercase', letterSpacing:'0.07em', borderBottom:'1px solid var(--gray-200)'}}>
                      Description
                    </th>
                    <th style={{textAlign:'right', padding:'8px 0', fontSize:11, color:'var(--gray-400)',
                      textTransform:'uppercase', letterSpacing:'0.07em', borderBottom:'1px solid var(--gray-200)'}}>
                      Amount
                    </th>
                    <th style={{textAlign:'right', padding:'8px 0', fontSize:11, color:'var(--gray-400)',
                      textTransform:'uppercase', letterSpacing:'0.07em', borderBottom:'1px solid var(--gray-200)'}}>
                      In IDR
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr><td colSpan={3} style={{padding:'12px 0', color:'var(--gray-400)', fontSize:13}}>
                      No pricing set — add a cost line below.
                    </td></tr>
                  ) : lines.map((l, i) => (
                    <tr key={i}>
                      <td style={{padding:'10px 0', fontSize:13, borderBottom:'1px solid var(--gray-100)'}}>{l.label}</td>
                      <td style={{textAlign:'right', padding:'10px 0', fontSize:13, fontWeight:500,
                        borderBottom:'1px solid var(--gray-100)'}}>
                        {formatCurrency(l.amount, l.currency)}
                      </td>
                      <td style={{textAlign:'right', padding:'10px 0', fontSize:13, fontWeight:700,
                        color:'var(--navy)', borderBottom:'1px solid var(--gray-100)'}}>
                        Rp {Math.round(toIDR(l.amount, l.currency, effU, effS)).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Add cost line */}
              <div className="inv-add-cost">
                <div className="inv-section-label">ADD COST LINE</div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:8}}>
                  <input className="form-input" style={{flex:3, minWidth:150}} type="text"
                    placeholder="Description (e.g. Handling fee)"
                    value={costDesc} onChange={e => setCostDesc(e.target.value)} />
                  <input className="form-input" style={{flex:1, minWidth:80}} type="number"
                    min="0" step="0.01" placeholder="Amount"
                    value={costAmt} onChange={e => setCostAmt(e.target.value)} />
                  <select className="form-select" style={{width:80}}
                    value={costCur} onChange={e => setCostCur(e.target.value)}>
                    <option>IDR</option><option>USD</option>
                  </select>
                  <button className="btn btn-primary btn-sm" disabled={savingCost}
                    onClick={() => handleAddCost(selected.id)}>
                    <Plus size={13} /> {savingCost ? '…' : 'Add cost'}
                  </button>
                </div>
              </div>

              {/* Conversion rates */}
              <div className="inv-fx-box">
                <div className="inv-section-label">CONVERSION RATES (this invoice only)</div>
                <div style={{display:'flex', gap:12, marginTop:8, flexWrap:'wrap', alignItems:'flex-end'}}>
                  <div style={{flex:1, minWidth:140}}>
                    <div className="text-sm text-muted" style={{marginBottom:4}}>USD → IDR</div>
                    <input className="form-input" type="number" placeholder={DEFAULT_USD_IDR}
                      value={usdRate} onChange={e => setUsdRate(e.target.value)} />
                  </div>
                  <div style={{flex:1, minWidth:140}}>
                    <div className="text-sm text-muted" style={{marginBottom:4}}>SGD → IDR</div>
                    <input className="form-input" type="number" placeholder={DEFAULT_SGD_IDR}
                      value={sgdRate} onChange={e => setSgdRate(e.target.value)} />
                  </div>
                  <button className="btn btn-primary btn-sm" disabled={savingRates}
                    onClick={() => handleSaveRates(selected.id)}>
                    {savingRates ? 'Saving…' : 'Save rates'}
                  </button>
                </div>
              </div>

              {/* Total IDR */}
              <div className="cost-total" style={{marginTop:16}}>
                <span className="cost-total-label">Total Due (IDR)</span>
                <span className="cost-total-value">
                  Rp {Math.round(totalIDR).toLocaleString('id-ID')}
                </span>
              </div>

              {/* Actions */}
              <div className="flex-center gap-8" style={{marginTop:16, justifyContent:'flex-end'}}>
                <button className="btn btn-outline btn-sm"
                  onClick={() => generateInvoicePDF(selected, selInv, lines)}>
                  <Printer size={13} /> Download PDF
                </button>
                <button className="btn btn-green" onClick={() => setConfirmId(selected.id)}>
                  <CheckCircle size={14} /> Complete Invoice
                </button>
              </div>
            </div>
          )
        })()}
      </>)}

      {/* Confirm complete */}
      {confirmId && (
        <div className="overlay">
          <div className="confirm-modal">
            <h3>Complete this invoice?</h3>
            <p>
              This will lock the total, move the order to <strong>Completed</strong>, and remove it from
              all active tabs. You can revert it from Completed if needed.
            </p>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={() => setConfirmId(null)}>Cancel</button>
              <button className="btn btn-green" disabled={completing}
                onClick={() => handleComplete(confirmId)}>
                {completing ? 'Processing…' : '✓ Yes, Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

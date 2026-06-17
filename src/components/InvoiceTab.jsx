// src/components/InvoiceTab.jsx
// Connected to: orders (for order data), tracking (stage gate),
// invoices (cost lines), completeOrder (moves to Completed tab)
import { useState } from 'react'
import { FileText, Printer, CheckCircle, Plus, X } from 'lucide-react'
import { getStageSequence, isFinalStage } from '../lib/data'
import { formatCurrency } from '../lib/pricing'
import { generateInvoicePDF } from '../lib/pdf'

const DIR_LABEL = { us_jkt: 'US → JKT', jkt_us: 'JKT → US' }

export default function InvoiceTab({
  orders, tracking, invoices,
  addInvoiceCost, lockInvoiceTotal, completeOrder,
}) {
  const [confirmId, setConfirmId]   = useState(null)
  const [addCostId, setAddCostId]   = useState(null)
  const [costDesc, setCostDesc]     = useState('')
  const [costAmt, setCostAmt]       = useState('')
  const [costCur, setCostCur]       = useState('USD')
  const [completing, setCompleting] = useState(false)
  const [savingCost, setSavingCost] = useState(false)

  // Only show orders at final tracking stage
  const invoiceReady = orders.filter(o => {
    const t = tracking.find(t => t.order_id === o.id)
    return isFinalStage(o, t)
  })

  const getInv = (oid) => invoices.find(i => i.order_id === oid)

  const handleAddCost = async (oid) => {
    if (!costDesc.trim() || !costAmt) return
    setSavingCost(true)
    try {
      await addInvoiceCost(oid, costDesc.trim(), parseFloat(costAmt), costCur)
      setCostDesc(''); setCostAmt(''); setCostCur('USD'); setAddCostId(null)
    } finally { setSavingCost(false) }
  }

  const handleComplete = async (oid) => {
    setCompleting(true)
    try {
      const inv = getInv(oid)
      const order = orders.find(o => o.id === oid)
      // Lock the total before completing (JEI pattern: save rates + total first)
      if (inv) {
        await lockInvoiceTotal(oid, inv.total, inv.currency || order?.rate_currency || 'USD')
      }
      await completeOrder(oid)
      setConfirmId(null)
    } finally { setCompleting(false) }
  }

  // Build fee lines from order data (mirrors pricing.js logic)
  const buildFeeLines = (order, inv) => {
    const lines = []
    const cur   = inv?.currency || order?.rate_currency || 'USD'

    // Base: computed from order at creation (shipping only)
    if (order.service_type === 'shipping_only' && order.computed_base_price != null) {
      lines.push({
        label: `Shipping (${order.chargeable_weight_kg || order.weight_kg || '?'} kg × ${formatCurrency(order.rate_per_kg || 0, cur)}/kg)`,
        amount: order.computed_base_price,
        currency: cur,
      })
    } else if (order.service_type === 'full_service') {
      // Full service: base price from invoice or manual
      if ((inv?.base_price || 0) > 0) {
        lines.push({ label: 'Full Service Fee', amount: inv.base_price, currency: cur })
      }
    }

    // Additional costs from order creation (order_extra_fees / additional_costs on order)
    const orderCosts = order.additional_costs || []
    orderCosts.forEach(c => {
      lines.push({ label: c.description, amount: Number(c.amount), currency: cur })
    })

    // Invoice-time extra costs (added in this tab)
    const invCosts = inv?.additional_costs || []
    invCosts.forEach(c => {
      lines.push({ label: c.description, amount: Number(c.amount), currency: c.currency || cur })
    })

    return lines
  }

  return (
    <div>
      <div className="page-header">
        <h2>Invoices</h2>
        <p>Appears once the package is received by the customer (stage 6)</p>
      </div>

      {invoiceReady.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><FileText size={26} /></div>
            <h3>No invoices ready</h3>
            <p>Advance a shipment to "Received by customer" in the Tracking tab to generate an invoice.</p>
          </div>
        </div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          {invoiceReady.map(order => {
            const inv      = getInv(order.id)
            const feeLines = buildFeeLines(order, inv)
            const total    = feeLines.reduce((s, l) => s + l.amount, 0)
            const currency = inv?.currency || order?.rate_currency || 'USD'
            const tRow     = tracking.find(t => t.order_id === order.id)

            return (
              <div className="card" key={order.id}>
                <div className="card-header">
                  <div>
                    <span className="fw-700 font-brand text-navy" style={{fontSize:15}}>
                      {order.customer_name}
                    </span>
                    <span className="text-sm text-muted" style={{marginLeft:10}}>
                      {new Date(order.order_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                    </span>
                    <span className={`badge ${order.service_type === 'full_service' ? 'badge-navy' : 'badge-gray'}`}
                      style={{marginLeft:8}}>
                      {order.service_type === 'full_service' ? 'Full Service' : 'Shipping Only'}
                    </span>
                  </div>
                  <div className="flex-center gap-8">
                    <button className="btn btn-outline btn-sm"
                      onClick={() => generateInvoicePDF(order, inv, feeLines)}>
                      <Printer size={13} /> Print
                    </button>
                    <button className="btn btn-green btn-sm" onClick={() => setConfirmId(order.id)}>
                      <CheckCircle size={13} /> Complete
                    </button>
                  </div>
                </div>

                <div className="card-body">
                  {/* Order summary grid */}
                  <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px 16px', marginBottom:16}}>
                    {[
                      ['Direction',   DIR_LABEL[order.direction] || order.direction_other_note || 'Other'],
                      ['Service',     order.service_type === 'full_service' ? 'Full Service' : 'Shipping Only'],
                      ['Goods',       order.goods_description || '—'],
                      ['Weight',      order.weight_kg ? `${order.weight_kg} kg` : '—'],
                      ['Chargeable',  order.chargeable_weight_kg ? `${order.chargeable_weight_kg} kg` : '—'],
                      ['Tracking',    tRow?.tracking_number || '—'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div className="text-sm text-muted" style={{marginBottom:2}}>{k}</div>
                        <div style={{fontSize:13, fontWeight:500}}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {order.goods_link && (
                    <div style={{marginBottom:12}}>
                      <a href={order.goods_link} target="_blank" rel="noreferrer"
                        className="text-sm" style={{color:'var(--blue)'}}>
                        🔗 Order link
                      </a>
                    </div>
                  )}

                  <hr />

                  {/* Fee lines */}
                  {feeLines.length === 0 ? (
                    <p className="text-sm text-muted" style={{marginBottom:12}}>
                      No pricing set at order time. Add costs below or set base price manually.
                    </p>
                  ) : (
                    feeLines.map((l, i) => (
                      <div key={i} className="cost-row">
                        <span className="text-sm">{l.label}</span>
                        <span className="text-sm fw-700">{formatCurrency(l.amount, l.currency)}</span>
                      </div>
                    ))
                  )}

                  {/* Total */}
                  <div className="cost-total" style={{marginTop:10}}>
                    <span className="cost-total-label">Total Due</span>
                    <span className="cost-total-value">{formatCurrency(total, currency)}</span>
                  </div>

                  {/* Add invoice-time cost */}
                  <div style={{marginTop:14}}>
                    {addCostId === order.id ? (
                      <div style={{background:'var(--gray-50)', borderRadius:'var(--r-md)', padding:14}}>
                        <div className="flex-between" style={{marginBottom:10}}>
                          <div className="form-label" style={{marginBottom:0}}>Add Additional Cost</div>
                          <button className="btn-ghost" onClick={() => setAddCostId(null)}><X size={14}/></button>
                        </div>
                        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                          <input className="form-input" style={{flex:2, minWidth:130}} type="text"
                            placeholder="e.g. Customs fee, Insurance"
                            value={costDesc} onChange={e => setCostDesc(e.target.value)} />
                          <input className="form-input" style={{flex:1, minWidth:80}} type="number"
                            min="0" step="0.01" placeholder="Amount"
                            value={costAmt} onChange={e => setCostAmt(e.target.value)} />
                          <select className="form-select" style={{width:80}}
                            value={costCur} onChange={e => setCostCur(e.target.value)}>
                            <option>USD</option>
                            <option>IDR</option>
                          </select>
                          <button className="btn btn-primary btn-sm" disabled={savingCost}
                            onClick={() => handleAddCost(order.id)}>
                            {savingCost ? '…' : 'Add'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-outline btn-sm" onClick={() => setAddCostId(order.id)}>
                        <Plus size={13} /> Additional Cost
                      </button>
                    )}
                  </div>

                  {/* Full service pricing notes */}
                  {order.full_service_pricing_notes && (
                    <div style={{marginTop:12, padding:10, background:'var(--gold-pale)',
                      borderRadius:'var(--r-md)', fontSize:12, color:'var(--amber)'}}>
                      📋 Pricing note: {order.full_service_pricing_notes}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirm complete modal */}
      {confirmId && (
        <div className="overlay">
          <div className="confirm-modal">
            <h3>Mark as Complete?</h3>
            <p>
              This will lock the invoice total, move the order to <strong>Completed</strong>,
              and remove it from Orders, Tracking, and Invoices.{' '}
              <strong>You can revert it from the Completed tab if needed.</strong>
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

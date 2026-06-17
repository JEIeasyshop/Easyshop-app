// src/components/InvoiceTab.jsx
import { useState } from 'react'
import { FileText, Printer, CheckCircle, Plus } from 'lucide-react'
import { getStageSequence } from '../lib/data'
import { generateInvoicePDF } from '../lib/pdf'

export default function InvoiceTab({ orders, tracking, invoices, addAdditionalCost, upsertInvoice, completeOrder }) {
  const [confirmId, setConfirmId]   = useState(null)
  const [addCostId, setAddCostId]   = useState(null)
  const [costDesc, setCostDesc]     = useState('')
  const [costAmt, setCostAmt]       = useState('')
  const [completing, setCompleting] = useState(false)

  const invoiceReady = orders.filter(o => {
    const t = tracking.find(t => t.order_id === o.id)
    if (!t) return false
    const seq = getStageSequence(o.service_type)
    return t.current_stage === seq[seq.length - 1]
  })

  const getInv = (oid) => invoices.find(i => i.order_id === oid)

  const handleAddCost = async (oid) => {
    if (!costDesc.trim() || !costAmt) return
    await addAdditionalCost(oid, costDesc.trim(), parseFloat(costAmt))
    setCostDesc(''); setCostAmt(''); setAddCostId(null)
  }

  const handleComplete = async (oid) => {
    setCompleting(true)
    try { await completeOrder(oid); setConfirmId(null) }
    finally { setCompleting(false) }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Invoices</h2>
        <p>Appears once the package is received by the customer</p>
      </div>

      {invoiceReady.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><FileText size={26} /></div>
            <h3>No invoices ready</h3>
            <p>Invoices appear once a shipment reaches the final delivery stage.</p>
          </div>
        </div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          {invoiceReady.map(order => {
            const inv    = getInv(order.id)
            const extras = inv?.additional_costs || []
            const base   = Number(inv?.base_price || 0)
            const extra  = extras.reduce((s, c) => s + Number(c.amount), 0)
            const total  = base + extra

            return (
              <div className="card" key={order.id}>
                <div className="card-header">
                  <div>
                    <span className="fw-700 font-brand text-navy" style={{fontSize:15}}>{order.customer_name}</span>
                    <span className="text-sm text-muted" style={{marginLeft:10}}>
                      {new Date(order.order_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                    </span>
                  </div>
                  <div className="flex-center gap-8">
                    <button className="btn btn-outline btn-sm" onClick={() => generateInvoicePDF(order, inv)}>
                      <Printer size={13} /> Print
                    </button>
                    <button className="btn btn-green btn-sm" onClick={() => setConfirmId(order.id)}>
                      <CheckCircle size={13} /> Complete
                    </button>
                  </div>
                </div>

                <div className="card-body">
                  {/* Summary grid */}
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 20px', marginBottom:18}}>
                    {[
                      ['Direction', order.direction === 'us_jkt' ? 'US → JKT' : order.direction === 'jkt_us' ? 'JKT → US' : order.direction_other_note || 'Other'],
                      ['Service',   order.service_type === 'full_service' ? 'Full Service' : 'Shipping Only'],
                      ['Goods',     order.goods_description || '—'],
                      ['Weight',    order.weight_kg ? `${order.weight_kg} kg` : '—'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div className="text-sm text-muted" style={{marginBottom:2}}>{k}</div>
                        <div style={{fontSize:13, fontWeight:500}}>{v}</div>
                      </div>
                    ))}
                  </div>

                  <hr />

                  {/* Cost breakdown */}
                  <div className="cost-row">
                    <span>Base price</span>
                    <span>${base.toFixed(2)}</span>
                  </div>
                  {extras.map((c, i) => (
                    <div key={i} className="cost-row text-muted">
                      <span>{c.description}</span>
                      <span>+${Number(c.amount).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="cost-total">
                    <span className="cost-total-label">Total Due</span>
                    <span className="cost-total-value">${total.toFixed(2)}</span>
                  </div>

                  {/* Add cost */}
                  <div style={{marginTop:14}}>
                    {addCostId === order.id ? (
                      <div style={{background:'var(--gray-50)', borderRadius:'var(--r-md)', padding:14}}>
                        <div className="form-label" style={{marginBottom:8}}>Add Additional Cost</div>
                        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                          <input className="form-input" style={{flex:2, minWidth:130}} type="text"
                            placeholder="e.g. Customs fee"
                            value={costDesc} onChange={e => setCostDesc(e.target.value)} />
                          <input className="form-input" style={{flex:1, minWidth:80}} type="number"
                            min="0" step="0.01" placeholder="Amount"
                            value={costAmt} onChange={e => setCostAmt(e.target.value)} />
                          <button className="btn btn-primary btn-sm" onClick={() => handleAddCost(order.id)}>Add</button>
                          <button className="btn btn-outline btn-sm" onClick={() => setAddCostId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-outline btn-sm" onClick={() => setAddCostId(order.id)}>
                        <Plus size={13} /> Additional Cost
                      </button>
                    )}
                  </div>
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
              This will move the order, tracking, and invoice to <strong>Completed</strong> and
              remove them from all active tabs. <strong>This cannot be undone.</strong>
            </p>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={() => setConfirmId(null)}>Cancel</button>
              <button className="btn btn-green" disabled={completing} onClick={() => handleComplete(confirmId)}>
                {completing ? 'Processing…' : 'Yes, Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

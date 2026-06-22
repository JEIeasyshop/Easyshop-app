// src/components/CompletedTab.jsx
// Connected to: completedOrders (snapshots), revertCompleted, deleteCompleted
// JEI pattern: expandable rows, revert + delete options, revenue KPI
import { useState } from 'react'
import { Archive, ChevronDown, ChevronUp, RotateCcw, Trash2, Download } from 'lucide-react'
import { formatCurrency } from '../lib/pricing'
import { generateInvoicePDF } from '../lib/pdf'

const DIR_LABEL = { us_jkt: 'US → JKT', jkt_us: 'JKT → US' }

export default function CompletedTab({ completedOrders, revertCompleted, deleteCompleted }) {
  const [expandedId, setExpandedId]   = useState(null)
  const [confirmDel, setConfirmDel]   = useState(null)
  const [confirmRev, setConfirmRev]   = useState(null)
  const [actionBusy, setActionBusy]   = useState(false)
  const [search, setSearch]           = useState('')

  const daysLeft = (d) => Math.max(0, Math.ceil((new Date(d) - new Date()) / 86400000))

  // Filter
  const filtered = completedOrders.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const o = c.order_snapshot || {}
    return (o.customer_name || '').toLowerCase().includes(q) ||
           (o.goods_description || '').toLowerCase().includes(q)
  })

  // Revenue KPI — use locked invoice total
  const totalRevenue = completedOrders.reduce((s, c) => {
    const inv = c.invoice_snapshot || {}
    return s + Number(inv.total || 0)
  }, 0)

  // Build fee summary from snapshot
  const getTotal = (c) => {
    const inv = c.invoice_snapshot || {}
    const ord = c.order_snapshot   || {}
    if (inv.total) return { amount: inv.total, currency: inv.currency || ord.rate_currency || 'USD' }
    return { amount: 0, currency: 'USD' }
  }

  const handleDelete = async (id) => {
    setActionBusy(true)
    try { await deleteCompleted(id); setConfirmDel(null) }
    finally { setActionBusy(false) }
  }

  const handleRevert = async (id) => {
    setActionBusy(true)
    try { await revertCompleted(id); setConfirmRev(null) }
    finally { setActionBusy(false) }
  }

  return (
    <div>
      {/* KPI row */}
      <div className="stat-grid" style={{marginBottom:22}}>
        <div className="stat-card">
          <div className="stat-card-icon navy"><Archive size={18} /></div>
          <div className="stat-value">{completedOrders.length}</div>
          <div className="stat-label">Total Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon gold" style={{fontSize:18}}>$</div>
          <div className="stat-value" style={{fontSize:18}}>
            {formatCurrency(totalRevenue, 'USD')}
          </div>
          <div className="stat-label">Total Revenue (14d)</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon green" style={{fontSize:18}}>📋</div>
          <div className="stat-value">{filtered.length}</div>
          <div className="stat-label">Showing</div>
        </div>
      </div>

      <div className="page-header-row">
        <div className="page-header" style={{marginBottom:0}}>
          <h2>Completed</h2>
          <p>Records kept for 14 days — click a row to expand details</p>
        </div>
        <input className="form-input" style={{maxWidth:220}} type="text"
          placeholder="Search customer or goods…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="card mt-16">
          <div className="empty-state">
            <div className="empty-icon"><Archive size={26} /></div>
            <h3>{search ? 'No results' : 'No completed orders'}</h3>
            <p>{search ? 'Try a different search.' : 'Completed orders will appear here for 14 days.'}</p>
          </div>
        </div>
      ) : (
        <div className="card mt-16">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Completed</th>
                  <th>Customer</th>
                  <th>Direction</th>
                  <th>Service</th>
                  <th>Goods</th>
                  <th>Total</th>
                  <th>Deletes in</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const o    = c.order_snapshot   || {}
                  const inv  = c.invoice_snapshot || {}
                  const t    = c.tracking_snapshot|| {}
                  const days = daysLeft(c.auto_delete_after)
                  const tot  = getTotal(c)
                  const isExp = expandedId === c.id

                  return <>
                    <tr key={c.id} style={{cursor:'pointer'}}
                      onClick={() => setExpandedId(isExp ? null : c.id)}>
                      <td className="text-sm text-muted">
                        {new Date(c.completed_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                      </td>
                      <td style={{fontWeight:600}}>{o.customer_name || '—'}</td>
                      <td className="text-sm">
                        {DIR_LABEL[o.direction] || o.direction_other_note || 'Other'}
                      </td>
                      <td>
                        <span className={`badge ${o.service_type === 'full_service' ? 'badge-navy' : 'badge-gray'}`}>
                          {o.service_type === 'full_service' ? 'Full Service' : 'Shipping Only'}
                        </span>
                      </td>
                      <td className="text-sm ellipsis" style={{maxWidth:180}}>
                        {o.goods_description || '—'}
                      </td>
                      <td style={{fontWeight:700}}>
                        {tot.amount ? formatCurrency(tot.amount, tot.currency) : '—'}
                      </td>
                      <td>
                        <span className={`badge ${days <= 3 ? 'badge-amber' : 'badge-gray'}`}>
                          {days}d
                        </span>
                      </td>
                      <td>
                        {isExp ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </td>
                    </tr>

                    {/* Expanded detail panel */}
                    {isExp && (
                      <tr key={c.id + '-exp'}>
                        <td colSpan={8} style={{padding:0, background:'var(--gray-50)'}}>
                          <div style={{padding:'16px 20px'}}>
                            {/* Detail grid */}
                            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px 20px', marginBottom:16}}>
                              {[
                                ['Order Date',   o.order_date ? new Date(o.order_date).toLocaleDateString('en-GB') : '—'],
                                ['Weight',       o.weight_kg ? `${o.weight_kg} kg` : '—'],
                                ['Chargeable',   o.chargeable_weight_kg ? `${o.chargeable_weight_kg} kg` : '—'],
                                ['Rate/kg',      o.rate_per_kg ? formatCurrency(o.rate_per_kg, o.rate_currency || 'USD') : '—'],
                                ['Carrier',      t.carrier_id || '—'],
                                ['Tracking',     t.tracking_number || '—'],
                              ].map(([k, v]) => (
                                <div key={k}>
                                  <div className="text-sm text-muted" style={{marginBottom:2}}>{k}</div>
                                  <div style={{fontSize:13, fontWeight:500}}>{v}</div>
                                </div>
                              ))}
                            </div>

                            {/* Fee breakdown */}
                            {inv.additional_costs?.length > 0 && (
                              <div style={{marginBottom:12}}>
                                <div className="text-sm text-muted fw-700" style={{marginBottom:6}}>Invoice Cost Lines</div>
                                {inv.additional_costs.map((c2, i) => (
                                  <div key={i} className="cost-row">
                                    <span className="text-sm">{c2.description}</span>
                                    <span className="text-sm">{formatCurrency(c2.amount, c2.currency || tot.currency)}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="cost-total" style={{marginBottom:16}}>
                              <span className="cost-total-label">Total</span>
                              <span className="cost-total-value">{formatCurrency(tot.amount, tot.currency)}</span>
                            </div>

                            {/* Notes */}
                            {o.additional_notes && (
                              <div style={{marginBottom:14, padding:10, background:'var(--white)',
                                border:'1px solid var(--gray-200)', borderRadius:'var(--r-md)',
                                fontSize:13, color:'var(--gray-600)'}}>
                                <strong>Notes:</strong> {o.additional_notes}
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex-center gap-8">
                              <button className="btn btn-outline btn-sm"
                                onClick={() => generateInvoicePDF(o, inv, inv.additional_costs || [])}>
                                <Download size={13} /> Download PDF
                              </button>
                              <button className="btn btn-outline btn-sm"
                                style={{color:'var(--amber)', borderColor:'var(--amber)'}}
                                onClick={e => { e.stopPropagation(); setConfirmRev(c.id) }}>
                                <RotateCcw size={13} /> Revert to Invoice + Cost
                              </button>
                              <button className="btn btn-danger btn-sm"
                                onClick={e => { e.stopPropagation(); setConfirmDel(c.id) }}>
                                <Trash2 size={13} /> Delete Permanently
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="overlay">
          <div className="confirm-modal">
            <h3>Delete Permanently?</h3>
            <p>This record will be removed completely. <strong>This cannot be undone.</strong></p>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={actionBusy}
                onClick={() => handleDelete(confirmDel)}>
                {actionBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm revert */}
      {confirmRev && (
        <div className="overlay">
          <div className="confirm-modal">
            <h3>Revert to Invoice + Cost?</h3>
            <p>
              This will move the order back to the <strong>Invoice tab</strong> and restore its cost sheet in the <strong>Cost tab</strong> — with both checkmarks reset so you can re-edit. The cost lines you previously entered will be preserved.
            </p>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={() => setConfirmRev(null)}>Cancel</button>
              <button className="btn btn-gold" disabled={actionBusy}
                onClick={() => handleRevert(confirmRev)}>
                {actionBusy ? 'Reverting…' : 'Yes, Revert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

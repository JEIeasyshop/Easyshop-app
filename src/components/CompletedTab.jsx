// src/components/CompletedTab.jsx
import { useState, useMemo } from 'react'
import { Archive, ChevronDown, ChevronUp, RotateCcw, Trash2, Download, Search } from 'lucide-react'
import { formatCurrency } from '../lib/pricing'
import { generateInvoicePDF } from '../lib/pdf'

const DIR_LABEL = { us_jkt: 'US → JKT', jkt_us: 'JKT → US' }
const DEFAULT_FX = 15850

export default function CompletedTab({ completedOrders, revertCompleted, deleteCompleted }) {
  const [expandedId, setExpandedId] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [confirmRev, setConfirmRev] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [search, setSearch]               = useState('')
  const [dirFilter, setDirFilter]         = useState('All')   // All | US → JKT | JKT → US | Other
  const [serviceFilter, setServiceFilter] = useState('All')   // All | Full Service | Shipping Only
  const [profitFilter, setProfitFilter]   = useState('All')   // All | Profitable | Loss

  // ── Helpers (must be defined before filtered useMemo) ────
  const getRevenue = (c) => {
    const inv = c.invoice_snapshot || {}
    const ord = c.order_snapshot   || {}
    const cur = inv.currency || ord.rate_currency || 'USD'
    return { amount: Number(inv.total || 0), currency: cur }
  }
  const getCostIDR = (c) => {
    const cost  = c.cost_snapshot   || {}
    const inv   = c.invoice_snapshot|| {}
    const lines = cost.cost_lines   || []
    const fx    = Number(cost.usd_rate || inv.usd_rate || DEFAULT_FX)
    return lines.reduce((s, l) => {
      const sub = Number(l.amount) * (Number(l.qty) || 1)
      return s + (l.currency === 'IDR' ? sub : sub * fx)
    }, 0)
  }
  const getRevIDR = (c) => {
    const rev  = getRevenue(c)
    const inv  = c.invoice_snapshot || {}
    const cost = c.cost_snapshot    || {}
    const fx   = Number(cost.usd_rate || inv.usd_rate || DEFAULT_FX)
    return rev.currency === 'IDR' ? rev.amount : rev.amount * fx
  }
  const getProfitIDR = (c) => getRevIDR(c) - getCostIDR(c)

  const filtered = useMemo(() => completedOrders.filter(c => {
    const o = c.order_snapshot || {}
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!(o.customer_name || '').toLowerCase().includes(q) &&
          !(o.goods_description || '').toLowerCase().includes(q)) return false
    }
    if (dirFilter !== 'All') {
      const dl = DIR_LABEL[o.direction] || 'Other'
      if (dirFilter === 'Other' ? !!DIR_LABEL[o.direction] : dl !== dirFilter) return false
    }
    if (serviceFilter !== 'All') {
      const sl = o.service_type === 'full_service' ? 'Full Service' : 'Shipping Only'
      if (sl !== serviceFilter) return false
    }
    if (profitFilter !== 'All') {
      const p = getProfitIDR(c)
      if (profitFilter === 'Profitable' && p < 0)  return false
      if (profitFilter === 'Loss'       && p >= 0) return false
    }
    return true
  }), [completedOrders, search, dirFilter, serviceFilter, profitFilter])

  // (helpers moved above filtered useMemo)

  // KPIs
  const totalRevIDR  = completedOrders.reduce((s, c) => s + getRevIDR(c), 0)
  const totalCostIDR = completedOrders.reduce((s, c) => s + getCostIDR(c), 0)
  const totalProfit  = totalRevIDR - totalCostIDR

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
      <div className="kpi-grid kpi-grid-4" style={{marginBottom:20}}>
        <div className="kpi-card">
          <div className="kpi-label">TOTAL COMPLETED</div>
          <div className="kpi-value">{completedOrders.length}</div>
          <div className="kpi-sub">all time</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">TOTAL REVENUE</div>
          <div className="kpi-value" style={{fontSize:18}}>Rp {Math.round(totalRevIDR).toLocaleString('id-ID')}</div>
          <div className="kpi-sub">from completed orders</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">TOTAL COST</div>
          <div className="kpi-value" style={{fontSize:18, color:'var(--red)'}}>Rp {Math.round(totalCostIDR).toLocaleString('id-ID')}</div>
          <div className="kpi-sub">all cost lines</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">NET PROFIT</div>
          <div className="kpi-value" style={{fontSize:18, color: totalProfit >= 0 ? 'var(--green)' : 'var(--red)'}}>
            Rp {Math.round(totalProfit).toLocaleString('id-ID')}
          </div>
          <div className="kpi-sub">revenue − cost</div>
        </div>
      </div>

      {/* Header + search */}
      {/* Toolbar — title + 3 dropdowns + search */}
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap'}}>
        <div style={{flex:'0 0 auto'}}>
          <h2 style={{margin:0, fontSize:18, fontFamily:'var(--font-brand)', fontWeight:800, color:'var(--navy)'}}>Completed</h2>
          <p style={{margin:0, fontSize:12, color:'var(--gray-400)'}}>Click a row to expand details</p>
        </div>
        <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
          {[
            {
              val: dirFilter, set: setDirFilter,
              options:[
                ['All', `All Routes (${completedOrders.length})`],
                ['US → JKT', `US → JKT (${completedOrders.filter(c=>(c.order_snapshot||{}).direction==='us_jkt').length})`],
                ['JKT → US', `JKT → US (${completedOrders.filter(c=>(c.order_snapshot||{}).direction==='jkt_us').length})`],
                ['Other',    `Other (${completedOrders.filter(c=>!['us_jkt','jkt_us'].includes((c.order_snapshot||{}).direction)).length})`],
              ]
            },
            {
              val: serviceFilter, set: setServiceFilter,
              options:[
                ['All',           `All Service (${completedOrders.length})`],
                ['Full Service',  `Full Service (${completedOrders.filter(c=>(c.order_snapshot||{}).service_type==='full_service').length})`],
                ['Shipping Only', `Shipping Only (${completedOrders.filter(c=>(c.order_snapshot||{}).service_type!=='full_service').length})`],
              ]
            },
            {
              val: profitFilter, set: setProfitFilter,
              options:[
                ['All',        `All P&L (${completedOrders.length})`],
                ['Profitable', `Profitable (${completedOrders.filter(c=>getProfitIDR(c)>=0).length})`],
                ['Loss',       `Loss (${completedOrders.filter(c=>getProfitIDR(c)<0).length})`],
              ]
            },
          ].map(({ val, set, options }, i) => (
            <select key={i} value={val} onChange={e => set(e.target.value)}
              style={{
                height:36, padding:'0 32px 0 12px', border:'1.5px solid var(--gray-200)',
                borderRadius:'var(--r-md)', fontSize:13, fontFamily:'var(--font-body)',
                color: val !== 'All' ? 'var(--navy)' : 'var(--gray-600)',
                fontWeight: val !== 'All' ? 700 : 400,
                background:`var(--white) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238E97AD' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 10px center`,
                appearance:'none', cursor:'pointer', outline:'none',
              }}>
              {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
          <div className="search-wrap" style={{width:240}}>
            <Search size={14} className="search-icon" />
            <input className="search-input" type="text" placeholder="Search customer or goods…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card mt-16">
          <div className="empty-state">
            <div className="empty-icon"><Archive size={26} /></div>
            <h3>{search || dirFilter !== 'All' || serviceFilter !== 'All' || profitFilter !== 'All' ? 'No results' : 'No completed orders'}</h3>
            <p>{search || dirFilter !== 'All' || serviceFilter !== 'All' || profitFilter !== 'All' ? 'Try clearing the filters.' : 'Completed orders will appear here.'}</p>
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
                  <th>Revenue</th>
                  <th>Cost</th>
                  <th>Profit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const o      = c.order_snapshot    || {}
                  const inv    = c.invoice_snapshot   || {}
                  const cost   = c.cost_snapshot      || {}
                  const t      = c.tracking_snapshot  || {}
                  const isExp  = expandedId === c.id
                  const rev    = getRevenue(c)
                  const revIDR = getRevIDR(c)
                  const costIDR = getCostIDR(c)
                  const profIDR = getProfitIDR(c)
                  const fx     = Number(cost.usd_rate || inv.usd_rate || DEFAULT_FX)

                  return <>
                    <tr key={c.id} style={{cursor:'pointer'}}
                      onClick={() => setExpandedId(isExp ? null : c.id)}>
                      <td className="text-sm text-muted">
                        {new Date(c.completed_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                      </td>
                      <td style={{fontWeight:600}}>{o.customer_name || '—'}</td>
                      <td className="text-sm">{DIR_LABEL[o.direction] || o.direction_other_note || 'Other'}</td>
                      <td>
                        <span className={`badge ${o.service_type === 'full_service' ? 'badge-navy' : 'badge-gray'}`}>
                          {o.service_type === 'full_service' ? 'Full Service' : 'Shipping Only'}
                        </span>
                      </td>
                      <td className="text-sm ellipsis" style={{maxWidth:180}}>{o.goods_description || '—'}</td>
                      <td style={{fontWeight:600, color:'var(--navy)'}}>
                        Rp {Math.round(revIDR).toLocaleString('id-ID')}
                      </td>
                      <td style={{fontWeight:600, color:'var(--red)'}}>
                        Rp {Math.round(costIDR).toLocaleString('id-ID')}
                      </td>
                      <td style={{fontWeight:700, color: profIDR >= 0 ? 'var(--green)' : 'var(--red)'}}>
                        Rp {Math.round(profIDR).toLocaleString('id-ID')}
                      </td>
                      <td>{isExp ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</td>
                    </tr>

                    {/* Expanded detail panel */}
                    {isExp && (
                      <tr key={c.id + '-exp'}>
                        <td colSpan={9} style={{padding:0, background:'var(--gray-50)'}}>
                          <div style={{padding:'16px 20px'}}>
                            {/* Detail grid */}
                            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px 20px', marginBottom:16}}>
                              {[
                                ['Order Date', o.order_date ? new Date(o.order_date).toLocaleDateString('en-GB') : '—'],
                                ['Weight',     o.weight_kg ? `${o.weight_kg} kg` : '—'],
                                ['Chargeable', o.chargeable_weight_kg ? `${o.chargeable_weight_kg} kg` : '—'],
                                ['Rate/kg',    o.rate_per_kg ? formatCurrency(o.rate_per_kg, o.rate_currency || 'USD') : '—'],
                                ['Carrier',    t.carrier_id || '—'],
                                ['Tracking',   t.tracking_number || '—'],
                              ].map(([k, v]) => (
                                <div key={k}>
                                  <div className="text-sm text-muted" style={{marginBottom:2}}>{k}</div>
                                  <div style={{fontSize:13, fontWeight:500}}>{v}</div>
                                </div>
                              ))}
                            </div>

                            {/* Invoice cost lines */}
                            {(inv.additional_costs?.length > 0 || inv.base_price > 0) && (
                              <div style={{marginBottom:12}}>
                                <div className="text-sm text-muted fw-700" style={{marginBottom:6}}>Invoice Lines</div>
                                {inv.base_price > 0 && (
                                  <div className="cost-row">
                                    <span className="text-sm">Base price / Full service fee</span>
                                    <span className="text-sm">{formatCurrency(inv.base_price, rev.currency)}</span>
                                  </div>
                                )}
                                {(inv.additional_costs || []).map((line, i) => (
                                  <div key={i} className="cost-row">
                                    <span className="text-sm">{line.description}</span>
                                    <span className="text-sm">{formatCurrency(line.amount, line.currency || rev.currency)}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Cost lines */}
                            {(cost.cost_lines || []).length > 0 && (
                              <div style={{marginBottom:12}}>
                                <div className="text-sm text-muted fw-700" style={{marginBottom:6}}>Cost Lines</div>
                                {cost.cost_lines.map((line, i) => (
                                  <div key={i} className="cost-row">
                                    <span className="text-sm" style={{color:'var(--red)'}}>{line.description} {line.qty > 1 ? `×${line.qty}` : ''}</span>
                                    <span className="text-sm" style={{color:'var(--red)'}}>
                                      {formatCurrency(Number(line.amount) * (Number(line.qty)||1), line.currency || 'USD')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Revenue / Cost / Profit summary */}
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16}}>
                              {[
                                { label:'Revenue', val:`Rp ${Math.round(revIDR).toLocaleString('id-ID')}`, color:'var(--navy)' },
                                { label:'Cost',    val:`Rp ${Math.round(costIDR).toLocaleString('id-ID')}`, color:'var(--red)' },
                                { label:'Profit',  val:`Rp ${Math.round(profIDR).toLocaleString('id-ID')}`, color: profIDR >= 0 ? 'var(--green)' : 'var(--red)' },
                              ].map(s => (
                                <div key={s.label} style={{
                                  background:'var(--white)', borderRadius:'var(--r-md)',
                                  padding:'10px 14px', border:'1px solid var(--gray-200)', textAlign:'center',
                                }}>
                                  <div className="text-sm text-muted">{s.label}</div>
                                  <div style={{fontFamily:'var(--font-brand)', fontWeight:800, fontSize:14, color:s.color, marginTop:4}}>
                                    {s.val}
                                  </div>
                                </div>
                              ))}
                            </div>

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
              {/* Totals footer */}
              <tfoot>
                <tr style={{background:'var(--navy)'}}>
                  <td colSpan={5} style={{padding:'12px 16px', color:'rgba(255,255,255,0.5)', fontSize:12, fontWeight:700}}>
                    TOTAL ({filtered.length} orders)
                  </td>
                  <td style={{padding:'12px 16px', fontWeight:800, color:'var(--gold)', fontFamily:'var(--font-brand)'}}>
                    Rp {Math.round(filtered.reduce((s,c)=>s+getRevIDR(c),0)).toLocaleString('id-ID')}
                  </td>
                  <td style={{padding:'12px 16px', fontWeight:800, color:'#FCA5A5', fontFamily:'var(--font-brand)'}}>
                    Rp {Math.round(filtered.reduce((s,c)=>s+getCostIDR(c),0)).toLocaleString('id-ID')}
                  </td>
                  <td style={{padding:'12px 16px', fontWeight:800, fontFamily:'var(--font-brand)',
                    color: filtered.reduce((s,c)=>s+getProfitIDR(c),0) >= 0 ? '#6EE7B7' : '#FCA5A5'}}>
                    Rp {Math.round(filtered.reduce((s,c)=>s+getProfitIDR(c),0)).toLocaleString('id-ID')}
                  </td>
                  <td />
                </tr>
              </tfoot>
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
              <button className="btn btn-danger" disabled={actionBusy} onClick={() => handleDelete(confirmDel)}>
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
            <p>This will move the order back to the <strong>Invoice</strong> and <strong>Cost</strong> tabs with checkmarks reset so you can re-edit.</p>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={() => setConfirmRev(null)}>Cancel</button>
              <button className="btn btn-gold" disabled={actionBusy} onClick={() => handleRevert(confirmRev)}>
                {actionBusy ? 'Reverting…' : 'Yes, Revert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

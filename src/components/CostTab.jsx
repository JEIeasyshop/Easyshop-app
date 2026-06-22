// src/components/CostTab.jsx
// Cost sheet created with every order.
// "Cost Completed" ✓ toggle at bottom — when both invoice + cost are done → auto-archive.
import { useState, useMemo } from 'react'
import { Receipt, Plus, Trash2, Search, Check, CheckCircle } from 'lucide-react'
import { formatCurrency } from '../lib/pricing'

const DIR_LABEL  = { us_jkt: 'US → JKT', jkt_us: 'JKT → US' }
const DEFAULT_FX = 15850

export default function CostTab({ costs, addCostLine, removeCostLine, updateCostNotes, setDoneFlag, completeCost, deleteOrder }) {
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch]         = useState('')
  const [completing, setCompleting] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting, setDeleting]     = useState(false)

  const [lineDesc, setLineDesc]     = useState('')
  const [lineAmt, setLineAmt]       = useState('')
  const [lineQty, setLineQty]       = useState('1')
  const [lineCur, setLineCur]       = useState('USD')
  const [savingLine, setSavingLine] = useState(false)

  const [usdRate, setUsdRate]       = useState('')
  const [savingRate, setSavingRate] = useState(false)
  const [togglingCost, setTogglingCost] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return costs
    return costs.filter(c => {
      const o = c.order_snapshot || {}
      return (o.customer_name || '').toLowerCase().includes(q) ||
             (o.goods_description || '').toLowerCase().includes(q)
    })
  }, [costs, search])

  const selected = costs.find(c => c.id === selectedId)

  const toIDR = (amount, cur, rate) => {
    const fx = parseFloat(rate) || DEFAULT_FX
    return cur === 'IDR' ? amount : amount * fx
  }

  const getRevIDR = (rec) => {
    const inv = rec.invoice_snapshot || {}
    const rev = Number(rec.total_revenue || inv.total || 0)
    const cur = rec.currency || inv.currency || 'USD'
    const fx  = parseFloat(rec.usd_rate) || DEFAULT_FX
    return toIDR(rev, cur, fx)
  }

  const getCostIDR = (rec, fxOverride) => {
    const lines = rec.cost_lines || []
    const fx    = fxOverride || parseFloat(rec.usd_rate) || DEFAULT_FX
    return lines.reduce((s, l) => s + toIDR(Number(l.amount) * (Number(l.qty)||1), l.currency||'USD', fx), 0)
  }

  const handleAddLine = async () => {
    if (!lineDesc.trim() || !lineAmt || !selectedId) return
    setSavingLine(true)
    try {
      await addCostLine(selectedId, {
        description: lineDesc.trim(), amount: parseFloat(lineAmt),
        qty: parseInt(lineQty)||1, currency: lineCur,
      })
      setLineDesc(''); setLineAmt(''); setLineQty('1')
    } finally { setSavingLine(false) }
  }

  const handleSaveRate = async () => {
    if (!selectedId) return
    setSavingRate(true)
    try { await updateCostNotes(selectedId, selected?.notes||'', parseFloat(usdRate)||null) }
    finally { setSavingRate(false) }
  }

  const handleToggleCostDone = async () => {
    if (!selectedId) return
    setTogglingCost(true)
    try { await setDoneFlag(selectedId, 'cost_done', !selected?.cost_done) }
    finally { setTogglingCost(false) }
  }

  return (
    <div>
      <div className="page-header-row">
        <div className="page-header" style={{marginBottom:0}}>
          <h2>Cost</h2>
          <p>Track costs against each order. Invoice ✓ + Cost ✓ = archived to Completed.</p>
        </div>
        <div className="search-wrap" style={{maxWidth:280}}>
          <Search size={14} className="search-icon" />
          <input className="search-input" type="text" placeholder="Search…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card mt-16">
          <div className="empty-state">
            <div className="empty-icon"><Receipt size={26} /></div>
            <h3>{search ? 'No results' : 'No orders yet'}</h3>
            <p>A cost sheet is created automatically with each new order.</p>
          </div>
        </div>
      ) : (<>
        {/* Cost list */}
        <div className="inv-list mt-16">
          {filtered.map(rec => {
            const o         = rec.order_snapshot || {}
            const revIDR    = getRevIDR(rec)
            const costIDR   = getCostIDR(rec)
            const profitIDR = revIDR - costIDR
            const isSel     = selectedId === rec.id
            const invDone   = rec.invoice_done || false
            const costDone  = rec.cost_done    || false

            return (
              <div key={rec.id}
                className={`inv-row ${isSel ? 'inv-row-active' : ''}`}
                onClick={() => {
                  setSelectedId(prev => prev === rec.id ? null : rec.id)
                  setUsdRate(rec.usd_rate?.toString() || '')
                }}>
                {/* Left — grid layout */}
                <div style={{display:'grid', gridTemplateColumns:'auto auto 1fr', alignItems:'center', gap:10, overflow:'hidden', minWidth:0}}>
                  {/* Cost done circle */}
                  <div onClick={async e => { e.stopPropagation(); const toggled = !costDone; await setDoneFlag(rec.id, 'cost_done', toggled) }}
                    style={{
                      width:20, height:20, borderRadius:'50%', flexShrink:0, cursor:'pointer',
                      border:`2px solid ${costDone ? 'var(--green)' : 'var(--gray-200)'}`,
                      background: costDone ? 'var(--green)' : 'transparent',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all 0.15s',
                    }}>
                    {costDone && <Check size={11} color="white" strokeWidth={3} />}
                  </div>
                  <span className="text-mono text-sm fw-700" style={{color:'var(--navy)', whiteSpace:'nowrap'}}>
                    ORD-{(rec.original_order_id||'').substring(0,6).toUpperCase()}
                  </span>
                  <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    <span style={{fontWeight:700}}>{o.customer_name||'—'}</span>
                    <span className="text-muted" style={{fontWeight:400, marginLeft:8, fontSize:13}}>
                      {DIR_LABEL[o.direction] || o.direction_other_note || 'Other'}
                      {o.goods_description ? ` · ${o.goods_description}` : ''}
                    </span>
                  </span>
                </div>

                {/* Right — financials + status dots */}
                <div className="flex-center gap-12" style={{flexShrink:0, marginLeft:12}}>
                  <div className="flex-center gap-6">
                    <div style={{width:8, height:8, borderRadius:'50%', background: invDone ? 'var(--green)' : 'var(--gray-200)'}} title="Invoice done" />
                    <div style={{width:8, height:8, borderRadius:'50%', background: costDone ? 'var(--green)' : 'var(--gray-200)'}} title="Cost done" />
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div className="text-sm text-muted">Revenue</div>
                    <div style={{fontWeight:700, color:'var(--navy)', whiteSpace:'nowrap'}}>Rp {Math.round(revIDR).toLocaleString('id-ID')}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div className="text-sm text-muted">Cost</div>
                    <div style={{fontWeight:700, color:'var(--red)', whiteSpace:'nowrap'}}>Rp {Math.round(costIDR).toLocaleString('id-ID')}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div className="text-sm text-muted">Profit</div>
                    <div style={{fontWeight:700, whiteSpace:'nowrap', color: profitIDR >= 0 ? 'var(--green)' : 'var(--red)'}}>
                      Rp {Math.round(profitIDR).toLocaleString('id-ID')}
                    </div>
                  </div>
                  <button className="btn-ghost btn-sm" title="Delete order" style={{color:'var(--red)'}}
                    onClick={e => { e.stopPropagation(); setConfirmDel(rec.original_order_id) }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Expanded cost panel */}
        {selected && (() => {
          const o         = selected.order_snapshot  || {}
          const lines     = selected.cost_lines      || []
          const fx        = parseFloat(usdRate) || parseFloat(selected.usd_rate) || DEFAULT_FX
          const revIDR    = getRevIDR(selected)
          const costIDR   = getCostIDR(selected, fx)
          const profitIDR = revIDR - costIDR
          const margin    = revIDR > 0 ? Math.round((profitIDR / revIDR) * 100) : 0
          const invDone   = selected.invoice_done || false
          const costDone  = selected.cost_done    || false

          return (
            <div className="inv-doc">
              {/* Header */}
              <div className="inv-doc-header" style={{marginBottom:16}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)', fontWeight:800, fontSize:16, color:'var(--navy)'}}>
                    {o.customer_name} — Cost Sheet
                  </div>
                  <div className="text-sm text-muted" style={{marginTop:3}}>
                    {DIR_LABEL[o.direction] || o.direction_other_note || 'Other'}
                    {o.goods_description ? ` · ${o.goods_description}` : ''}
                  </div>
                </div>
              </div>

              <hr />

              {/* KPI row */}
              <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20}}>
                {[
                  { label:'Revenue',    val:`Rp ${Math.round(revIDR).toLocaleString('id-ID')}`,    color:'var(--navy)' },
                  { label:'Total Cost', val:`Rp ${Math.round(costIDR).toLocaleString('id-ID')}`,   color:'var(--red)'  },
                  { label:'Profit',     val:`Rp ${Math.round(profitIDR).toLocaleString('id-ID')}`, color: profitIDR >= 0 ? 'var(--green)' : 'var(--red)' },
                  { label:'Margin',     val:`${margin}%`,                                           color: margin >= 0  ? 'var(--green)' : 'var(--red)'  },
                ].map(s => (
                  <div key={s.label} style={{background:'var(--gray-50)', borderRadius:'var(--r-md)', padding:'14px 16px', textAlign:'center'}}>
                    <div className="text-sm text-muted" style={{marginBottom:4}}>{s.label}</div>
                    <div style={{fontFamily:'var(--font-brand)', fontWeight:800, fontSize:15, color:s.color}}>{s.val}</div>
                  </div>
                ))}
              </div>

              {/* Cost lines */}
              <div style={{marginBottom:16}}>
                <div className="inv-section-label" style={{marginBottom:8}}>COST LINES</div>
                {lines.length === 0 ? (
                  <p className="text-sm text-muted">No cost lines yet. Add below.</p>
                ) : (
                  <table style={{width:'100%', borderCollapse:'collapse'}}>
                    <thead>
                      <tr>
                        {['Description','Qty','Unit Cost','Total','In IDR',''].map((h, i) => (
                          <th key={i} style={{textAlign:i===0?'left':'right', padding:'6px 0', fontSize:11, color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.07em', borderBottom:'1px solid var(--gray-200)', width:h===''?32:undefined}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, i) => {
                        const sub    = Number(l.amount) * (Number(l.qty)||1)
                        const subIDR = toIDR(sub, l.currency||'USD', fx)
                        return (
                          <tr key={i}>
                            <td style={{padding:'8px 0', fontSize:13, borderBottom:'1px solid var(--gray-100)'}}>{l.description}</td>
                            <td style={{textAlign:'right', padding:'8px 0', fontSize:13, color:'var(--gray-400)', borderBottom:'1px solid var(--gray-100)'}}>{l.qty||1}</td>
                            <td style={{textAlign:'right', padding:'8px 0', fontSize:13, borderBottom:'1px solid var(--gray-100)'}}>{formatCurrency(l.amount, l.currency||'USD')}</td>
                            <td style={{textAlign:'right', padding:'8px 0', fontSize:13, fontWeight:600, borderBottom:'1px solid var(--gray-100)'}}>{formatCurrency(sub, l.currency||'USD')}</td>
                            <td style={{textAlign:'right', padding:'8px 0', fontSize:13, color:'var(--red)', borderBottom:'1px solid var(--gray-100)'}}>Rp {Math.round(subIDR).toLocaleString('id-ID')}</td>
                            <td style={{textAlign:'right', padding:'8px 0', borderBottom:'1px solid var(--gray-100)'}}>
                              <button className="btn-ghost" style={{color:'var(--red)', padding:'2px 4px'}} onClick={() => removeCostLine(selected.id, i)}>
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Add cost line — aligned grid */}
              <div className="inv-add-cost">
                <div className="inv-section-label" style={{marginBottom:10}}>ADD COST LINE</div>
                <div style={{display:'grid', gridTemplateColumns:'1fr auto auto auto auto', gap:8, alignItems:'end'}}>
                  <input className="form-input" type="text"
                    placeholder="e.g. Shipping cost, Repackage fee"
                    value={lineDesc} onChange={e => setLineDesc(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddLine()} />
                  <div>
                    <div className="form-label" style={{marginBottom:4}}>Qty</div>
                    <input className="form-input" style={{width:64}} type="number" min="1"
                      value={lineQty} onChange={e => setLineQty(e.target.value)} />
                  </div>
                  <div>
                    <div className="form-label" style={{marginBottom:4}}>Unit cost</div>
                    <input className="form-input" style={{width:110}} type="number" min="0" step="0.01"
                      placeholder="0.00" value={lineAmt} onChange={e => setLineAmt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddLine()} />
                  </div>
                  <div>
                    <div className="form-label" style={{marginBottom:4}}>Currency</div>
                    <select className="form-select" style={{width:80}} value={lineCur} onChange={e => setLineCur(e.target.value)}>
                      <option>USD</option><option>IDR</option>
                    </select>
                  </div>
                  <button className="btn btn-danger" disabled={savingLine} onClick={handleAddLine} style={{alignSelf:'end'}}>
                    <Plus size={13} /> {savingLine ? '…' : 'Add cost'}
                  </button>
                </div>
                {lineAmt && parseInt(lineQty) > 1 && (
                  <div className="text-sm text-muted" style={{marginTop:6}}>
                    = {lineQty} × {formatCurrency(parseFloat(lineAmt)||0, lineCur)} = <strong>{formatCurrency((parseFloat(lineAmt)||0)*(parseInt(lineQty)||1), lineCur)}</strong>
                  </div>
                )}
              </div>

              {/* FX rate — aligned grid */}
              <div className="inv-fx-box">
                <div className="inv-section-label">USD → IDR RATE</div>
                <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:8, marginTop:8, alignItems:'end'}}>
                  <input className="form-input" type="number" placeholder={DEFAULT_FX}
                    value={usdRate} onChange={e => setUsdRate(e.target.value)} />
                  <button className="btn btn-primary btn-sm" disabled={savingRate} onClick={handleSaveRate} style={{alignSelf:'end'}}>
                    {savingRate ? 'Saving…' : 'Save rate'}
                  </button>
                </div>
              </div>

              {/* Status + Cost Completed toggle at bottom */}
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                marginTop:16, padding:'14px 18px',
                background:'var(--gray-50)', borderRadius:'var(--r-md)',
                border:'1px solid var(--gray-200)',
              }}>
                <div className="flex-center gap-16">
                  <div className="flex-center gap-8">
                    <div style={{width:20, height:20, borderRadius:'50%', border:`2px solid ${invDone?'var(--green)':'var(--gray-300)'}`, background:invDone?'var(--green)':'transparent', display:'flex', alignItems:'center', justifyContent:'center'}}>
                      {invDone && <Check size={11} color="white" strokeWidth={3} />}
                    </div>
                    <span className="text-sm" style={{color:invDone?'var(--green)':'var(--gray-400)', fontWeight:invDone?700:400}}>
                      Invoice {invDone ? 'done ✓' : 'pending'}
                    </span>
                  </div>
                  {invDone && costDone && (
                    <span className="badge badge-green" style={{fontWeight:700}}>🎉 Will auto-archive</span>
                  )}
                </div>

                {/* Cost Completed toggle — prominent, bottom right */}
                <button
                  disabled={togglingCost}
                  onClick={handleToggleCostDone}
                  style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'10px 18px',
                    background: costDone ? 'var(--green)' : 'var(--white)',
                    border: `2px solid ${costDone ? 'var(--green)' : 'var(--gray-300)'}`,
                    borderRadius:'var(--r-md)',
                    cursor:'pointer',
                    transition:'all 0.2s',
                    fontFamily:'var(--font-brand)',
                    fontWeight:700, fontSize:13,
                    color: costDone ? 'white' : 'var(--gray-600)',
                  }}>
                  <div style={{
                    width:22, height:22, borderRadius:'50%',
                    border:`2px solid ${costDone ? 'rgba(255,255,255,0.6)' : 'var(--gray-300)'}`,
                    background: costDone ? 'rgba(255,255,255,0.25)' : 'transparent',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                  }}>
                    {costDone && <Check size={12} color="white" strokeWidth={3} />}
                  </div>
                  {togglingCost ? 'Saving…' : costDone ? 'Cost Completed ✓' : 'Mark Cost Completed'}
                </button>
              </div>
            </div>
          )
        })()}
      </>)}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="overlay">
          <div className="confirm-modal">
            <h3>Delete this order?</h3>
            <p>This will permanently remove the order from all tabs (Orders, Tracking, Invoice). <strong>This cannot be undone.</strong></p>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleting}
                onClick={async () => {
                  setDeleting(true)
                  try {
                    // delete order + all related rows including this cost record
                    await deleteOrder(confirmDel)
                    setConfirmDel(null)
                    setSelectedId(null)
                  } finally { setDeleting(false) }
                }}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

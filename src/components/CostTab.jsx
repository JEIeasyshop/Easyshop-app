// src/components/CostTab.jsx
// Receives completed invoices. User adds cost lines to find profit.
// When done, moves to Completed tab.
import { useState, useMemo } from 'react'
import { Receipt, Plus, Trash2, CheckCircle, Search, X } from 'lucide-react'
import { formatCurrency } from '../lib/pricing'
import { generateInvoicePDF } from '../lib/pdf'

const DIR_LABEL = { us_jkt: 'US → JKT', jkt_us: 'JKT → US' }
const DEFAULT_FX = 15850

export default function CostTab({ costs, addCostLine, removeCostLine, updateCostNotes, completeCost }) {
  const [selectedId, setSelectedId] = useState(null)
  const [confirmId, setConfirmId]   = useState(null)
  const [completing, setCompleting] = useState(false)
  const [search, setSearch]         = useState('')

  // New cost line state
  const [lineDesc, setLineDesc] = useState('')
  const [lineAmt, setLineAmt]   = useState('')
  const [lineQty, setLineQty]   = useState('1')
  const [lineCur, setLineCur]   = useState('USD')
  const [savingLine, setSavingLine] = useState(false)

  const [usdRate, setUsdRate]   = useState('')
  const [savingRate, setSavingRate] = useState(false)

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

  const getCostIDR = (rec) => {
    const lines = rec.cost_lines || []
    const fx    = parseFloat(usdRate) || parseFloat(rec.usd_rate) || DEFAULT_FX
    return lines.reduce((s, l) => {
      const subtotal = Number(l.amount) * (Number(l.qty) || 1)
      return s + toIDR(subtotal, l.currency || 'USD', fx)
    }, 0)
  }

  const handleAddLine = async () => {
    if (!lineDesc.trim() || !lineAmt || !selectedId) return
    setSavingLine(true)
    try {
      await addCostLine(selectedId, {
        description: lineDesc.trim(),
        amount:      parseFloat(lineAmt),
        qty:         parseInt(lineQty) || 1,
        currency:    lineCur,
      })
      setLineDesc(''); setLineAmt(''); setLineQty('1')
    } finally { setSavingLine(false) }
  }

  const handleSaveRate = async () => {
    if (!selectedId) return
    setSavingRate(true)
    try { await updateCostNotes(selectedId, selected?.notes || '', parseFloat(usdRate) || null) }
    finally { setSavingRate(false) }
  }

  const handleComplete = async (id) => {
    setCompleting(true)
    try { await completeCost(id); setConfirmId(null); setSelectedId(null) }
    finally { setCompleting(false) }
  }

  return (
    <div>
      <div className="page-header-row">
        <div className="page-header" style={{marginBottom:0}}>
          <h2>Cost</h2>
          <p>Add cost lines to calculate profit. Complete to archive.</p>
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
            <h3>{search ? 'No results' : 'No cost records yet'}</h3>
            <p>Complete an invoice to move it here.</p>
          </div>
        </div>
      ) : (<>
        {/* Cost list */}
        <div className="inv-list mt-16">
          {filtered.map(rec => {
            const o      = rec.order_snapshot || {}
            const inv    = rec.invoice_snapshot || {}
            const revIDR = getRevIDR(rec)
            const costIDR = getCostIDR(rec)
            const profitIDR = revIDR - costIDR
            const isSel = selectedId === rec.id

            return (
              <div key={rec.id}
                className={`inv-row ${isSel ? 'inv-row-active' : ''}`}
                onClick={() => {
                  setSelectedId(prev => prev === rec.id ? null : rec.id)
                  setUsdRate(rec.usd_rate?.toString() || '')
                }}>
                <div className="flex-center gap-10" style={{overflow:'hidden'}}>
                  <Receipt size={14} style={{color:'var(--navy)', opacity:0.6, flexShrink:0}} />
                  <span className="text-mono text-sm fw-700" style={{color:'var(--navy)', flexShrink:0}}>
                    ORD-{(rec.original_order_id || '').substring(0,6).toUpperCase()}
                  </span>
                  <span style={{fontWeight:700, flexShrink:0}}>{o.customer_name || '—'}</span>
                  <span className="text-muted text-sm ellipsis">
                    {DIR_LABEL[o.direction] || o.direction_other_note || 'Other'}
                    {o.goods_description ? ` · ${o.goods_description}` : ''}
                  </span>
                </div>
                <div className="flex-center gap-12" style={{flexShrink:0}}>
                  <div style={{textAlign:'right'}}>
                    <div className="text-sm text-muted">Revenue</div>
                    <div style={{fontWeight:700, color:'var(--navy)'}}>Rp {Math.round(revIDR).toLocaleString('id-ID')}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div className="text-sm text-muted">Cost</div>
                    <div style={{fontWeight:700, color:'var(--red)'}}>Rp {Math.round(costIDR).toLocaleString('id-ID')}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div className="text-sm text-muted">Profit</div>
                    <div style={{fontWeight:700, color: profitIDR >= 0 ? 'var(--green)' : 'var(--red)'}}>
                      Rp {Math.round(profitIDR).toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Expanded cost panel */}
        {selected && (() => {
          const o      = selected.order_snapshot  || {}
          const inv    = selected.invoice_snapshot || {}
          const lines  = selected.cost_lines       || []
          const fx     = parseFloat(usdRate) || parseFloat(selected.usd_rate) || DEFAULT_FX
          const revIDR = getRevIDR(selected)
          const costIDR = lines.reduce((s, l) => {
            return s + toIDR(Number(l.amount) * (Number(l.qty) || 1), l.currency || 'USD', fx)
          }, 0)
          const profitIDR = revIDR - costIDR
          const margin    = revIDR > 0 ? Math.round((profitIDR / revIDR) * 100) : 0

          return (
            <div className="inv-doc">
              {/* Header */}
              <div className="inv-doc-header" style={{marginBottom:16}}>
                <div>
                  <div style={{fontFamily:'var(--font-brand)', fontWeight:800, fontSize:16, color:'var(--navy)'}}>
                    {o.customer_name} — Cost Sheet
                  </div>
                  <div className="text-sm text-muted">
                    {DIR_LABEL[o.direction] || o.direction_other_note || 'Other'} · {o.goods_description || '—'}
                  </div>
                </div>
                <button className="btn btn-green" onClick={() => setConfirmId(selected.id)}>
                  <CheckCircle size={14} /> Complete → Archive
                </button>
              </div>

              <hr />

              {/* Revenue vs Cost summary */}
              <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20}}>
                {[
                  { label:'Revenue', val: `Rp ${Math.round(revIDR).toLocaleString('id-ID')}`, color:'var(--navy)' },
                  { label:'Total Cost', val: `Rp ${Math.round(costIDR).toLocaleString('id-ID')}`, color:'var(--red)' },
                  { label:'Profit', val: `Rp ${Math.round(profitIDR).toLocaleString('id-ID')}`, color: profitIDR >= 0 ? 'var(--green)' : 'var(--red)' },
                  { label:'Margin', val: `${margin}%`, color: margin >= 0 ? 'var(--green)' : 'var(--red)' },
                ].map(s => (
                  <div key={s.label} style={{background:'var(--gray-50)', borderRadius:'var(--r-md)', padding:'12px 14px', textAlign:'center'}}>
                    <div className="text-sm text-muted">{s.label}</div>
                    <div style={{fontFamily:'var(--font-brand)', fontWeight:800, fontSize:16, color:s.color, marginTop:4}}>{s.val}</div>
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
                        {['Description','Qty','Unit Cost','Total','In IDR',''].map(h => (
                          <th key={h} style={{textAlign:'left', padding:'6px 0', fontSize:11,
                            color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.07em',
                            borderBottom:'1px solid var(--gray-200)'}}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, i) => {
                        const subtotal = Number(l.amount) * (Number(l.qty) || 1)
                        const subtotalIDR = toIDR(subtotal, l.currency || 'USD', fx)
                        return (
                          <tr key={i}>
                            <td style={{padding:'8px 0', fontSize:13, borderBottom:'1px solid var(--gray-100)'}}>{l.description}</td>
                            <td style={{padding:'8px 0', fontSize:13, color:'var(--gray-400)', borderBottom:'1px solid var(--gray-100)'}}>{l.qty || 1}</td>
                            <td style={{padding:'8px 0', fontSize:13, borderBottom:'1px solid var(--gray-100)'}}>{formatCurrency(l.amount, l.currency || 'USD')}</td>
                            <td style={{padding:'8px 0', fontSize:13, fontWeight:600, borderBottom:'1px solid var(--gray-100)'}}>{formatCurrency(subtotal, l.currency || 'USD')}</td>
                            <td style={{padding:'8px 0', fontSize:13, color:'var(--red)', borderBottom:'1px solid var(--gray-100)'}}>
                              Rp {Math.round(subtotalIDR).toLocaleString('id-ID')}
                            </td>
                            <td style={{padding:'8px 0', borderBottom:'1px solid var(--gray-100)'}}>
                              <button className="btn-ghost" style={{color:'var(--red)'}}
                                onClick={() => removeCostLine(selected.id, i)}>
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

              {/* Add cost line */}
              <div className="inv-add-cost">
                <div className="inv-section-label">ADD COST LINE</div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:8, alignItems:'flex-end'}}>
                  <input className="form-input" style={{flex:3, minWidth:130}} type="text"
                    placeholder="e.g. Shipping cost, Repackage fee"
                    value={lineDesc} onChange={e => setLineDesc(e.target.value)} />
                  <div>
                    <div className="text-sm text-muted" style={{marginBottom:2}}>Qty</div>
                    <input className="form-input" style={{width:60}} type="number" min="1"
                      value={lineQty} onChange={e => setLineQty(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-sm text-muted" style={{marginBottom:2}}>Unit cost</div>
                    <input className="form-input" style={{width:100}} type="number" min="0" step="0.01"
                      placeholder="Amount" value={lineAmt} onChange={e => setLineAmt(e.target.value)} />
                  </div>
                  <select className="form-select" style={{width:80}}
                    value={lineCur} onChange={e => setLineCur(e.target.value)}>
                    <option>USD</option><option>IDR</option>
                  </select>
                  <button className="btn btn-danger btn-sm" disabled={savingLine} onClick={handleAddLine}>
                    <Plus size={13} /> {savingLine ? '…' : 'Add cost'}
                  </button>
                </div>
                {lineAmt && lineQty && parseInt(lineQty) > 1 && (
                  <div className="text-sm text-muted" style={{marginTop:6}}>
                    = {parseInt(lineQty)} × {formatCurrency(parseFloat(lineAmt)||0, lineCur)} = {formatCurrency((parseFloat(lineAmt)||0)*(parseInt(lineQty)||1), lineCur)}
                  </div>
                )}
              </div>

              {/* FX rate */}
              <div className="inv-fx-box">
                <div className="inv-section-label">USD → IDR RATE</div>
                <div style={{display:'flex', gap:8, marginTop:8, alignItems:'flex-end'}}>
                  <input className="form-input" style={{width:160}} type="number"
                    placeholder={DEFAULT_FX} value={usdRate} onChange={e => setUsdRate(e.target.value)} />
                  <button className="btn btn-primary btn-sm" disabled={savingRate} onClick={handleSaveRate}>
                    {savingRate ? 'Saving…' : 'Save rate'}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
      </>)}

      {/* Confirm archive */}
      {confirmId && (
        <div className="overlay">
          <div className="confirm-modal">
            <h3>Archive this record?</h3>
            <p>This will move the record to <strong>Completed</strong>. The profit and cost data will be preserved for the Finance summary.</p>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={() => setConfirmId(null)}>Cancel</button>
              <button className="btn btn-green" disabled={completing}
                onClick={() => handleComplete(confirmId)}>
                {completing ? 'Archiving…' : '✓ Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// src/components/InvoiceTab.jsx
// Shows ALL orders from creation. Tracking stage visible inline.
// Payment segment: Unpaid → Invoiced → Paid (Paid = invoice_done ✓)
// Paid + Cost Done → auto-archives to Completed.
import { useState, useMemo } from 'react'
import { FileText, Printer, Plus, Search, Trash2, CheckCircle, Check } from 'lucide-react'
import CompleteButton from './CompleteButton'
import { getStageSequence, getStageLabel } from '../lib/data'
import { formatCurrency } from '../lib/pricing'
import { generateInvoicePDF } from '../lib/pdf'

const DIR_LABEL   = { us_jkt: 'US → JKT', jkt_us: 'JKT → US' }
const DEFAULT_FX  = 15850
const DEFAULT_SGD = 11900
const PAY_STATES  = ['Unpaid', 'Invoiced', 'Paid']

function getStage(order, tRow) {
  if (!tRow) return null
  return tRow.current_stage
}

function stageBadge(order, tRow) {
  if (!tRow) return <span className="badge badge-gray">No tracking</span>
  const seq   = getStageSequence(order.service_type)
  const stage = tRow.current_stage
  const label = getStageLabel(order.service_type, stage)
  const isLast = stage === seq[seq.length - 1]
  if (isLast) return <span className="badge badge-green">✓ {label}</span>
  const idx = seq.indexOf(stage)
  const pct = Math.round((idx / (seq.length - 1)) * 100)
  return <span className="badge badge-blue">Stage {stage} · {label}</span>
}

export default function InvoiceTab({
  orders, tracking, invoices, costs,
  addInvoiceCost, removeInvoiceCost, lockInvoiceTotal, completeOrder,
  updateTracking, setDoneFlag, deleteOrder, archiveOrder,
}) {
  const [selectedId, setSelectedId]     = useState(null)
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [savingPay, setSavingPay]       = useState(null)
  const [completing, setCompleting]     = useState(false)
  const [confirmDel, setConfirmDel]     = useState(null)
  const [deleting, setDeleting]         = useState(false)

  // Add cost line
  const [costDesc, setCostDesc]     = useState('')
  const [costAmt, setCostAmt]       = useState('')
  const [costQty, setCostQty]       = useState('1')
  const [costCur, setCostCur]       = useState('IDR')
  const [savingCost, setSavingCost] = useState(false)

  // FX
  const [usdRate, setUsdRate]         = useState('')
  const [sgdRate, setSgdRate]         = useState('')
  const [savingRates, setSavingRates] = useState(false)

  const getInv  = (oid) => invoices.find(i => i.order_id === oid)
  const getTrow = (oid) => tracking.find(t => t.order_id === oid)
  const getCost = (oid) => costs.find(c => c.original_order_id === oid)
  const getPayment = (oid) => getTrow(oid)?.payment || 'Unpaid'

  // Filter options
  const filterOptions = useMemo(() => {
    const counts = { all: orders.length, Unpaid: 0, Invoiced: 0, Paid: 0 }
    orders.forEach(o => { const p = getPayment(o.id); counts[p] = (counts[p] || 0) + 1 })
    return counts
  }, [orders, tracking])

  // Grouped by direction first, then payment status
  const grouped = useMemo(() => {
    const DIR_ORDER = ['us_jkt', 'jkt_us', 'other']
    const PAY_ORDER = ['Unpaid', 'Invoiced', 'Paid']

    const filtered_orders = orders.filter(o => {
      if (filterStatus !== 'all' && getPayment(o.id) !== filterStatus) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (o.customer_name || '').toLowerCase().includes(q) ||
               (o.goods_description || '').toLowerCase().includes(q)
      }
      return true
    })

    // Build direction → payment → orders
    const byDir = {}
    filtered_orders.forEach(o => {
      const dir = o.direction || 'other'
      const pay = getPayment(o.id)
      if (!byDir[dir]) byDir[dir] = {}
      if (!byDir[dir][pay]) byDir[dir][pay] = []
      byDir[dir][pay].push(o)
    })

    // Flatten
    const result = []
    DIR_ORDER.filter(d => byDir[d]).forEach(dir => {
      PAY_ORDER.filter(p => byDir[dir][p]).forEach(pay => {
        result.push({ dir, pay, orders: byDir[dir][pay] })
      })
    })
    return result
  }, [orders, tracking, filterStatus, search])

  const selected  = orders.find(o => o.id === selectedId)
  const selInv    = selected ? getInv(selected.id) : null
  const selTrow   = selected ? getTrow(selected.id) : null
  const selCost   = selected ? getCost(selected.id) : null

  const selectOrder = (oid) => {
    setSelectedId(prev => prev === oid ? null : oid)
    const inv = getInv(oid)
    setUsdRate(inv?.usd_rate?.toString() || '')
    setSgdRate(inv?.sgd_rate?.toString() || '')
    setCostDesc(''); setCostAmt(''); setCostQty('1'); setCostCur('IDR')
  }

  const buildFeeLines = (order, inv) => {
    const lines = []
    const cur   = inv?.currency || order?.rate_currency || 'USD'
    if (order.service_type === 'shipping_only' && order.computed_base_price != null) {
      lines.push({ label: `${DIR_LABEL[order.direction] || 'Shipping'} (${order.chargeable_weight_kg || order.weight_kg || '?'} kg × ${formatCurrency(order.rate_per_kg || 0, cur)})`, amount: order.computed_base_price, currency: cur, qty: 1 })
    } else if (order.service_type === 'full_service' && (inv?.base_price || 0) > 0) {
      lines.push({ label: 'Full Service Fee', amount: inv.base_price, currency: cur, qty: 1 })
    }
    ;(order.additional_costs || []).forEach(c => lines.push({ label: c.description, amount: Number(c.amount), currency: cur, qty: Number(c.qty) || 1 }))
    ;(inv?.additional_costs || []).forEach(c => lines.push({ label: c.description, amount: Number(c.amount), currency: c.currency || cur, qty: Number(c.qty) || 1, fromInvoice: true }))
    return lines
  }

  const toIDR = (amount, cur, uR, sR) => {
    const fxU = parseFloat(uR) || DEFAULT_FX
    const fxS = parseFloat(sR) || DEFAULT_SGD
    if (cur === 'IDR') return amount
    if (cur === 'SGD') return amount * fxS
    return amount * fxU
  }

  const handleSetPayment = async (orderId, pay) => {
    setSavingPay(orderId)
    try {
      await updateTracking(orderId, { payment: pay, payment_updated_at: new Date().toISOString() })
      // If paid, mark invoice_done on cost record
      const costRec = getCost(orderId)
      if (costRec) {
        await setDoneFlag(costRec.id, 'invoice_done', pay === 'Paid')
      }
    } finally { setSavingPay(null) }
  }

  const handleMarkInvoiceDone = async (orderId, done) => {
    const costRec = getCost(orderId)
    if (!costRec) return
    await setDoneFlag(costRec.id, 'invoice_done', done)
    if (done) await updateTracking(orderId, { payment: 'Paid', payment_updated_at: new Date().toISOString() })
  }

  const handleAddCost = async (oid) => {
    if (!costDesc.trim() || !costAmt) return
    setSavingCost(true)
    try {
      const qty   = parseInt(costQty) || 1
      const label = qty > 1 ? `${costDesc.trim()} ×${qty}` : costDesc.trim()
      await addInvoiceCost(oid, label, parseFloat(costAmt) * qty, costCur)
      setCostDesc(''); setCostAmt(''); setCostQty('1')
    } finally { setSavingCost(false) }
  }

  const handleSaveRates = async (oid) => {
    setSavingRates(true)
    try {
      const inv = getInv(oid)
      await lockInvoiceTotal(oid, inv?.total || 0, inv?.currency || 'USD', parseFloat(usdRate) || null, parseFloat(sgdRate) || null)
    } finally { setSavingRates(false) }
  }

  const handleCompleteInvoice = async (oid) => {
    setCompleting(true)
    try {
      const inv = getInv(oid)
      const order = orders.find(o => o.id === oid)
      if (inv) await lockInvoiceTotal(oid, inv.total, inv.currency || order?.rate_currency || 'USD', parseFloat(usdRate)||null, parseFloat(sgdRate)||null)
      await completeOrder(oid)
      setSelectedId(null)
    } finally { setCompleting(false) }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Invoices</h2>
        <p>All active orders. Mark as <strong>Paid</strong> when collected. Invoice ✓ + Cost ✓ = archived automatically.</p>
      </div>

      {/* Filter + search */}
      <div className="flex-center gap-8" style={{marginBottom:14, flexWrap:'wrap'}}>
        {[['all','All'], ...PAY_STATES.map(p => [p, p])].map(([v, l]) => (
          <button key={v} className={`stage-filter-chip ${filterStatus === v ? 'active' : ''}`}
            onClick={() => setFilterStatus(v)}>
            {l} <span className="stage-filter-count">{filterOptions[v] || 0}</span>
          </button>
        ))}
        <div className="search-wrap" style={{flex:1, minWidth:200, maxWidth:320, marginLeft:'auto'}}>
          <Search size={14} className="search-icon" />
          <input className="search-input" type="text" placeholder="Search invoices…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><FileText size={26} /></div>
            <h3>No orders yet</h3>
            <p>Create an order and it will appear here immediately.</p>
          </div>
        </div>
      ) : (<>
        {/* Invoice list — grouped by payment status */}
        <div className="inv-list">
          {grouped.length === 0 ? (
            <div style={{padding:'20px 18px', color:'var(--gray-400)', fontSize:13}}>No matching orders.</div>
          ) : grouped.map(({ dir, pay, orders: groupOrders }, idx) => {
            const dirLabel = DIR_LABEL[dir] || 'Other'
            const prevDir  = idx > 0 ? grouped[idx-1].dir : null
            const showDir  = dir !== prevDir
            return (
              <div key={`${dir}-${pay}`}>
                {/* Bold direction header */}
                {showDir && (
                  <div style={{
                    padding:'10px 18px',
                    background:'var(--navy)', color:'var(--gold)',
                    fontFamily:'var(--font-brand)', fontWeight:800, fontSize:14,
                    borderTop: idx > 0 ? '2px solid var(--navy)' : 'none',
                  }}>
                    {dirLabel}
                  </div>
                )}
                {/* Payment sub-header */}
                <div style={{
                  padding:'7px 18px', background:'var(--gray-50)',
                  borderBottom:'1px solid var(--gray-100)', borderTop:'1px solid var(--gray-100)',
                  fontSize:11, fontWeight:700, color:'var(--gray-400)',
                  textTransform:'uppercase', letterSpacing:'0.08em',
                  display:'flex', justifyContent:'space-between',
                }}>
                  <span>{pay === 'Paid' ? '✓ ' : pay === 'Invoiced' ? '📋 ' : '⏳ '}{pay}</span>
                  <span style={{fontWeight:500}}>{groupOrders.length}</span>
                </div>
                {groupOrders.map(order => {
            const inv     = getInv(order.id)
            const tRow    = getTrow(order.id)
            const costRec = getCost(order.id)
            const lines   = buildFeeLines(order, inv)
            const savedU  = inv?.usd_rate
            const savedS  = inv?.sgd_rate
            const totalIDR = lines.reduce((s, l) => s + toIDR(l.amount * (l.qty||1), l.currency, savedU, savedS), 0)
            const pay      = tRow?.payment || 'Unpaid'
            const isPaid   = pay === 'Paid'
            const isSel    = selectedId === order.id
            const invDone  = costRec?.invoice_done  || false
            const trkDone  = costRec?.tracking_done || false
            const cstDone  = costRec?.cost_done     || false

            return (
              <div key={order.id}
                className={`inv-row ${isSel ? 'inv-row-active' : ''}`}
                onClick={() => selectOrder(order.id)}>
                {/* Left: checkmark + ORD + name/desc */}
                <div style={{display:'grid', gridTemplateColumns:'auto auto 1fr', alignItems:'center', gap:10, overflow:'hidden', minWidth:0}}>
                  <div onClick={e => { e.stopPropagation(); handleMarkInvoiceDone(order.id, !invDone) }}
                    style={{
                      width:20, height:20, borderRadius:'50%', flexShrink:0, cursor:'pointer',
                      border:`2px solid ${invDone ? 'var(--green)' : 'var(--gray-200)'}`,
                      background: invDone ? 'var(--green)' : 'transparent',
                      display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s',
                    }}>
                    {invDone && <Check size={11} color="white" strokeWidth={3} />}
                  </div>
                  <span className="text-mono text-sm fw-700" style={{color:'var(--navy)', whiteSpace:'nowrap'}}>
                    ORD-{order.id?.substring(0,6).toUpperCase()}
                  </span>
                  <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    <span style={{fontWeight:700}}>{order.customer_name}</span>
                    <span className="text-muted" style={{fontWeight:400, marginLeft:8, fontSize:13}}>
                      {DIR_LABEL[order.direction] || order.direction_other_note || 'Other'}
                      {order.goods_description ? ` · ${order.goods_description}` : ''}
                    </span>
                  </span>
                </div>
                {/* Right: payment seg + amount + 3 bubbles + delete */}
                <div className="flex-center gap-8" style={{flexShrink:0, marginLeft:12}}>
                  {stageBadge(order, tRow)}
                  <div className="pay-seg" onClick={e => e.stopPropagation()}>
                    {PAY_STATES.map(p => (
                      <button key={p} className={`pay-seg-btn ${pay === p ? 'pay-seg-active' : ''}`}
                        disabled={savingPay === order.id}
                        onClick={() => handleSetPayment(order.id, p)}>{p}</button>
                    ))}
                  </div>
                  <span style={{fontWeight:700, fontSize:14, whiteSpace:'nowrap', color: isPaid ? 'var(--green)' : 'var(--text)'}}>
                    Rp {Math.round(totalIDR).toLocaleString('id-ID')}
                  </span>
                  {/* 3 status dots — tracking · invoice · cost — far right */}
                  <div className="flex-center gap-4" title="Shipment · Invoice · Cost">
                    <div style={{width:8, height:8, borderRadius:'50%', background: trkDone ? 'var(--green)' : 'var(--gray-200)'}} />
                    <div style={{width:8, height:8, borderRadius:'50%', background: invDone ? 'var(--green)' : 'var(--gray-200)'}} />
                    <div style={{width:8, height:8, borderRadius:'50%', background: cstDone ? 'var(--green)' : 'var(--gray-200)'}} />
                  </div>
                  <button className="btn-ghost btn-sm" title="Delete order" style={{color:'var(--red)', flexShrink:0}}
                    onClick={e => { e.stopPropagation(); setConfirmDel(order.id) }}>
                    <Trash2 size={14} />
                  </button>
                  <span onClick={e => e.stopPropagation()}>
                    <CompleteButton orderId={order.id} costs={costs} archiveOrder={archiveOrder} />
                  </span>
                </div>
              </div>
            )
          })}
              </div>
            )
          })}
        </div>

        {/* Expanded invoice doc */}
        {selected && (() => {
          const inv      = selInv
          const costRec  = selCost
          const lines    = buildFeeLines(selected, inv)
          const effU     = parseFloat(usdRate) || inv?.usd_rate || DEFAULT_FX
          const effS     = parseFloat(sgdRate) || inv?.sgd_rate || DEFAULT_SGD
          const totalIDR = lines.reduce((s, l) => s + toIDR(l.amount * (l.qty||1), l.currency, effU, effS), 0)
          const pay      = selTrow?.payment || 'Unpaid'
          const isPaid   = pay === 'Paid'
          const invDone  = costRec?.invoice_done || false
          const costDone = costRec?.cost_done || false
          const orderLineCount = (
            (selected.service_type === 'shipping_only' && selected.computed_base_price != null ? 1 : 0) +
            (selected.service_type === 'full_service' && (inv?.base_price || 0) > 0 ? 1 : 0) +
            (selected.additional_costs || []).length
          )

          return (
            <div className="inv-doc">
              {/* Doc header */}
              <div className="inv-doc-header">
                <div className="flex-center gap-12">
                  <img src="/logo.png" alt="JEI" style={{width:44, height:44, objectFit:'contain'}} />
                  <div>
                    <div style={{fontFamily:'var(--font-brand)', fontWeight:800, fontSize:14, color:'var(--navy)'}}>JEI EASYSHOP</div>
                    <div className="text-sm text-muted">Freight forwarding · US → SG → ID</div>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontFamily:'var(--font-brand)', fontWeight:800, fontSize:22, color:'var(--navy)'}}>INVOICE</div>
                  <div className="text-sm text-muted">INV-{selected.id?.substring(0,6).toUpperCase()}</div>
                </div>
              </div>

              <hr />

              {/* Meta + tracking stage */}
              <div className="inv-meta-row" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
                <div><div className="inv-meta-label">BILL TO</div><div className="inv-meta-value">{selected.customer_name}</div></div>
                <div><div className="inv-meta-label">DIRECTION</div><div className="inv-meta-value">{DIR_LABEL[selected.direction] || selected.direction_other_note || 'Other'}</div></div>
                <div><div className="inv-meta-label">TRACKING STAGE</div><div style={{marginTop:4}}>{stageBadge(selected, selTrow)}</div></div>
                <div>
                  <div className="inv-meta-label">PAYMENT</div>
                  <div className="pay-seg" style={{marginTop:4}}>
                    {PAY_STATES.map(p => (
                      <button key={p}
                        className={`pay-seg-btn ${pay === p ? 'pay-seg-active' : ''}`}
                        disabled={savingPay === selected.id}
                        onClick={() => handleSetPayment(selected.id, p)}>{p}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="inv-meta-label">INVOICE DONE</div>
                  <div style={{marginTop:6}}>
                    <div
                      onClick={() => handleMarkInvoiceDone(selected.id, !invDone)}
                      style={{
                        width:28, height:28, borderRadius:'50%', cursor:'pointer',
                        border:`2px solid ${invDone ? 'var(--green)' : 'var(--gray-200)'}`,
                        background: invDone ? 'var(--green)' : 'transparent',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        transition:'all 0.15s',
                      }}>
                      {invDone && <Check size={14} color="white" strokeWidth={3} />}
                    </div>
                  </div>
                </div>
              </div>

              <hr />

              {/* Fee lines */}
              <table style={{width:'100%', borderCollapse:'collapse', marginBottom:16}}>
                <thead>
                  <tr>
                    {['Description','Qty','Unit Price','Total','In IDR',''].map((h, hi) => (
                      <th key={hi} style={{
                        textAlign: hi === 0 ? 'left' : 'right', padding:'8px 0', fontSize:11,
                        color:'var(--gray-400)', textTransform:'uppercase', letterSpacing:'0.07em',
                        borderBottom:'1px solid var(--gray-200)', width: h === '' ? 28 : undefined,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr><td colSpan={6} style={{padding:'12px 0', color:'var(--gray-400)', fontSize:13}}>No pricing set — add a cost line below.</td></tr>
                  ) : lines.map((l, i) => {
                    const lineTotal  = l.amount * (l.qty || 1)
                    const isDeletable = i >= orderLineCount
                    return (
                      <tr key={i}>
                        <td style={{padding:'10px 0', fontSize:13, borderBottom:'1px solid var(--gray-100)'}}>{l.label}</td>
                        <td style={{textAlign:'right', padding:'10px 0', fontSize:13, color:'var(--gray-400)', borderBottom:'1px solid var(--gray-100)'}}>{l.qty||1}</td>
                        <td style={{textAlign:'right', padding:'10px 0', fontSize:13, borderBottom:'1px solid var(--gray-100)'}}>{formatCurrency(l.amount, l.currency)}</td>
                        <td style={{textAlign:'right', padding:'10px 0', fontSize:13, fontWeight:600, borderBottom:'1px solid var(--gray-100)'}}>{formatCurrency(lineTotal, l.currency)}</td>
                        <td style={{textAlign:'right', padding:'10px 0', fontSize:13, fontWeight:700, color:'var(--navy)', borderBottom:'1px solid var(--gray-100)'}}>
                          Rp {Math.round(toIDR(lineTotal, l.currency, effU, effS)).toLocaleString('id-ID')}
                        </td>
                        <td style={{textAlign:'right', padding:'10px 0', borderBottom:'1px solid var(--gray-100)'}}>
                          {isDeletable && removeInvoiceCost && (
                            <button className="btn-ghost" style={{color:'var(--red)', padding:'2px 4px'}}
                              onClick={() => removeInvoiceCost(selected.id, i - orderLineCount)}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Add cost line */}
              <div className="inv-add-cost">
                <div className="inv-section-label" style={{marginBottom:10}}>ADD COST LINE</div>
                <div style={{display:'grid', gridTemplateColumns:'1fr auto auto auto auto', gap:8, alignItems:'end'}}>
                  <input className="form-input" type="text"
                    placeholder="Description (e.g. Handling fee)"
                    value={costDesc} onChange={e => setCostDesc(e.target.value)} />
                  <div>
                    <div className="form-label" style={{marginBottom:4}}>Qty</div>
                    <input className="form-input" style={{width:64}} type="number" min="1"
                      value={costQty} onChange={e => setCostQty(e.target.value)} />
                  </div>
                  <div>
                    <div className="form-label" style={{marginBottom:4}}>Amount</div>
                    <input className="form-input" style={{width:100}} type="number" min="0" step="0.01"
                      placeholder="0.00" value={costAmt} onChange={e => setCostAmt(e.target.value)} />
                  </div>
                  <div>
                    <div className="form-label" style={{marginBottom:4}}>Currency</div>
                    <select className="form-select" style={{width:80}} value={costCur} onChange={e => setCostCur(e.target.value)}>
                      <option>IDR</option><option>USD</option>
                    </select>
                  </div>
                  <button className="btn btn-primary btn-sm" disabled={savingCost}
                    onClick={() => handleAddCost(selected.id)} style={{alignSelf:'end'}}>
                    <Plus size={13} /> {savingCost ? '…' : 'Add cost'}
                  </button>
                </div>
                {costAmt && parseInt(costQty) > 1 && (
                  <div className="text-sm text-muted" style={{marginTop:6}}>
                    = {costQty} × {formatCurrency(parseFloat(costAmt)||0, costCur)} = <strong>{formatCurrency((parseFloat(costAmt)||0)*(parseInt(costQty)||1), costCur)}</strong>
                  </div>
                )}
              </div>

              {/* FX rates */}
              <div className="inv-fx-box">
                <div className="inv-section-label">CONVERSION RATES (this invoice only)</div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:8, marginTop:8, alignItems:'end'}}>
                  <div>
                    <div className="form-label" style={{marginBottom:4}}>USD → IDR</div>
                    <input className="form-input" type="number" placeholder={DEFAULT_FX}
                      value={usdRate} onChange={e => setUsdRate(e.target.value)} />
                  </div>
                  <div>
                    <div className="form-label" style={{marginBottom:4}}>SGD → IDR</div>
                    <input className="form-input" type="number" placeholder={DEFAULT_SGD}
                      value={sgdRate} onChange={e => setSgdRate(e.target.value)} />
                  </div>
                  <button className="btn btn-primary btn-sm" disabled={savingRates}
                    onClick={() => handleSaveRates(selected.id)} style={{alignSelf:'end'}}>
                    {savingRates ? 'Saving…' : 'Save rates'}
                  </button>
                </div>
              </div>

              {/* Total */}
              <div className="cost-total" style={{marginTop:16}}>
                <span className="cost-total-label">Total Due (IDR)</span>
                <span className="cost-total-value">Rp {Math.round(totalIDR).toLocaleString('id-ID')}</span>
              </div>

              {/* Status bar at bottom */}
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                marginTop:16, padding:'12px 16px',
                background:'var(--gray-50)', borderRadius:'var(--r-md)',
                border:'1px solid var(--gray-200)',
              }}>
                <div className="flex-center gap-16">
                  <div className="flex-center gap-8">
                    <div style={{
                      width:20, height:20, borderRadius:'50%',
                      border:`2px solid ${invDone ? 'var(--green)' : 'var(--gray-300)'}`,
                      background: invDone ? 'var(--green)' : 'transparent',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      {invDone && <Check size={11} color="white" strokeWidth={3} />}
                    </div>
                    <span className="text-sm" style={{color: invDone ? 'var(--green)' : 'var(--gray-400)', fontWeight: invDone ? 700 : 400}}>
                      Invoice {invDone ? 'done ✓' : 'pending'}
                    </span>
                  </div>
                  <div className="flex-center gap-8">
                    <div style={{
                      width:20, height:20, borderRadius:'50%',
                      border:`2px solid ${costDone ? 'var(--green)' : 'var(--gray-300)'}`,
                      background: costDone ? 'var(--green)' : 'transparent',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      {costDone && <Check size={11} color="white" strokeWidth={3} />}
                    </div>
                    <span className="text-sm" style={{color: costDone ? 'var(--green)' : 'var(--gray-400)', fontWeight: costDone ? 700 : 400}}>
                      Cost {costDone ? 'done ✓' : 'pending'} (check in Cost tab)
                    </span>
                  </div>
                  {invDone && costDone && (
                    <span className="badge badge-green" style={{fontWeight:700}}>🎉 Will auto-archive</span>
                  )}
                </div>
                <div className="flex-center gap-8">
                  <button className="btn btn-outline btn-sm"
                    onClick={() => generateInvoicePDF(selected, inv, lines)}>
                    <Printer size={13} /> PDF
                  </button>
                  <CompleteButton orderId={selected.id} costs={costs} archiveOrder={archiveOrder} />
                </div>
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
            <p>This will permanently remove the order from all tabs (Tracking, Cost). <strong>This cannot be undone.</strong></p>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleting}
                onClick={async () => { setDeleting(true); try { await deleteOrder(confirmDel); setConfirmDel(null); setSelectedId(null) } finally { setDeleting(false) } }}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// src/components/InvoiceTab.jsx
import { useState, useMemo } from 'react'
import { FileText, Printer, CheckCircle, Plus, X, Search } from 'lucide-react'
import { getStageSequence, isFinalStage, getStageLabel } from '../lib/data'
import { formatCurrency } from '../lib/pricing'
import { generateInvoicePDF } from '../lib/pdf'

const DIR_LABEL = { us_jkt: 'US → JKT', jkt_us: 'JKT → US' }
const DEFAULT_USD_IDR = 15850
const DEFAULT_SGD_IDR = 11900

// Stage 5 = "Sent to customer", Stage 6 = "Received by customer"
function getSentStatus(order, tRow) {
  if (!tRow) return 'unknown'
  const seq   = getStageSequence(order.service_type)
  const stage = tRow.current_stage
  const last  = seq[seq.length - 1]
  if (stage === last) return 'received'          // stage 6
  if (stage === last - 1) return 'sent'          // stage 5
  return 'in_transit'
}

const STATUS_CONFIG = {
  received:   { label: 'Received by customer', cls: 'badge-green' },
  sent:       { label: 'Sent to customer',      cls: 'badge-amber' },
  in_transit: { label: 'In transit',            cls: 'badge-blue'  },
}

export default function InvoiceTab({
  orders, tracking, invoices,
  addInvoiceCost, lockInvoiceTotal, completeOrder,
}) {
  const [selectedId, setSelectedId]   = useState(null)
  const [confirmId, setConfirmId]     = useState(null)
  const [completing, setCompleting]   = useState(false)
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'received' | 'sent' | 'in_transit'

  // Add cost line state
  const [costDesc, setCostDesc]   = useState('')
  const [costAmt, setCostAmt]     = useState('')
  const [costQty, setCostQty]     = useState('1')
  const [costCur, setCostCur]     = useState('IDR')
  const [savingCost, setSavingCost] = useState(false)

  // FX rates
  const [usdRate, setUsdRate]       = useState('')
  const [sgdRate, setSgdRate]       = useState('')
  const [savingRates, setSavingRates] = useState(false)

  // Show all orders that are at least at stage 5 (sent to customer) or final
  const invoiceReady = useMemo(() => orders.filter(o => {
    const t = tracking.find(t => t.order_id === o.id)
    if (!t) return false
    const seq = getStageSequence(o.service_type)
    // Show from stage 5 onwards (sent to customer)
    return t.current_stage >= seq[seq.length - 2]
  }), [orders, tracking])

  // Apply search + status filter
  const filtered = useMemo(() => {
    return invoiceReady.filter(o => {
      const t = tracking.find(tr => tr.order_id === o.id)
      if (filterStatus !== 'all' && getSentStatus(o, t) !== filterStatus) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (o.customer_name || '').toLowerCase().includes(q) ||
               (o.goods_description || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [invoiceReady, tracking, filterStatus, search])

  const getInv  = (oid) => invoices.find(i => i.order_id === oid)
  const getTrow = (oid) => tracking.find(t => t.order_id === oid)

  const selected = filtered.find(o => o.id === selectedId) || invoiceReady.find(o => o.id === selectedId)
  const selInv   = selected ? getInv(selected.id) : null
  const selTrow  = selected ? getTrow(selected.id) : null

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
      lines.push({
        label: `${DIR_LABEL[order.direction] || 'Shipping'} (${order.chargeable_weight_kg || order.weight_kg || '?'} kg × ${formatCurrency(order.rate_per_kg || 0, cur)})`,
        amount: order.computed_base_price, currency: cur, qty: 1,
      })
    } else if (order.service_type === 'full_service' && (inv?.base_price || 0) > 0) {
      lines.push({ label: 'Full Service Fee', amount: inv.base_price, currency: cur, qty: 1 })
    }
    ;(order.additional_costs || []).forEach(c =>
      lines.push({ label: c.description, amount: Number(c.amount), currency: cur, qty: Number(c.qty) || 1 })
    )
    ;(inv?.additional_costs || []).forEach(c =>
      lines.push({ label: c.description, amount: Number(c.amount), currency: c.currency || cur, qty: Number(c.qty) || 1 })
    )
    return lines
  }

  const toIDR = (amount, currency, uR, sR) => {
    const fxU = parseFloat(uR) || DEFAULT_USD_IDR
    const fxS = parseFloat(sR) || DEFAULT_SGD_IDR
    if (currency === 'IDR') return amount
    if (currency === 'SGD') return amount * fxS
    return amount * fxU
  }

  const handleAddCost = async (oid) => {
    if (!costDesc.trim() || !costAmt) return
    setSavingCost(true)
    try {
      const qty    = parseInt(costQty) || 1
      const label  = qty > 1 ? `${costDesc.trim()} ×${qty}` : costDesc.trim()
      const total  = parseFloat(costAmt) * qty
      await addInvoiceCost(oid, label, total, costCur)
      setCostDesc(''); setCostAmt(''); setCostQty('1')
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
      const inv = getInv(oid)
      const order = orders.find(o => o.id === oid)
      if (inv) await lockInvoiceTotal(oid, inv.total, inv.currency || order?.rate_currency || 'USD',
        parseFloat(usdRate) || null, parseFloat(sgdRate) || null)
      await completeOrder(oid) // → moves to Cost tab
      setConfirmId(null); setSelectedId(null)
    } finally { setCompleting(false) }
  }

  const payBadge = (tRow) => {
    const p = tRow?.payment || 'Unpaid'
    const cls = p === 'Paid' ? 'badge-green' : p === 'Invoiced' ? 'badge-amber' : 'badge-red'
    return <span className={`badge ${cls}`} style={{fontSize:11}}>{p}</span>
  }

  // Count by status
  const statusCounts = useMemo(() => {
    const counts = { all: invoiceReady.length }
    invoiceReady.forEach(o => {
      const t = getTrow(o.id)
      const s = getSentStatus(o, t)
      counts[s] = (counts[s] || 0) + 1
    })
    return counts
  }, [invoiceReady])

  return (
    <div>
      <div className="page-header">
        <h2>Invoices</h2>
        <p>Delivered orders are billable. Complete an invoice to move it to the Cost tab.</p>
      </div>

      {/* Filter row */}
      <div className="flex-center gap-8" style={{marginBottom:14, flexWrap:'wrap'}}>
        {[['all','All'],['received','Received by customer'],['sent','Sent to customer'],['in_transit','In transit']].map(([v,l]) => (
          <button key={v}
            className={`stage-filter-chip ${filterStatus === v ? 'active' : ''}`}
            onClick={() => setFilterStatus(v)}>
            {l}
            <span className="stage-filter-count">{statusCounts[v] || 0}</span>
          </button>
        ))}
        <div className="search-wrap" style={{flex:1, minWidth:200, maxWidth:320, marginLeft:'auto'}}>
          <Search size={14} className="search-icon" />
          <input className="search-input" type="text" placeholder="Search invoices…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><FileText size={26} /></div>
            <h3>No invoices</h3>
            <p>Orders appear here once they reach "Sent to customer" stage.</p>
          </div>
        </div>
      ) : (<>
        {/* Invoice list */}
        <div className="inv-list">
          {filtered.map(order => {
            const inv    = getInv(order.id)
            const tRow   = getTrow(order.id)
            const lines  = buildFeeLines(order, inv)
            const total  = lines.reduce((s, l) => s + l.amount * (l.qty || 1), 0)
            const savedU = inv?.usd_rate
            const savedS = inv?.sgd_rate
            const totalIDR = lines.reduce((s, l) => s + toIDR(l.amount * (l.qty || 1), l.currency, savedU, savedS), 0)
            const isSel  = selectedId === order.id
            const status = getSentStatus(order, tRow)
            const sCfg   = STATUS_CONFIG[status]

            return (
              <div key={order.id}
                className={`inv-row ${isSel ? 'inv-row-active' : ''}`}
                onClick={() => selectOrder(order.id)}>
                <div className="flex-center gap-10" style={{overflow:'hidden'}}>
                  <FileText size={14} style={{color:'var(--navy)', opacity:0.6, flexShrink:0}} />
                  <span className="text-mono text-sm fw-700" style={{color:'var(--navy)', flexShrink:0}}>
                    ORD-{order.id?.substring(0,6).toUpperCase()}
                  </span>
                  <span style={{fontWeight:700, flexShrink:0}}>{order.customer_name}</span>
                  <span className="text-muted text-sm" style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    {DIR_LABEL[order.direction] || order.direction_other_note || 'Other'}
                    {order.goods_description ? ` · ${order.goods_description}` : ''}
                  </span>
                </div>
                <div className="flex-center gap-8" style={{flexShrink:0}}>
                  <span className={`badge ${sCfg.cls}`}>{sCfg.label}</span>
                  {payBadge(tRow)}
                  <span style={{fontWeight:700, fontSize:14, whiteSpace:'nowrap'}}>
                    Rp {Math.round(totalIDR).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Expanded invoice doc */}
        {selected && (() => {
          const inv      = selInv
          const lines    = buildFeeLines(selected, inv)
          const effU     = parseFloat(usdRate) || inv?.usd_rate || DEFAULT_USD_IDR
          const effS     = parseFloat(sgdRate) || inv?.sgd_rate || DEFAULT_SGD_IDR
          const totalIDR = lines.reduce((s, l) => s + toIDR(l.amount * (l.qty || 1), l.currency, effU, effS), 0)
          const pay      = selTrow?.payment || 'Unpaid'

          return (
            <div className="inv-doc">
              <div className="inv-doc-header">
                <div className="flex-center gap-12">
                  <img src="/logo.png" alt="JEI" style={{width:44, height:44, objectFit:'contain'}} />
                  <div>
                    <div style={{fontFamily:'var(--font-brand)', fontWeight:800, fontSize:14, color:'var(--navy)'}}>
                      JEI EASYSHOP
                    </div>
                    <div className="text-sm text-muted">Freight forwarding · US → SG → ID</div>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontFamily:'var(--font-brand)', fontWeight:800, fontSize:22, color:'var(--navy)'}}>
                    INVOICE
                  </div>
                  <div className="text-sm text-muted">INV-{selected.id?.substring(0,6).toUpperCase()}</div>
                </div>
              </div>

              <hr />

              <div className="inv-meta-row">
                <div>
                  <div className="inv-meta-label">BILL TO</div>
                  <div className="inv-meta-value">{selected.customer_name}</div>
                </div>
                <div>
                  <div className="inv-meta-label">SHIPMENT</div>
                  <div className="inv-meta-value">
                    {selTrow?.tracking_number || `ORD-${selected.id?.substring(0,6).toUpperCase()}`}
                  </div>
                </div>
                <div>
                  <div className="inv-meta-label">STATUS</div>
                  <div>
                    <span className={`badge ${STATUS_CONFIG[getSentStatus(selected, selTrow)].cls}`}>
                      {STATUS_CONFIG[getSentStatus(selected, selTrow)].label}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="inv-meta-label">PAYMENT</div>
                  <div>{payBadge(selTrow)}</div>
                </div>
              </div>

              <hr />

              {/* Fee lines */}
              <table style={{width:'100%', borderCollapse:'collapse', marginBottom:16}}>
                <thead>
                  <tr>
                    {['Description','Qty','Unit Price','Total','In IDR'].map(h => (
                      <th key={h} style={{textAlign: h === 'Description' ? 'left' : 'right',
                        padding:'8px 0', fontSize:11, color:'var(--gray-400)',
                        textTransform:'uppercase', letterSpacing:'0.07em',
                        borderBottom:'1px solid var(--gray-200)'}}>
                        {h === 'Description' ? h : <span style={{float:'right'}}>{h}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr><td colSpan={5} style={{padding:'12px 0', color:'var(--gray-400)', fontSize:13}}>
                      No pricing set — add a cost line below.
                    </td></tr>
                  ) : lines.map((l, i) => {
                    const lineTotal = l.amount * (l.qty || 1)
                    return (
                      <tr key={i}>
                        <td style={{padding:'10px 0', fontSize:13, borderBottom:'1px solid var(--gray-100)'}}>{l.label}</td>
                        <td style={{textAlign:'right', padding:'10px 0', fontSize:13, borderBottom:'1px solid var(--gray-100)', color:'var(--gray-400)'}}>{l.qty || 1}</td>
                        <td style={{textAlign:'right', padding:'10px 0', fontSize:13, borderBottom:'1px solid var(--gray-100)'}}>{formatCurrency(l.amount, l.currency)}</td>
                        <td style={{textAlign:'right', padding:'10px 0', fontSize:13, fontWeight:600, borderBottom:'1px solid var(--gray-100)'}}>{formatCurrency(lineTotal, l.currency)}</td>
                        <td style={{textAlign:'right', padding:'10px 0', fontSize:13, fontWeight:700, color:'var(--navy)', borderBottom:'1px solid var(--gray-100)'}}>
                          Rp {Math.round(toIDR(lineTotal, l.currency, effU, effS)).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Add cost line with qty */}
              <div className="inv-add-cost">
                <div className="inv-section-label">ADD COST LINE</div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:8, alignItems:'flex-end'}}>
                  <input className="form-input" style={{flex:3, minWidth:140}} type="text"
                    placeholder="Description (e.g. Handling fee)"
                    value={costDesc} onChange={e => setCostDesc(e.target.value)} />
                  <div style={{display:'flex', flexDirection:'column', gap:2}}>
                    <div className="text-sm text-muted">Qty</div>
                    <input className="form-input" style={{width:60}} type="number" min="1" step="1"
                      value={costQty} onChange={e => setCostQty(e.target.value)} />
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:2}}>
                    <div className="text-sm text-muted">Unit price</div>
                    <input className="form-input" style={{width:100}} type="number" min="0" step="0.01"
                      placeholder="Amount" value={costAmt} onChange={e => setCostAmt(e.target.value)} />
                  </div>
                  <select className="form-select" style={{width:80}}
                    value={costCur} onChange={e => setCostCur(e.target.value)}>
                    <option>IDR</option><option>USD</option>
                  </select>
                  <button className="btn btn-primary btn-sm" disabled={savingCost}
                    onClick={() => handleAddCost(selected.id)}>
                    <Plus size={13} /> {savingCost ? '…' : 'Add cost'}
                  </button>
                </div>
                {costAmt && costQty && parseInt(costQty) > 1 && (
                  <div className="text-sm text-muted" style={{marginTop:6}}>
                    = {parseInt(costQty)} × {formatCurrency(parseFloat(costAmt)||0, costCur)} = {formatCurrency((parseFloat(costAmt)||0) * (parseInt(costQty)||1), costCur)}
                  </div>
                )}
              </div>

              {/* FX rates */}
              <div className="inv-fx-box">
                <div className="inv-section-label">CONVERSION RATES (this invoice only)</div>
                <div style={{display:'flex', gap:12, marginTop:8, flexWrap:'wrap', alignItems:'flex-end'}}>
                  <div style={{flex:1, minWidth:130}}>
                    <div className="text-sm text-muted" style={{marginBottom:4}}>USD → IDR</div>
                    <input className="form-input" type="number" placeholder={DEFAULT_USD_IDR}
                      value={usdRate} onChange={e => setUsdRate(e.target.value)} />
                  </div>
                  <div style={{flex:1, minWidth:130}}>
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

              {/* Total */}
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
                  <CheckCircle size={14} /> Complete → Cost Tab
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
              This will move the order to the <strong>Cost tab</strong> where you can add cost lines
              to calculate profit. It can be reverted from there if needed.
            </p>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={() => setConfirmId(null)}>Cancel</button>
              <button className="btn btn-green" disabled={completing}
                onClick={() => handleComplete(confirmId)}>
                {completing ? 'Processing…' : '✓ Move to Cost Tab'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

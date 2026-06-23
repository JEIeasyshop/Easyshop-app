// src/components/OrdersTab.jsx
// Grouped by shipment stage by default. Filter chips to switch view.
import { useState, useMemo } from 'react'
import { Plus, Package, Download, Search, Pencil, Trash2 } from 'lucide-react'
import CompleteButton from './CompleteButton'
import OrderForm from './OrderForm'
import { getStageLabel, getStageSequence, isFinalStage, STAGE_LABELS } from '../lib/data'
import { formatCurrency } from '../lib/pricing'

const DIR_LABEL = { us_jkt: 'US → JKT', jkt_us: 'JKT → US', other: 'Other' }

function stageBadge(order, tRow) {
  if (!tRow) return <span className="stage-chip stage-chip-gray">—</span>
  const seq   = getStageSequence(order.service_type)
  const stage = tRow.current_stage
  const label = getStageLabel(order.service_type, stage)
  const isLast = stage === seq[seq.length - 1]
  if (isLast) return <span className="stage-chip stage-chip-green">✓ {label}</span>
  return <span className="stage-chip stage-chip-blue">🚚 {label}</span>
}

function StatusDots({ trackingDone, invoiceDone, costDone }) {
  const dots = [
    { done: trackingDone, title: 'Shipment delivered' },
    { done: invoiceDone,  title: 'Invoice paid' },
    { done: costDone,     title: 'Cost completed' },
  ]
  return (
    <div className="flex-center gap-4" title={dots.map(d => d.title + ': ' + (d.done ? '✓' : '–')).join(' · ')}>
      {dots.map((d, i) => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: d.done ? 'var(--green)' : 'var(--gray-200)',
          transition: 'background 0.2s',
          flexShrink: 0,
        }} />
      ))}
    </div>
  )
}

function exportCSV(orders, tracking) {
  const rows = [
    ['Date','Customer','Direction','Service','Goods','Weight (kg)','Chargeable (kg)','Stage','Total'],
    ...orders.map(o => {
      const t = tracking.find(tr => tr.order_id === o.id)
      return [o.order_date, o.customer_name, DIR_LABEL[o.direction] || o.direction_other_note || 'Other',
        o.service_type === 'full_service' ? 'Full Service' : 'Shipping Only',
        o.goods_description || '', o.weight_kg || '', o.chargeable_weight_kg || '',
        t ? getStageLabel(o.service_type, t.current_stage) : '', o.computed_total || '']
    })
  ]
  const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url
  a.download = `jei-orders-${new Date().toISOString().split('T')[0]}.csv`
  a.click(); URL.revokeObjectURL(url)
}

// All possible stage labels for filter chips
const STAGE_FILTER_OPTIONS = ['All', ...Object.values(STAGE_LABELS)]

export default function OrdersTab({ orders, tracking, costs = [], addOrder, updateOrder, deleteOrder, customers = [], addCustomer, archiveOrder }) {
  const [showForm, setShowForm]     = useState(false)
  const [editOrder, setEditOrder]   = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting, setDeleting]     = useState(false)
  const [search, setSearch]         = useState('')
  const [stageFilter, setStageFilter] = useState('All') // default: show all, grouped by stage

  const getT    = (oid) => tracking.find(t => t.order_id === oid)
  const getCost = (oid) => costs.find(c => c.original_order_id === oid)

  const inFlight  = orders.filter(o => { const t = getT(o.id); return t && !isFinalStage(o, t) }).length
  const delivered = orders.filter(o => { const t = getT(o.id); return t && isFinalStage(o, t) }).length

  // Filter by search + stage chip
  const filtered = useMemo(() => {
    return orders.filter(o => {
      const t = getT(o.id)
      if (stageFilter !== 'All') {
        const stageLabel = t ? getStageLabel(o.service_type, t.current_stage) : '—'
        if (stageLabel !== stageFilter) return false
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        return (o.customer_name || '').toLowerCase().includes(q) ||
               (o.goods_description || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [orders, tracking, stageFilter, search])

  // Group by direction first, then by stage within each direction
  const grouped = useMemo(() => {
    // direction priority order
    const DIR_ORDER = ['us_jkt', 'jkt_us', 'other']
    const stageOrder = Object.values(STAGE_LABELS)

    const byDir = {}
    filtered.forEach(o => {
      const dir = o.direction || 'other'
      if (!byDir[dir]) byDir[dir] = {}
      const t = getT(o.id)
      const stageLbl = t ? getStageLabel(o.service_type, t.current_stage) : 'No tracking'
      if (!byDir[dir][stageLbl]) byDir[dir][stageLbl] = []
      byDir[dir][stageLbl].push(o)
    })

    // Flatten: [{dirKey, dirLabel, stageLabel, orders}]
    const result = []
    DIR_ORDER.filter(d => byDir[d]).forEach(dir => {
      const dirLabel = DIR_LABEL[dir] || 'Other'
      const stages = Object.entries(byDir[dir])
        .sort(([a], [b]) => {
          const ia = stageOrder.indexOf(a); const ib = stageOrder.indexOf(b)
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
        })
      stages.forEach(([stageLbl, orders]) => {
        result.push({ dir, dirLabel, stageLbl, orders })
      })
    })
    return result
  }, [filtered, tracking])

  // Count per stage for filter chips
  const stageCounts = useMemo(() => {
    const counts = { All: orders.length }
    orders.forEach(o => {
      const t = getT(o.id)
      const lbl = t ? getStageLabel(o.service_type, t.current_stage) : 'No tracking'
      counts[lbl] = (counts[lbl] || 0) + 1
    })
    return counts
  }, [orders, tracking])

  const handleDelete = async (id) => {
    setDeleting(true)
    try { await deleteOrder(id); setConfirmDel(null) }
    finally { setDeleting(false) }
  }

  const OrderRow = ({ o }) => {
    const tRow    = getT(o.id)
    const costRec = getCost(o.id)
    const chargedKg = o.chargeable_weight_kg || o.weight_kg
    const cur = o.computed_currency || o.rate_currency || 'USD'

    return (
      <tr>
        <td>
          <div className="text-mono text-sm text-muted">{o.id?.substring(0,8).toUpperCase()}</div>
          <div className="text-sm text-muted mt-4">{new Date(o.order_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</div>
        </td>
        <td>
          <div style={{fontWeight:700, fontSize:14}}>{o.customer_name}</div>
          <div className="text-sm text-muted">
            {DIR_LABEL[o.direction] || o.direction_other_note || 'Other'} · {o.goods_description || (o.service_type === 'full_service' ? 'Full Service' : 'Shipping Only')}
          </div>
          {o.goods_link && <a href={o.goods_link} target="_blank" rel="noreferrer" className="text-sm" style={{color:'var(--blue)'}}>🔗 Order link</a>}
          {o.order_tracking_link && <a href={o.order_tracking_link} target="_blank" rel="noreferrer" className="text-sm" style={{color:'var(--blue)', marginLeft: o.goods_link ? 8 : 0}}>🚚 Track</a>}
          {o.eta_date && <span className="text-sm text-muted" style={{marginLeft:8}}>ETA: {new Date(o.eta_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</span>}
        </td>
        <td>{chargedKg ? <span style={{fontWeight:600}}>{chargedKg} <span className="text-sm text-muted">kg</span></span> : <span className="text-muted text-sm">—</span>}</td>
        <td>{stageBadge(o, tRow)}</td>
        <td>{o.computed_total != null ? <span style={{fontWeight:600}}>{formatCurrency(o.computed_total, cur)}</span> : <span className="text-muted text-sm">—</span>}</td>
        <td>
          {/* 3 status dots — far right, consistent */}
          <StatusDots
            trackingDone={costRec?.tracking_done || false}
            invoiceDone={costRec?.invoice_done || false}
            costDone={costRec?.cost_done || false}
          />
        </td>
        <td>
          <div className="flex-center gap-4">
            <CompleteButton orderId={o.id} costs={costs} archiveOrder={archiveOrder} />
            <button className="btn-ghost btn-sm" title="Edit" onClick={() => setEditOrder(o)}><Pencil size={14} /></button>
            <button className="btn-ghost btn-sm" title="Delete" style={{color:'var(--red)'}} onClick={() => setConfirmDel(o.id)}><Trash2 size={14} /></button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div>
      {/* KPI cards */}
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(2,1fr)'}}>
        <div className="kpi-card"><div className="kpi-label">ACTIVE ORDERS</div><div className="kpi-value">{orders.length}</div><div className="kpi-sub">{inFlight} in flight · {delivered} delivered</div></div>
        <div className="kpi-card"><div className="kpi-label">DELIVERED</div><div className="kpi-value">{delivered}</div><div className="kpi-sub">awaiting completion</div></div>
      </div>

      {/* Stage filter chips */}
      <div className="stage-filter-row">
        {STAGE_FILTER_OPTIONS.filter(s => s === 'All' || (stageCounts[s] || 0) > 0).map(s => (
          <button key={s} className={`stage-filter-chip ${stageFilter === s ? 'active' : ''}`}
            onClick={() => setStageFilter(s)}>
            {s} <span className="stage-filter-count">{stageCounts[s] || 0}</span>
          </button>
        ))}
      </div>

      {/* Search + actions */}
      <div className="orders-toolbar">
        <div className="search-wrap">
          <Search size={15} className="search-icon" />
          <input className="search-input" type="text" placeholder="Search orders, customers…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex-center gap-8">
          <button className="btn btn-outline btn-sm" onClick={() => exportCSV(orders, tracking)}><Download size={13} /> Export CSV</button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={15} /> New order</button>
        </div>
      </div>

      {/* Orders table — grouped by stage */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><Package size={26} /></div>
            <h3>{search || stageFilter !== 'All' ? 'No results' : 'No active orders'}</h3>
            <p>{search || stageFilter !== 'All' ? 'Try clearing the filter.' : 'Create a new order to get started.'}</p>
          </div>
        </div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          {grouped.map(({ dir, dirLabel, stageLbl, orders: groupOrders }, idx) => {
            // Show direction header only when it changes
            const prevDir = idx > 0 ? grouped[idx-1].dir : null
            const showDirHeader = dir !== prevDir
            return (
              <div key={`${dir}-${stageLbl}`}>
                {/* Direction header — bold, prominent */}
                {showDirHeader && (
                  <div style={{
                    padding:'10px 16px',
                    background:'var(--navy)', color:'var(--gold)',
                    borderRadius:'var(--r-lg) var(--r-lg) 0 0',
                    fontFamily:'var(--font-brand)', fontWeight:800, fontSize:14,
                    letterSpacing:'0.02em',
                    marginTop: idx > 0 ? 8 : 0,
                  }}>
                    {dirLabel}
                  </div>
                )}
                <div className="card" style={{borderRadius: showDirHeader ? '0 0 var(--r-lg) var(--r-lg)' : 'var(--r-lg)', marginTop:0}}>
                  {/* Stage sub-header */}
                  <div style={{
                    padding:'6px 16px', background:'var(--gray-50)',
                    borderBottom:'1px solid var(--gray-100)',
                    fontSize:11, fontWeight:700, color:'var(--gray-400)',
                    textTransform:'uppercase', letterSpacing:'0.08em',
                    display:'flex', justifyContent:'space-between',
                  }}>
                    <span>🚚 {stageLbl}</span>
                    <span style={{fontWeight:500}}>{groupOrders.length} order{groupOrders.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Order</th><th>Customer / Goods</th><th>Charged kg</th><th>Stage</th><th>Revenue</th>
                          <th title="Tracking · Invoice · Cost">Status</th><th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupOrders.map(o => <OrderRow key={o.id} o={o} />)}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && <OrderForm customers={customers} addCustomer={addCustomer} onSubmit={async (data) => { await addOrder(data); setShowForm(false) }} onClose={() => setShowForm(false)} />}
      {editOrder && <OrderForm initialData={editOrder} customers={customers} addCustomer={addCustomer} onSubmit={async (data) => { await updateOrder(editOrder.id, data); setEditOrder(null) }} onClose={() => setEditOrder(null)} />}

      {confirmDel && (
        <div className="overlay">
          <div className="confirm-modal">
            <h3>Delete this order?</h3>
            <p>This will permanently remove the order from all tabs. <strong>This cannot be undone.</strong></p>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleting} onClick={() => handleDelete(confirmDel)}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

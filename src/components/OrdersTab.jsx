// src/components/OrdersTab.jsx
// Design: matches JEI dashboard — KPI cards, search bar, table with
// charged kg, stage badge, revenue, + New order button
import { useState, useMemo } from 'react'
import { Plus, Package, Download, Search } from 'lucide-react'
import OrderForm from './OrderForm'
import { getStageLabel, getStageSequence, isFinalStage } from '../lib/data'
import { formatCurrency } from '../lib/pricing'

const DIR_LABEL = { us_jkt: 'US → JKT', jkt_us: 'JKT → US', other: 'Other' }

function stageBadge(order, tRow) {
  if (!tRow) return <span className="stage-chip stage-chip-gray">—</span>
  const seq   = getStageSequence(order.service_type)
  const stage = tRow.current_stage
  const label = getStageLabel(order.service_type, stage)
  const isLast = stage === seq[seq.length - 1]
  if (isLast) return (
    <span className="stage-chip stage-chip-green">
      <span className="stage-chip-dot">✓</span>{label}
    </span>
  )
  return (
    <span className="stage-chip stage-chip-blue">
      <span className="stage-chip-icon">🚚</span>{label}
    </span>
  )
}

function exportCSV(orders, tracking) {
  const rows = [
    ['Date','Customer','Direction','Service','Goods','Weight (kg)','Chargeable (kg)','Stage','Total'],
    ...orders.map(o => {
      const t = tracking.find(tr => tr.order_id === o.id)
      return [
        o.order_date, o.customer_name,
        DIR_LABEL[o.direction] || o.direction_other_note || 'Other',
        o.service_type === 'full_service' ? 'Full Service' : 'Shipping Only',
        o.goods_description || '',
        o.weight_kg || '',
        o.chargeable_weight_kg || '',
        t ? getStageLabel(o.service_type, t.current_stage) : '',
        o.computed_total || '',
      ]
    })
  ]
  const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url
  a.download = `jei-orders-${new Date().toISOString().split('T')[0]}.csv`
  a.click(); URL.revokeObjectURL(url)
}

export default function OrdersTab({ orders, tracking, addOrder }) {
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch]     = useState('')

  const getT = (oid) => tracking.find(t => t.order_id === oid)

  // KPIs
  const inFlight   = orders.filter(o => { const t = getT(o.id); return t && !isFinalStage(o, t) }).length
  const delivered  = orders.filter(o => { const t = getT(o.id); return t && isFinalStage(o, t)  }).length
  const totalRev   = orders.reduce((s, o) => s + Number(o.computed_total || 0), 0)
  const revCur     = orders.find(o => o.computed_currency)?.computed_currency || 'USD'

  // Search filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return orders
    return orders.filter(o =>
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.goods_description || '').toLowerCase().includes(q) ||
      (o.direction_other_note || '').toLowerCase().includes(q)
    )
  }, [orders, search])

  return (
    <div>
      {/* KPI cards — matches JEI dashboard layout */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">ACTIVE ORDERS</div>
          <div className="kpi-value">{orders.length}</div>
          <div className="kpi-sub">{inFlight} in flight · {delivered} delivered</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">REVENUE (BOOKED)</div>
          <div className="kpi-value kpi-value-gold">{formatCurrency(totalRev, revCur)}</div>
          <div className="kpi-sub">all open orders</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">DELIVERED</div>
          <div className="kpi-value">{delivered}</div>
          <div className="kpi-sub">awaiting invoice</div>
        </div>
      </div>

      {/* Search + actions bar */}
      <div className="orders-toolbar">
        <div className="search-wrap">
          <Search size={15} className="search-icon" />
          <input className="search-input" type="text"
            placeholder="Search orders, customers, products…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex-center gap-8">
          <button className="btn btn-outline btn-sm" onClick={() => exportCSV(orders, tracking)}>
            <Download size={13} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={15} /> New order
          </button>
        </div>
      </div>

      {/* Orders table */}
      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Package size={26} /></div>
            <h3>{search ? 'No results' : 'No active orders'}</h3>
            <p>{search ? 'Try a different search.' : 'Create a new order to get started.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer / Goods</th>
                  <th>Charged kg</th>
                  <th>Stage</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const tRow = getT(o.id)
                  const chargedKg = o.chargeable_weight_kg || o.weight_kg
                  const rev = o.computed_total
                  const cur = o.computed_currency || o.rate_currency || 'USD'

                  return (
                    <tr key={o.id}>
                      <td>
                        <div className="text-mono text-sm text-muted">
                          {o.id?.substring(0,8).toUpperCase()}
                        </div>
                        <div className="text-sm text-muted mt-4">
                          {new Date(o.order_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}
                        </div>
                      </td>
                      <td>
                        <div style={{fontWeight:700, fontSize:14}}>{o.customer_name}</div>
                        <div className="text-sm text-muted">
                          {DIR_LABEL[o.direction] || o.direction_other_note || 'Other'} ·{' '}
                          {o.goods_description || (o.service_type === 'full_service' ? 'Full Service' : 'Shipping Only')}
                        </div>
                        {o.goods_link &&
                          <a href={o.goods_link} target="_blank" rel="noreferrer"
                            className="text-sm" style={{color:'var(--blue)'}}>🔗 Order link</a>}
                        {o.order_tracking_link &&
                          <a href={o.order_tracking_link} target="_blank" rel="noreferrer"
                            className="text-sm" style={{color:'var(--blue)', marginLeft: o.goods_link ? 8 : 0}}>
                            🚚 Track
                          </a>}
                        {o.eta_date &&
                          <span className="text-sm text-muted" style={{marginLeft:8}}>
                            ETA: {new Date(o.eta_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                          </span>}
                      </td>
                      <td>
                        {chargedKg
                          ? <span style={{fontWeight:600}}>{chargedKg} <span className="text-sm text-muted">kg</span></span>
                          : <span className="text-muted text-sm">—</span>}
                      </td>
                      <td>{stageBadge(o, tRow)}</td>
                      <td>
                        <div style={{fontWeight:600}}>
                          {rev != null ? formatCurrency(rev, cur) : <span className="text-muted text-sm">—</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <OrderForm
          onSubmit={async (data) => { await addOrder(data); setShowForm(false) }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}

// src/components/FinanceTab.jsx — owner only
import { DollarSign, TrendingUp, BarChart2 } from 'lucide-react'

const DIR = { us_jkt: 'US → JKT', jkt_us: 'JKT → US', other: 'Other' }
const SVC = { full_service: 'Full Service', shipping_only: 'Shipping Only' }

export default function FinanceTab({ completedOrders }) {
  const recs = completedOrders.map(c => ({
    ord: c.order_snapshot  || {},
    inv: c.invoice_snapshot || {},
    completedAt: c.completed_at,
  }))

  const total  = recs.reduce((s, r) => s + Number(r.inv.total || 0), 0)
  const avg    = recs.length ? total / recs.length : 0
  const byDir  = {}
  const bySvc  = {}
  const byMon  = {}

  recs.forEach(r => {
    const amt = Number(r.inv.total || 0)
    const dir = r.ord.direction || 'other'
    const svc = r.ord.service_type || 'unknown'
    const mon = new Date(r.completedAt).toLocaleString('en-GB', { month: 'short', year: 'numeric' })
    byDir[dir] = (byDir[dir] || 0) + amt
    bySvc[svc] = (bySvc[svc] || 0) + amt
    byMon[mon] = (byMon[mon] || 0) + amt
  })

  return (
    <div>
      <div className="page-header">
        <h2>Finance</h2>
        <p>Revenue summary from completed orders (last 14 days)</p>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-icon gold"><DollarSign size={18} /></div>
          <div className="stat-value">${total.toFixed(2)}</div>
          <div className="stat-label">Total Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon navy"><BarChart2 size={18} /></div>
          <div className="stat-value">{recs.length}</div>
          <div className="stat-label">Orders Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon green"><TrendingUp size={18} /></div>
          <div className="stat-value">${avg.toFixed(2)}</div>
          <div className="stat-label">Avg per Order</div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16}}>
        {/* By direction */}
        <div className="card">
          <div className="card-header"><h3>By Direction</h3></div>
          <div className="card-body">
            {Object.keys(byDir).length === 0
              ? <p className="text-sm text-muted">No data yet</p>
              : Object.entries(byDir).map(([k, v]) => (
                <div key={k} className="flex-between" style={{padding:'7px 0', borderBottom:'1px solid var(--gray-100)'}}>
                  <span style={{fontSize:13}}>{DIR[k] || k}</span>
                  <span style={{fontWeight:700, fontSize:13}}>${v.toFixed(2)}</span>
                </div>
              ))
            }
          </div>
        </div>

        {/* By service */}
        <div className="card">
          <div className="card-header"><h3>By Service Type</h3></div>
          <div className="card-body">
            {Object.keys(bySvc).length === 0
              ? <p className="text-sm text-muted">No data yet</p>
              : Object.entries(bySvc).map(([k, v]) => (
                <div key={k} className="flex-between" style={{padding:'7px 0', borderBottom:'1px solid var(--gray-100)'}}>
                  <span style={{fontSize:13}}>{SVC[k] || k}</span>
                  <span style={{fontWeight:700, fontSize:13}}>${v.toFixed(2)}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Monthly */}
      <div className="card">
        <div className="card-header"><h3>Monthly Revenue</h3></div>
        <div className="card-body">
          {Object.keys(byMon).length === 0
            ? <p className="text-sm text-muted">No completed orders yet</p>
            : Object.entries(byMon).map(([mon, v]) => (
              <div key={mon} className="flex-between" style={{padding:'9px 0', borderBottom:'1px solid var(--gray-100)'}}>
                <span style={{fontSize:13, fontWeight:500}}>{mon}</span>
                <span style={{fontWeight:800, color:'var(--navy)', fontFamily:'var(--font-brand)', fontSize:15}}>${v.toFixed(2)}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// src/components/FinanceTab.jsx — owner only
// Shows: total revenue, monthly breakdown, most returning customers
import { useState, useMemo } from 'react'
import { DollarSign, TrendingUp, Users, BarChart2, Calendar } from 'lucide-react'
import { formatCurrency } from '../lib/pricing'

const DIR = { us_jkt: 'US → JKT', jkt_us: 'JKT → US', other: 'Other' }
const SVC = { full_service: 'Full Service', shipping_only: 'Shipping Only' }

// Default USD→IDR rate for display
const DEFAULT_FX = 15850

function MonthBar({ label, value, max, currency }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{marginBottom:12}}>
      <div className="flex-between text-sm" style={{marginBottom:4}}>
        <span style={{fontWeight:500}}>{label}</span>
        <span style={{fontWeight:700, color:'var(--navy)'}}>{formatCurrency(value, currency)}</span>
      </div>
      <div style={{background:'var(--gray-100)', borderRadius:4, height:8, overflow:'hidden'}}>
        <div style={{
          width:`${pct}%`, height:'100%',
          background:'linear-gradient(90deg, var(--navy), var(--navy-light))',
          borderRadius:4, transition:'width 0.4s ease'
        }} />
      </div>
    </div>
  )
}

export default function FinanceTab({ completedOrders, orders = [] }) {
  const [period, setPeriod] = useState('all')  // 'all' | '3m' | '6m' | '12m'
  const [currency, setCurrency] = useState('USD')

  // Filter by period
  const periodOrders = useMemo(() => {
    if (period === 'all') return completedOrders
    const months = parseInt(period)
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - months)
    return completedOrders.filter(c => new Date(c.completed_at) >= cutoff)
  }, [completedOrders, period])

  // Revenue from completed (locked invoice total)
  const getAmt = (c) => {
    const inv = c.invoice_snapshot || {}
    const ord = c.order_snapshot   || {}
    const rawAmt = Number(inv.total || ord.computed_total || 0)
    const rawCur = inv.currency || ord.computed_currency || ord.rate_currency || 'USD'
    if (currency === 'IDR') {
      const fxU = Number(inv.usd_rate || DEFAULT_FX)
      if (rawCur === 'IDR') return rawAmt
      return rawAmt * fxU
    }
    return rawAmt // show in original USD
  }

  // ── KPIs ──────────────────────────────────────────────────
  const totalRevenue = periodOrders.reduce((s, c) => s + getAmt(c), 0)
  const avgPerOrder  = periodOrders.length ? totalRevenue / periodOrders.length : 0

  // Active orders (in flight)
  const activeRevenue = orders.reduce((s, o) => s + Number(o.computed_total || 0), 0)

  // ── Monthly breakdown ──────────────────────────────────────
  const byMonth = useMemo(() => {
    const m = {}
    periodOrders.forEach(c => {
      const d   = new Date(c.completed_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const lbl = d.toLocaleString('en-GB', { month: 'short', year: 'numeric' })
      if (!m[key]) m[key] = { label: lbl, amount: 0, count: 0 }
      m[key].amount += getAmt(c)
      m[key].count  += 1
    })
    return Object.entries(m)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v)
  }, [periodOrders, currency])

  const maxMonthly = Math.max(...byMonth.map(m => m.amount), 1)

  // ── By direction ──────────────────────────────────────────
  const byDir = useMemo(() => {
    const d = {}
    periodOrders.forEach(c => {
      const key = (c.order_snapshot?.direction) || 'other'
      d[key] = (d[key] || 0) + getAmt(c)
    })
    return d
  }, [periodOrders, currency])

  // ── By service type ───────────────────────────────────────
  const bySvc = useMemo(() => {
    const s = {}
    periodOrders.forEach(c => {
      const key = (c.order_snapshot?.service_type) || 'unknown'
      s[key] = (s[key] || 0) + getAmt(c)
    })
    return s
  }, [periodOrders, currency])

  // ── Top customers ──────────────────────────────────────────
  const topCustomers = useMemo(() => {
    const map = {}
    // Active orders
    orders.forEach(o => {
      const name = (o.customer_name || 'Unknown').trim()
      if (!map[name]) map[name] = { name, revenue: 0, count: 0 }
      map[name].count  += 1
      map[name].revenue += Number(o.computed_total || 0)
    })
    // Completed orders
    periodOrders.forEach(c => {
      const name = (c.order_snapshot?.customer_name || 'Unknown').trim()
      if (!map[name]) map[name] = { name, revenue: 0, count: 0 }
      map[name].count  += 1
      map[name].revenue += getAmt(c)
    })
    return Object.values(map)
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
      .slice(0, 8)
  }, [periodOrders, orders, currency])

  const maxCustRev = Math.max(...topCustomers.map(c => c.revenue), 1)

  return (
    <div>
      {/* Header + controls */}
      <div className="page-header-row">
        <div className="page-header" style={{marginBottom:0}}>
          <h2>Finance & Summary</h2>
          <p>Revenue recap across all completed orders</p>
        </div>
        <div className="flex-center gap-8">
          {/* Currency toggle */}
          <div className="pay-seg">
            {['USD','IDR'].map(c => (
              <button key={c} className={`pay-seg-btn ${currency === c ? 'pay-seg-active' : ''}`}
                onClick={() => setCurrency(c)}>{c}</button>
            ))}
          </div>
          {/* Period filter */}
          <div className="pay-seg">
            {[['all','All'],['3m','3M'],['6m','6M'],['12m','12M']].map(([v,l]) => (
              <button key={v} className={`pay-seg-btn ${period === v ? 'pay-seg-active' : ''}`}
                onClick={() => setPeriod(v)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid kpi-grid-4 mt-16">
        <div className="kpi-card">
          <div className="stat-card-icon gold" style={{width:36,height:36,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12,background:'var(--gold-pale)'}}>
            <DollarSign size={18} color="var(--amber)" />
          </div>
          <div className="kpi-value" style={{fontSize:20}}>{formatCurrency(totalRevenue, currency)}</div>
          <div className="kpi-label" style={{marginTop:4}}>Total Revenue</div>
          <div className="kpi-sub">from {periodOrders.length} completed orders</div>
        </div>
        <div className="kpi-card">
          <div className="stat-card-icon navy" style={{width:36,height:36,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12,background:'var(--navy-pale)'}}>
            <TrendingUp size={18} color="var(--navy)" />
          </div>
          <div className="kpi-value" style={{fontSize:20}}>{formatCurrency(avgPerOrder, currency)}</div>
          <div className="kpi-label" style={{marginTop:4}}>Avg per Order</div>
          <div className="kpi-sub">across completed period</div>
        </div>
        <div className="kpi-card">
          <div className="stat-card-icon green" style={{width:36,height:36,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12,background:'var(--green-bg)'}}>
            <BarChart2 size={18} color="var(--green)" />
          </div>
          <div className="kpi-value" style={{fontSize:20}}>{formatCurrency(activeRevenue, 'USD')}</div>
          <div className="kpi-label" style={{marginTop:4}}>Pipeline Revenue</div>
          <div className="kpi-sub">from {orders.length} active orders</div>
        </div>
        <div className="kpi-card">
          <div className="stat-card-icon navy" style={{width:36,height:36,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12,background:'var(--navy-pale)'}}>
            <Users size={18} color="var(--navy)" />
          </div>
          <div className="kpi-value" style={{fontSize:20}}>{topCustomers.length}</div>
          <div className="kpi-label" style={{marginTop:4}}>Unique Customers</div>
          <div className="kpi-sub">active + completed</div>
        </div>
      </div>

      {/* Monthly + breakdown row */}
      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, marginBottom:16}}>

        {/* Monthly revenue chart */}
        <div className="card">
          <div className="card-header">
            <h3><Calendar size={14} style={{marginRight:6, verticalAlign:'middle'}} />Monthly Revenue</h3>
            <span className="text-sm text-muted">{byMonth.length} month{byMonth.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="card-body">
            {byMonth.length === 0
              ? <p className="text-sm text-muted">No completed orders in this period.</p>
              : byMonth.map((m, i) => (
                <MonthBar key={i} label={m.label} value={m.amount} max={maxMonthly} currency={currency} />
              ))
            }
          </div>
        </div>

        {/* Direction + service breakdown */}
        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          <div className="card">
            <div className="card-header"><h3>By Direction</h3></div>
            <div className="card-body">
              {Object.keys(byDir).length === 0
                ? <p className="text-sm text-muted">No data yet</p>
                : Object.entries(byDir).map(([k, v]) => (
                  <div key={k} className="flex-between" style={{padding:'7px 0', borderBottom:'1px solid var(--gray-100)'}}>
                    <span style={{fontSize:13}}>{DIR[k] || k}</span>
                    <span style={{fontWeight:700, fontSize:13}}>{formatCurrency(v, currency)}</span>
                  </div>
                ))
              }
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3>By Service</h3></div>
            <div className="card-body">
              {Object.keys(bySvc).length === 0
                ? <p className="text-sm text-muted">No data yet</p>
                : Object.entries(bySvc).map(([k, v]) => (
                  <div key={k} className="flex-between" style={{padding:'7px 0', borderBottom:'1px solid var(--gray-100)'}}>
                    <span style={{fontSize:13}}>{SVC[k] || k}</span>
                    <span style={{fontWeight:700, fontSize:13}}>{formatCurrency(v, currency)}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>

      {/* Top customers */}
      <div className="card">
        <div className="card-header">
          <h3><Users size={14} style={{marginRight:6, verticalAlign:'middle'}} />Most Returning Customers</h3>
          <span className="text-sm text-muted">by order count</span>
        </div>
        <div className="card-body">
          {topCustomers.length === 0
            ? <p className="text-sm text-muted">No customer data yet.</p>
            : topCustomers.map((c, i) => (
              <div key={c.name} style={{
                display:'flex', alignItems:'center', gap:14,
                padding:'10px 0', borderBottom: i < topCustomers.length - 1 ? '1px solid var(--gray-100)' : 'none'
              }}>
                {/* Rank */}
                <div style={{
                  width:28, height:28, borderRadius:'50%',
                  background: i === 0 ? 'var(--gold)' : i === 1 ? 'var(--gray-200)' : i === 2 ? '#CD7F32' : 'var(--gray-100)',
                  color: i < 3 ? 'var(--navy)' : 'var(--gray-400)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'var(--font-brand)', fontWeight:800, fontSize:12, flexShrink:0,
                }}>
                  {i + 1}
                </div>
                {/* Name + bar */}
                <div style={{flex:1}}>
                  <div style={{fontWeight:700, fontSize:13, marginBottom:4}}>{c.name}</div>
                  <div style={{background:'var(--gray-100)', borderRadius:4, height:6, overflow:'hidden'}}>
                    <div style={{
                      width:`${Math.round((c.revenue / maxCustRev) * 100)}%`,
                      height:'100%', borderRadius:4,
                      background: i === 0 ? 'var(--gold)' : 'var(--navy)',
                      transition:'width 0.4s ease',
                    }} />
                  </div>
                </div>
                {/* Stats */}
                <div style={{textAlign:'right', flexShrink:0}}>
                  <div style={{fontWeight:700, fontSize:13, color:'var(--navy)'}}>
                    {formatCurrency(c.revenue, currency)}
                  </div>
                  <div className="text-sm text-muted">
                    {c.count} order{c.count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

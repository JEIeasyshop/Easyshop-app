// src/components/FinanceTab.jsx — owner only — full financial dashboard
import { useState, useMemo } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Percent, List } from 'lucide-react'
import { formatCurrency } from '../lib/pricing'

const DIR = { us_jkt: 'US → JKT', jkt_us: 'JKT → US', other: 'Other' }
const DEFAULT_FX = 15850

export default function FinanceTab({ completedOrders }) {
  const [period, setPeriod]   = useState('all')
  const [currency, setCurrency] = useState('IDR')
  const [expandedId, setExpandedId] = useState(null)

  const periodOrders = useMemo(() => {
    if (period === 'all') return completedOrders
    const months = parseInt(period)
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - months)
    return completedOrders.filter(c => new Date(c.completed_at) >= cutoff)
  }, [completedOrders, period])

  const toDisplay = (amount, cur, fx) => {
    const rate = parseFloat(fx) || DEFAULT_FX
    if (currency === 'IDR') return cur === 'IDR' ? amount : amount * rate
    return cur === 'USD' ? amount : amount / rate
  }

  const getFinancials = (rec) => {
    const inv      = rec.invoice_snapshot  || {}
    const cost     = rec.cost_snapshot     || {}
    const ord      = rec.order_snapshot    || {}
    const fx       = cost.usd_rate || inv.usd_rate || DEFAULT_FX
    const revRaw   = Number(inv.total || ord.computed_total || 0)
    const revCur   = inv.currency || ord.rate_currency || 'USD'
    const costRaw  = Number(cost.total_cost || 0)
    const costCur  = cost.currency || 'USD'
    const rev      = toDisplay(revRaw, revCur, fx)
    const cos      = toDisplay(costRaw, costCur, fx)
    const profit   = rev - cos
    const margin   = rev > 0 ? (profit / rev) * 100 : 0
    return { rev, cos, profit, margin, fx, ord }
  }

  // Aggregate KPIs
  const totals = useMemo(() => {
    return periodOrders.reduce((acc, rec) => {
      const { rev, cos, profit } = getFinancials(rec)
      acc.revenue += rev
      acc.cost    += cos
      acc.profit  += profit
      return acc
    }, { revenue: 0, cost: 0, profit: 0 })
  }, [periodOrders, currency])

  const totalMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0

  const dispCur = currency === 'IDR' ? 'IDR' : 'USD'

  return (
    <div>
      {/* Header */}
      <div className="page-header-row">
        <div className="page-header" style={{marginBottom:0}}>
          <h2>Finance</h2>
          <p>Revenue, cost, profit from all archived orders</p>
        </div>
        <div className="flex-center gap-8">
          <div className="pay-seg">
            {['IDR','USD'].map(c => (
              <button key={c} className={`pay-seg-btn ${currency === c ? 'pay-seg-active' : ''}`}
                onClick={() => setCurrency(c)}>{c}</button>
            ))}
          </div>
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
        {[
          { icon: <DollarSign size={18} />, label: 'Total Revenue', val: formatCurrency(totals.revenue, dispCur), cls: 'gold' },
          { icon: <TrendingDown size={18} />, label: 'Total Cost',  val: formatCurrency(totals.cost, dispCur),    cls: 'red'  },
          { icon: <TrendingUp size={18} />, label: 'Net Profit',    val: formatCurrency(totals.profit, dispCur),  cls: totals.profit >= 0 ? 'green' : 'red' },
          { icon: <Percent size={18} />,    label: 'Margin',        val: `${totalMargin.toFixed(1)}%`,            cls: totalMargin >= 0 ? 'green' : 'red' },
        ].map(s => (
          <div className="kpi-card" key={s.label}>
            <div className={`stat-card-icon ${s.cls}`} style={{
              width:36, height:36, borderRadius:8,
              display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12,
              background: s.cls === 'gold' ? 'var(--gold-pale)' : s.cls === 'green' ? 'var(--green-bg)' : s.cls === 'red' ? 'var(--red-bg)' : 'var(--navy-pale)',
              color:      s.cls === 'gold' ? 'var(--amber)' : s.cls === 'green' ? 'var(--green)' : s.cls === 'red' ? 'var(--red)' : 'var(--navy)',
            }}>
              {s.icon}
            </div>
            <div className="kpi-value" style={{fontSize:18}}>{s.val}</div>
            <div className="kpi-label" style={{marginTop:4}}>{s.label}</div>
            <div className="kpi-sub">{periodOrders.length} orders</div>
          </div>
        ))}
      </div>

      {/* All completed orders table */}
      <div className="card mt-16">
        <div className="card-header">
          <h3><List size={14} style={{marginRight:6, verticalAlign:'middle'}} />All Completed Orders</h3>
          <span className="text-sm text-muted">{periodOrders.length} records</span>
        </div>
        {periodOrders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><DollarSign size={24} /></div>
            <h3>No completed orders</h3>
            <p>Archive orders from the Cost tab to see them here.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Direction</th>
                  <th>Service</th>
                  <th>Goods</th>
                  <th style={{textAlign:'right'}}>Revenue</th>
                  <th style={{textAlign:'right'}}>Cost</th>
                  <th style={{textAlign:'right'}}>Profit</th>
                  <th style={{textAlign:'right'}}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {periodOrders.map(rec => {
                  const { rev, cos, profit, margin, ord } = getFinancials(rec)
                  const isExp = expandedId === rec.id
                  const inv   = rec.invoice_snapshot  || {}
                  const cost  = rec.cost_snapshot     || {}

                  return <>
                    <tr key={rec.id} style={{cursor:'pointer'}}
                      onClick={() => setExpandedId(isExp ? null : rec.id)}>
                      <td className="text-sm text-muted">
                        {new Date(rec.completed_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                      </td>
                      <td style={{fontWeight:700}}>{ord.customer_name || '—'}</td>
                      <td className="text-sm">{DIR[ord.direction] || ord.direction_other_note || 'Other'}</td>
                      <td>
                        <span className={`badge ${ord.service_type === 'full_service' ? 'badge-navy' : 'badge-gray'}`}>
                          {ord.service_type === 'full_service' ? 'Full Service' : 'Shipping Only'}
                        </span>
                      </td>
                      <td className="text-sm ellipsis" style={{maxWidth:160}}>{ord.goods_description || '—'}</td>
                      <td style={{textAlign:'right', fontWeight:600, color:'var(--navy)'}}>
                        {formatCurrency(rev, dispCur)}
                      </td>
                      <td style={{textAlign:'right', fontWeight:600, color:'var(--red)'}}>
                        {formatCurrency(cos, dispCur)}
                      </td>
                      <td style={{textAlign:'right', fontWeight:700, color: profit >= 0 ? 'var(--green)' : 'var(--red)'}}>
                        {formatCurrency(profit, dispCur)}
                      </td>
                      <td style={{textAlign:'right'}}>
                        <span className={`badge ${margin >= 0 ? 'badge-green' : 'badge-red'}`}>
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>

                    {/* Expanded detail */}
                    {isExp && (
                      <tr key={rec.id + '-exp'}>
                        <td colSpan={9} style={{background:'var(--gray-50)', padding:'14px 20px'}}>
                          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20}}>
                            <div>
                              <div className="text-sm fw-700 text-muted" style={{marginBottom:6}}>INVOICE LINES</div>
                              {(inv.additional_costs || []).length === 0
                                ? <p className="text-sm text-muted">No invoice lines recorded</p>
                                : (inv.additional_costs || []).map((l, i) => (
                                  <div key={i} className="flex-between text-sm" style={{padding:'3px 0'}}>
                                    <span>{l.description} {l.qty > 1 ? `×${l.qty}` : ''}</span>
                                    <span>{formatCurrency(Number(l.amount) * (Number(l.qty)||1), l.currency || 'USD')}</span>
                                  </div>
                                ))
                              }
                            </div>
                            <div>
                              <div className="text-sm fw-700 text-muted" style={{marginBottom:6}}>COST LINES</div>
                              {(cost.cost_lines || []).length === 0
                                ? <p className="text-sm text-muted">No cost lines recorded</p>
                                : (cost.cost_lines || []).map((l, i) => (
                                  <div key={i} className="flex-between text-sm" style={{padding:'3px 0'}}>
                                    <span style={{color:'var(--red)'}}>{l.description} {l.qty > 1 ? `×${l.qty}` : ''}</span>
                                    <span style={{color:'var(--red)'}}>{formatCurrency(Number(l.amount) * (Number(l.qty)||1), l.currency || 'USD')}</span>
                                  </div>
                                ))
                              }
                            </div>
                          </div>
                          {ord.additional_notes && (
                            <div className="text-sm text-muted" style={{marginTop:10}}>
                              <strong>Notes:</strong> {ord.additional_notes}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                })}
              </tbody>
              {/* Totals footer */}
              <tfoot>
                <tr style={{background:'var(--navy)'}}>
                  <td colSpan={5} style={{padding:'12px 16px', color:'rgba(255,255,255,0.6)', fontSize:12, fontWeight:700}}>
                    TOTAL ({periodOrders.length} orders)
                  </td>
                  <td style={{textAlign:'right', padding:'12px 16px', fontWeight:800, color:'var(--gold)', fontFamily:'var(--font-brand)', fontSize:14}}>
                    {formatCurrency(totals.revenue, dispCur)}
                  </td>
                  <td style={{textAlign:'right', padding:'12px 16px', fontWeight:800, color:'#FCA5A5', fontFamily:'var(--font-brand)', fontSize:14}}>
                    {formatCurrency(totals.cost, dispCur)}
                  </td>
                  <td style={{textAlign:'right', padding:'12px 16px', fontWeight:800, color: totals.profit >= 0 ? '#6EE7B7' : '#FCA5A5', fontFamily:'var(--font-brand)', fontSize:14}}>
                    {formatCurrency(totals.profit, dispCur)}
                  </td>
                  <td style={{textAlign:'right', padding:'12px 16px', fontWeight:800, color: totalMargin >= 0 ? '#6EE7B7' : '#FCA5A5', fontFamily:'var(--font-brand)', fontSize:14}}>
                    {totalMargin.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

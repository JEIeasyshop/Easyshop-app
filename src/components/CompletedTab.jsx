// src/components/CompletedTab.jsx
import { Archive } from 'lucide-react'

export default function CompletedTab({ completedOrders }) {
  const daysLeft = (d) => Math.max(0, Math.ceil((new Date(d) - new Date()) / 86400000))

  return (
    <div>
      <div className="page-header">
        <h2>Completed</h2>
        <p>Records are kept for 14 days then automatically removed</p>
      </div>

      {completedOrders.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><Archive size={26} /></div>
            <h3>No completed orders</h3>
            <p>Completed orders will appear here for 14 days.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Completed</th>
                  <th>Customer</th>
                  <th>Direction</th>
                  <th>Service</th>
                  <th>Goods</th>
                  <th>Total</th>
                  <th>Deletes in</th>
                </tr>
              </thead>
              <tbody>
                {completedOrders.map(c => {
                  const o   = c.order_snapshot   || {}
                  const inv = c.invoice_snapshot  || {}
                  const days = daysLeft(c.auto_delete_after)
                  return (
                    <tr key={c.id}>
                      <td className="text-sm text-muted">
                        {new Date(c.completed_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                      </td>
                      <td style={{fontWeight:600}}>{o.customer_name || '—'}</td>
                      <td className="text-sm">
                        {o.direction === 'us_jkt' ? 'US → JKT' : o.direction === 'jkt_us' ? 'JKT → US' : o.direction_other_note || 'Other'}
                      </td>
                      <td>
                        <span className={`badge ${o.service_type === 'full_service' ? 'badge-navy' : 'badge-gray'}`}>
                          {o.service_type === 'full_service' ? 'Full Service' : 'Shipping Only'}
                        </span>
                      </td>
                      <td className="text-sm ellipsis" style={{maxWidth:180}}>{o.goods_description || '—'}</td>
                      <td style={{fontWeight:700}}>
                        {inv.total != null ? `$${Number(inv.total).toFixed(2)}` : '—'}
                      </td>
                      <td>
                        <span className={`badge ${days <= 3 ? 'badge-amber' : 'badge-gray'}`}>{days}d</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// src/components/OrdersTab.jsx
import { useState } from 'react'
import { Plus, Package, ArrowRight } from 'lucide-react'
import OrderForm from './OrderForm'

const DIR_LABEL = { us_jkt: 'US → JKT', jkt_us: 'JKT → US', other: 'Other' }

function dirBadge(d) {
  if (d === 'us_jkt') return <span className="badge badge-blue">US → JKT</span>
  if (d === 'jkt_us') return <span className="badge badge-amber">JKT → US</span>
  return <span className="badge badge-gray">Other</span>
}
function svcBadge(s) {
  return s === 'full_service'
    ? <span className="badge badge-navy">Full Service</span>
    : <span className="badge badge-gray">Shipping Only</span>
}

export default function OrdersTab({ orders, tracking, addOrder }) {
  const [showForm, setShowForm] = useState(false)

  const getStage = (orderId) => tracking.find(t => t.order_id === orderId)?.current_stage ?? null

  return (
    <div>
      <div className="page-header-row">
        <div className="page-header" style={{marginBottom:0}}>
          <h2>Orders</h2>
          <p>{orders.length} active order{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={15} /> New Order
        </button>
      </div>

      <div className="card mt-16">
        {orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Package size={26} /></div>
            <h3>No active orders</h3>
            <p>Create a new order to get started.</p>
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
                  <th>Weight</th>
                  <th>Stage</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td className="text-sm text-muted">
                      {new Date(o.order_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                    </td>
                    <td style={{fontWeight:600}}>{o.customer_name}</td>
                    <td>
                      {dirBadge(o.direction)}
                      {o.direction === 'other' && o.direction_other_note &&
                        <span className="text-sm text-muted" style={{marginLeft:6}}>{o.direction_other_note}</span>}
                    </td>
                    <td>{svcBadge(o.service_type)}</td>
                    <td style={{maxWidth:200}}>
                      <div className="ellipsis">{o.goods_description || '—'}</div>
                      {o.goods_link &&
                        <a href={o.goods_link} target="_blank" rel="noreferrer"
                          className="text-sm" style={{color:'var(--blue)'}}>
                          🔗 View link
                        </a>}
                    </td>
                    <td className="text-sm text-muted">
                      {o.weight_kg ? `${o.weight_kg} kg` : '—'}
                    </td>
                    <td>
                      {getStage(o.id) !== null
                        ? <span className="badge badge-blue">Stage {getStage(o.id)}</span>
                        : <span className="text-muted text-sm">—</span>}
                    </td>
                  </tr>
                ))}
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

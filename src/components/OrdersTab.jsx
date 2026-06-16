// components/OrdersTab.jsx
import { useState } from 'react';
import OrderForm from './OrderForm';

const DIRECTION_LABELS = { us_jkt: 'US → JKT', jkt_us: 'JKT → US', other: 'Other' };
const SERVICE_LABELS   = { full_service: 'Full Service', shipping_only: 'Shipping Only' };

function directionBadge(d) {
  if (d === 'us_jkt') return <span className="badge badge-blue">US → JKT</span>;
  if (d === 'jkt_us') return <span className="badge badge-amber">JKT → US</span>;
  return <span className="badge badge-gray">Other</span>;
}
function serviceBadge(s) {
  return s === 'full_service'
    ? <span className="badge badge-navy">Full Service</span>
    : <span className="badge badge-gray">Shipping Only</span>;
}

export default function OrdersTab({ orders, tracking, addOrder }) {
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (data) => {
    await addOrder(data);
    setShowForm(false);
  };

  const getStage = (orderId) => {
    const t = tracking.find(t => t.order_id === orderId);
    return t?.current_stage ?? null;
  };

  return (
    <div>
      <div className="flex-between" style={{marginBottom:20}}>
        <div>
          <h2 style={{fontSize:18, fontWeight:700, color:'var(--navy)'}}>Orders</h2>
          <p className="text-muted text-small" style={{marginTop:2}}>{orders.length} active order{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Order</button>
      </div>

      <div className="card">
        {orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
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
                  <th>Stage</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id}>
                    <td className="text-small text-muted">{new Date(order.order_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</td>
                    <td style={{fontWeight:600}}>{order.customer_name}</td>
                    <td>{directionBadge(order.direction)}{order.direction === 'other' && order.direction_other_note ? <span className="text-muted text-small" style={{marginLeft:6}}>{order.direction_other_note}</span> : null}</td>
                    <td>{serviceBadge(order.service_type)}</td>
                    <td style={{maxWidth:200}}>
                      <div style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{order.goods_description || '—'}</div>
                      {order.goods_link && (
                        <a href={order.goods_link} target="_blank" rel="noreferrer" className="text-small" style={{color:'var(--blue)'}}>🔗 View link</a>
                      )}
                    </td>
                    <td>
                      {getStage(order.id) !== null
                        ? <span className="badge badge-blue">Stage {getStage(order.id)}</span>
                        : <span className="text-muted text-small">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && <OrderForm onSubmit={handleSubmit} onClose={() => setShowForm(false)} />}
    </div>
  );
}

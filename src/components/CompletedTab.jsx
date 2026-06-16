// components/CompletedTab.jsx

export default function CompletedTab({ completedOrders }) {
  const daysLeft = (autoDelete) => {
    const diff = new Date(autoDelete) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:18, fontWeight:700, color:'var(--navy)'}}>Completed</h2>
        <p className="text-muted text-small" style={{marginTop:2}}>Records kept for 14 days then automatically deleted</p>
      </div>

      {completedOrders.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">✅</div>
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
                  const o = c.order_snapshot || {};
                  const inv = c.invoice_snapshot || {};
                  const days = daysLeft(c.auto_delete_after);
                  return (
                    <tr key={c.id}>
                      <td className="text-small text-muted">
                        {new Date(c.completed_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                      </td>
                      <td style={{fontWeight:600}}>{o.customer_name || '—'}</td>
                      <td className="text-small">
                        {o.direction === 'us_jkt' ? 'US → JKT' : o.direction === 'jkt_us' ? 'JKT → US' : o.direction_other_note || 'Other'}
                      </td>
                      <td>
                        <span className={`badge ${o.service_type === 'full_service' ? 'badge-navy' : 'badge-gray'}`}>
                          {o.service_type === 'full_service' ? 'Full Service' : 'Shipping Only'}
                        </span>
                      </td>
                      <td className="text-small" style={{maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                        {o.goods_description || '—'}
                      </td>
                      <td style={{fontWeight:600}}>
                        {inv.total != null ? `$${Number(inv.total).toFixed(2)}` : '—'}
                      </td>
                      <td>
                        <span className={`badge ${days <= 3 ? 'badge-amber' : 'badge-gray'}`}>
                          {days}d
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

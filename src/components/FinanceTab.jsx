// components/FinanceTab.jsx — owner only

export default function FinanceTab({ completedOrders }) {
  const records = completedOrders.map(c => ({
    ...c,
    inv: c.invoice_snapshot || {},
    ord: c.order_snapshot  || {},
  }));

  const total    = records.reduce((s, r) => s + Number(r.inv.total || 0), 0);
  const byDir    = {};
  const bySvc    = {};
  const byMonth  = {};

  records.forEach(r => {
    const dir = r.ord.direction || 'other';
    const svc = r.ord.service_type || 'unknown';
    const mon = new Date(r.completed_at).toLocaleString('en-GB', {month:'short', year:'numeric'});
    const amt = Number(r.inv.total || 0);
    byDir[dir]   = (byDir[dir]   || 0) + amt;
    bySvc[svc]   = (bySvc[svc]   || 0) + amt;
    byMonth[mon] = (byMonth[mon] || 0) + amt;
  });

  const DIR_LABELS = { us_jkt:'US → JKT', jkt_us:'JKT → US', other:'Other' };
  const SVC_LABELS = { full_service:'Full Service', shipping_only:'Shipping Only' };

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:18, fontWeight:700, color:'var(--navy)'}}>Finance</h2>
        <p className="text-muted text-small" style={{marginTop:2}}>Revenue from completed orders (last 14 days)</p>
      </div>

      {/* Summary cards */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))', gap:16, marginBottom:24}}>
        {[
          { label:'Total Revenue',     value:`$${total.toFixed(2)}`,      icon:'💰' },
          { label:'Orders Completed',  value:records.length,               icon:'✅' },
          { label:'Avg per Order',     value: records.length ? `$${(total/records.length).toFixed(2)}` : '—', icon:'📊' },
        ].map(s => (
          <div className="card" key={s.label}>
            <div className="card-body" style={{textAlign:'center', padding:'20px 16px'}}>
              <div style={{fontSize:28, marginBottom:8}}>{s.icon}</div>
              <div style={{fontSize:22, fontWeight:700, color:'var(--navy)'}}>{s.value}</div>
              <div className="text-small text-muted" style={{marginTop:4}}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24}}>
        {/* By direction */}
        <div className="card">
          <div className="card-header"><h2>By Direction</h2></div>
          <div className="card-body">
            {Object.keys(byDir).length === 0
              ? <p className="text-muted text-small">No data yet</p>
              : Object.entries(byDir).map(([k,v]) => (
                <div key={k} className="flex-between" style={{padding:'6px 0', borderBottom:'1px solid var(--gray-100)'}}>
                  <span style={{fontSize:13}}>{DIR_LABELS[k] || k}</span>
                  <span style={{fontWeight:600, fontSize:13}}>${v.toFixed(2)}</span>
                </div>
              ))
            }
          </div>
        </div>

        {/* By service */}
        <div className="card">
          <div className="card-header"><h2>By Service Type</h2></div>
          <div className="card-body">
            {Object.keys(bySvc).length === 0
              ? <p className="text-muted text-small">No data yet</p>
              : Object.entries(bySvc).map(([k,v]) => (
                <div key={k} className="flex-between" style={{padding:'6px 0', borderBottom:'1px solid var(--gray-100)'}}>
                  <span style={{fontSize:13}}>{SVC_LABELS[k] || k}</span>
                  <span style={{fontWeight:600, fontSize:13}}>${v.toFixed(2)}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* By month */}
      <div className="card">
        <div className="card-header"><h2>Monthly Revenue</h2></div>
        <div className="card-body">
          {Object.keys(byMonth).length === 0
            ? <p className="text-muted text-small">No completed orders yet</p>
            : Object.entries(byMonth).map(([mon, v]) => (
              <div key={mon} className="flex-between" style={{padding:'8px 0', borderBottom:'1px solid var(--gray-100)'}}>
                <span style={{fontSize:13, fontWeight:500}}>{mon}</span>
                <span style={{fontWeight:700, color:'var(--navy)'}}>${v.toFixed(2)}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

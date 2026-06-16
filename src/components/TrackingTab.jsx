// components/TrackingTab.jsx
import { useState } from 'react';
import { getStageLabel, getStageSequence } from '../lib/data';

export default function TrackingTab({ orders, tracking, carriers, updateTracking, advanceStage }) {
  const [editingId, setEditingId]   = useState(null);
  const [trackingNum, setTrackingNum] = useState('');
  const [carrierId, setCarrierId]   = useState('');
  const [advancing, setAdvancing]   = useState(null);

  const getTracking = (orderId) => tracking.find(t => t.order_id === orderId);
  const getCarrier  = (cid) => carriers.find(c => c.id === cid);

  const buildTrackingUrl = (carrier, number) => {
    if (!carrier || !number) return null;
    return carrier.tracking_url_template.replace('{tracking_number}', encodeURIComponent(number));
  };

  const handleSaveTracking = async (orderId) => {
    await updateTracking(orderId, {
      tracking_number: trackingNum,
      carrier_id: carrierId || null,
    });
    setEditingId(null);
  };

  const handleAdvance = async (order, currentStage) => {
    const seq = getStageSequence(order.service_type);
    const idx = seq.indexOf(currentStage);
    if (idx === -1 || idx === seq.length - 1) return;
    const next = seq[idx + 1];
    setAdvancing(order.id);
    try {
      await advanceStage(order.id, next);
    } finally {
      setAdvancing(null);
    }
  };

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:18, fontWeight:700, color:'var(--navy)'}}>Tracking</h2>
        <p className="text-muted text-small" style={{marginTop:2}}>Update shipment stages and track packages</p>
      </div>

      {orders.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🚚</div>
            <h3>No shipments to track</h3>
            <p>Orders will appear here once created.</p>
          </div>
        </div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          {orders.map(order => {
            const t = getTracking(order.id);
            if (!t) return null;
            const seq      = getStageSequence(order.service_type);
            const stage    = t.current_stage;
            const carrier  = getCarrier(t.carrier_id);
            const trackUrl = buildTrackingUrl(carrier, t.tracking_number);
            const isLast   = seq.indexOf(stage) === seq.length - 1;
            const isEditing = editingId === order.id;

            return (
              <div className="card" key={order.id}>
                <div className="card-header">
                  <div>
                    <span style={{fontWeight:700, color:'var(--navy)'}}>{order.customer_name}</span>
                    <span className="text-muted text-small" style={{marginLeft:10}}>
                      {new Date(order.order_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}
                    </span>
                    <span className="badge badge-gray" style={{marginLeft:8}}>
                      {order.service_type === 'full_service' ? 'Full Service' : 'Shipping Only'}
                    </span>
                  </div>
                  <div className="flex gap-8">
                    {!isLast && (
                      <button className="btn btn-gold btn-sm"
                        disabled={advancing === order.id}
                        onClick={() => handleAdvance(order, stage)}>
                        {advancing === order.id ? '...' : 'Advance Stage →'}
                      </button>
                    )}
                    {isLast && <span className="badge badge-green">✓ Delivered</span>}
                  </div>
                </div>

                <div className="card-body">
                  {/* Stage tracker */}
                  <div className="stage-tracker" style={{marginBottom:20}}>
                    {seq.map((s) => {
                      const isDone   = stage > s;
                      const isActive = stage === s;
                      return (
                        <div key={s} className={`stage-item ${isDone ? 'done' : ''}`}>
                          <div className={`stage-dot ${isDone ? 'done' : isActive ? 'active' : ''}`}>
                            {isDone ? '✓' : s}
                          </div>
                          <div className={`stage-label ${isDone ? 'done' : isActive ? 'active' : ''}`}>
                            {getStageLabel(order.service_type, s)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tracking number row */}
                  {isEditing ? (
                    <div style={{display:'flex', gap:8, alignItems:'flex-end', flexWrap:'wrap'}}>
                      <div style={{flex:1, minWidth:140}}>
                        <div className="form-label" style={{marginBottom:4}}>Carrier</div>
                        <select className="form-select" value={carrierId}
                          onChange={e => setCarrierId(e.target.value)}>
                          <option value="">— Select carrier —</option>
                          {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div style={{flex:2, minWidth:180}}>
                        <div className="form-label" style={{marginBottom:4}}>Tracking Number</div>
                        <input className="form-input" type="text" placeholder="e.g. 1Z999AA10123456784"
                          value={trackingNum} onChange={e => setTrackingNum(e.target.value)} />
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={() => handleSaveTracking(order.id)}>Save</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex-between">
                      <div>
                        {t.tracking_number ? (
                          <div>
                            <span className="text-muted text-small" style={{marginRight:6}}>{carrier?.name || 'Carrier'}:</span>
                            {trackUrl
                              ? <a href={trackUrl} target="_blank" rel="noreferrer" className="tracking-link">{t.tracking_number}</a>
                              : <span className="tracking-link">{t.tracking_number}</span>
                            }
                          </div>
                        ) : (
                          <span className="text-muted text-small">No tracking number yet</span>
                        )}
                      </div>
                      <button className="btn btn-outline btn-sm"
                        onClick={() => {
                          setEditingId(order.id);
                          setTrackingNum(t.tracking_number || '');
                          setCarrierId(t.carrier_id || '');
                        }}>
                        {t.tracking_number ? 'Edit' : '+ Add Tracking'}
                      </button>
                    </div>
                  )}

                  {/* Stage history */}
                  {t.stage_history?.length > 0 && (
                    <div style={{marginTop:16}}>
                      <div className="text-small text-muted" style={{marginBottom:6, fontWeight:600}}>History</div>
                      {[...t.stage_history].reverse().map((h, i) => (
                        <div key={i} className="text-small" style={{display:'flex', gap:12, padding:'4px 0', borderBottom:'1px solid var(--gray-100)'}}>
                          <span className="text-muted">{new Date(h.timestamp).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                          <span>{getStageLabel(order.service_type, h.stage)}</span>
                          {h.note && <span className="text-muted">— {h.note}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

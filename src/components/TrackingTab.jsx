// src/components/TrackingTab.jsx
import { useState } from 'react'
import { Truck, ChevronRight, Check, ExternalLink } from 'lucide-react'
import { getStageLabel, getStageSequence } from '../lib/data'

export default function TrackingTab({ orders, tracking, carriers, updateTracking, advanceStage }) {
  const [editId, setEditId]       = useState(null)
  const [tNum, setTNum]           = useState('')
  const [cId, setCId]             = useState('')
  const [advancing, setAdvancing] = useState(null)

  const getT   = (oid) => tracking.find(t => t.order_id === oid)
  const getCar = (cid) => carriers.find(c => c.id === cid)

  const trackUrl = (carrier, num) => {
    if (!carrier || !num) return null
    return carrier.tracking_url_template.replace('{tracking_number}', encodeURIComponent(num))
  }

  const saveTracking = async (orderId) => {
    await updateTracking(orderId, { tracking_number: tNum || null, carrier_id: cId || null })
    setEditId(null)
  }

  const advance = async (order, stage) => {
    const seq = getStageSequence(order.service_type)
    const idx = seq.indexOf(stage)
    if (idx === -1 || idx === seq.length - 1) return
    setAdvancing(order.id)
    try { await advanceStage(order.id, seq[idx + 1]) }
    finally { setAdvancing(null) }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Tracking</h2>
        <p>Advance shipment stages and manage tracking numbers</p>
      </div>

      {orders.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><Truck size={26} /></div>
            <h3>No shipments to track</h3>
            <p>Orders will appear here once created.</p>
          </div>
        </div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:14}}>
          {orders.map(order => {
            const t       = getT(order.id)
            if (!t) return null
            const seq     = getStageSequence(order.service_type)
            const stage   = t.current_stage
            const carrier = getCar(t.carrier_id)
            const url     = trackUrl(carrier, t.tracking_number)
            const isLast  = seq.indexOf(stage) === seq.length - 1
            const isEdit  = editId === order.id

            return (
              <div className="card" key={order.id}>
                <div className="card-header">
                  <div className="flex-center gap-12">
                    <span className="fw-700 text-navy font-brand" style={{fontSize:15}}>{order.customer_name}</span>
                    <span className="text-sm text-muted">
                      {new Date(order.order_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}
                    </span>
                    <span className={`badge ${order.service_type === 'full_service' ? 'badge-navy' : 'badge-gray'}`}>
                      {order.service_type === 'full_service' ? 'Full Service' : 'Shipping Only'}
                    </span>
                  </div>
                  <div className="flex-center gap-8">
                    {isLast
                      ? <span className="badge badge-green"><Check size={11} style={{marginRight:3}} />Delivered</span>
                      : <button className="btn btn-gold btn-sm" disabled={advancing === order.id}
                          onClick={() => advance(order, stage)}>
                          {advancing === order.id ? '…' : <><ChevronRight size={13} /> Advance Stage</>}
                        </button>
                    }
                  </div>
                </div>

                <div className="card-body">
                  {/* Stage tracker */}
                  <div className="stage-track" style={{marginBottom:22}}>
                    {seq.map(s => {
                      const done   = stage > s
                      const active = stage === s
                      return (
                        <div key={s} className={`stage-item ${done ? 'done' : ''}`}>
                          <div className={`stage-dot ${done ? 'done' : active ? 'active' : ''}`}>
                            {done ? <Check size={10} /> : s}
                          </div>
                          <div className={`stage-lbl ${done ? 'done' : active ? 'active' : ''}`}>
                            {getStageLabel(order.service_type, s)}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Tracking number */}
                  {isEdit ? (
                    <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end'}}>
                      <div style={{flex:1, minWidth:130}}>
                        <div className="form-label" style={{marginBottom:4}}>Carrier</div>
                        <select className="form-select" value={cId} onChange={e => setCId(e.target.value)}>
                          <option value="">— Select —</option>
                          {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div style={{flex:2, minWidth:160}}>
                        <div className="form-label" style={{marginBottom:4}}>Tracking Number</div>
                        <input className="form-input" type="text" placeholder="e.g. 1Z999AA10123456784"
                          value={tNum} onChange={e => setTNum(e.target.value)} />
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={() => saveTracking(order.id)}>Save</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex-between">
                      <div>
                        {t.tracking_number ? (
                          <span className="flex-center gap-6">
                            <span className="text-sm text-muted">{carrier?.name || 'Carrier'}:</span>
                            {url
                              ? <a href={url} target="_blank" rel="noreferrer"
                                  className="tracking-num flex-center gap-6">
                                  {t.tracking_number} <ExternalLink size={11} />
                                </a>
                              : <span className="tracking-num">{t.tracking_number}</span>
                            }
                          </span>
                        ) : (
                          <span className="text-sm text-muted">No tracking number added yet</span>
                        )}
                      </div>
                      <button className="btn btn-outline btn-sm"
                        onClick={() => { setEditId(order.id); setTNum(t.tracking_number || ''); setCId(t.carrier_id || '') }}>
                        {t.tracking_number ? 'Edit' : '+ Add Tracking'}
                      </button>
                    </div>
                  )}

                  {/* History */}
                  {t.stage_history?.length > 1 && (
                    <div style={{marginTop:16}}>
                      <div className="text-sm text-muted fw-700" style={{marginBottom:6}}>Stage History</div>
                      {[...t.stage_history].reverse().map((h, i) => (
                        <div key={i} className="flex-center gap-12 text-sm"
                          style={{padding:'5px 0', borderBottom:'1px solid var(--gray-100)'}}>
                          <span className="text-muted text-mono" style={{minWidth:120}}>
                            {new Date(h.timestamp).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                          </span>
                          <span>{getStageLabel(order.service_type, h.stage)}</span>
                          {h.note && <span className="text-muted">— {h.note}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// src/components/TrackingTab.jsx
// Design: matches JEI Shipments tab — KPI cards, stage filter chips,
// per-card checkpoint timeline, payment segment, 3-leg tracking numbers
import { useState, useMemo } from 'react'
import { Truck, Check, ExternalLink, Plus, Search, Trash2 } from 'lucide-react'
import CompleteButton from './CompleteButton'
import { getStageLabel, getStageSequence, isFinalStage } from '../lib/data'

// Stage filter options — All + each stage label
const STAGE_FILTER_FULL     = ['All', 'Ordered', 'Arrived at warehouse', 'Sent to destination', 'Received at destination', 'Sent to customer', 'Received by customer']
const STAGE_FILTER_LABELS   = {
  1: 'Ordered', 2: 'Arrived at warehouse', 3: 'Sent to destination',
  4: 'Received at destination', 5: 'Sent to customer', 6: 'Received by customer'
}
const PAYMENT_STATES = ['Unpaid', 'Invoiced', 'Paid']

// Inline tracking leg editor
function TrackingLeg({ label, carrier, number, carriers, onSave }) {
  const [editing, setEditing] = useState(false)
  const [num, setNum]         = useState(number || '')
  const [car, setCar]         = useState(carrier || '')

  const save = () => { onSave(car, num); setEditing(false) }

  const trackUrl = () => {
    const c = carriers.find(c => c.name === car)
    if (!c || !num) return null
    return c.tracking_url_template.replace('{tracking_number}', encodeURIComponent(num))
  }
  const url = trackUrl()

  return (
    <div className="tracking-leg">
      <div className="tracking-leg-label">{label}</div>
      {editing ? (
        <div style={{display:'flex', flexDirection:'column', gap:6}}>
          <select className="form-select" value={car} onChange={e => setCar(e.target.value)}>
            <option value="">— Carrier —</option>
            {carriers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <input className="form-input" type="text" placeholder="Tracking number"
            value={num} onChange={e => setNum(e.target.value)} />
          <div className="flex-center gap-6">
            <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
            <button className="btn btn-outline btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="tracking-leg-add" onClick={() => setEditing(true)}>
          {number ? (
            <span className="flex-center gap-6">
              {car && <span className="text-muted text-sm">{car}</span>}
              {url
                ? <a href={url} target="_blank" rel="noreferrer"
                    className="tracking-num flex-center gap-4" onClick={e => e.stopPropagation()}>
                    {number} <ExternalLink size={10} />
                  </a>
                : <span className="tracking-num">{number}</span>
              }
            </span>
          ) : (
            <span className="flex-center gap-6 text-muted text-sm">
              <Plus size={12} /> Add number
            </span>
          )}
        </button>
      )}
    </div>
  )
}

export default function TrackingTab({ orders, tracking, carriers, costs = [], updateTracking, advanceStage, deleteOrder, archiveOrder }) {
  const [stageFilter, setStageFilter] = useState('All')
  const [search, setSearch]           = useState('')
  const [advancing, setAdvancing]     = useState(null)
  const [confirmDel, setConfirmDel]   = useState(null)
  const [deleting, setDeleting]       = useState(false)

  const getT = (oid) => tracking.find(t => t.order_id === oid)

  // KPIs
  const total      = orders.length
  const inTransit  = orders.filter(o => { const t = getT(o.id); return t && !isFinalStage(o, t) }).length
  const delUnpaid  = orders.filter(o => {
    const t = getT(o.id)
    return t && isFinalStage(o, t) && (t.payment || 'Unpaid') === 'Unpaid'
  }).length
  const paid       = orders.filter(o => {
    const t = getT(o.id); return t && (t.payment || '') === 'Paid'
  }).length

  // Stage filter counts
  const stageCounts = useMemo(() => {
    const counts = { All: orders.length }
    orders.forEach(o => {
      const t = getT(o.id)
      if (t) {
        const lbl = STAGE_FILTER_LABELS[t.current_stage]
        if (lbl) counts[lbl] = (counts[lbl] || 0) + 1
      }
    })
    return counts
  }, [orders, tracking])

  // Filtered list
  const filtered = useMemo(() => {
    return orders.filter(o => {
      const t = getT(o.id); if (!t) return false
      const lbl = STAGE_FILTER_LABELS[t.current_stage]
      if (stageFilter !== 'All' && lbl !== stageFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (o.customer_name || '').toLowerCase().includes(q) ||
               (t.tracking_number || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [orders, tracking, stageFilter, search])

  const advance = async (order, stage) => {
    const seq = getStageSequence(order.service_type)
    const idx = seq.indexOf(stage)
    if (idx === -1 || idx === seq.length - 1) return
    setAdvancing(order.id)
    try { await advanceStage(order.id, seq[idx + 1]) }
    finally { setAdvancing(null) }
  }

  // Revert to a previous stage by clicking a done checkpoint
  const revertTo = async (order, targetStage) => {
    const t = tracking.find(tr => tr.order_id === order.id)
    if (!t) return
    // Trim stage_history back to the target stage
    const newHistory = (t.stage_history || []).filter(h => h.stage <= targetStage)
    setAdvancing(order.id)
    try {
      await updateTracking(order.id, {
        current_stage: targetStage,
        stage_history: newHistory,
      })
    } finally { setAdvancing(null) }
  }

  const setPayment = async (orderId, payment) => {
    // no-op: payment tracking removed from this tab
  }

  const handleDelete = async (id) => {
    setDeleting(true)
    try { await deleteOrder(id); setConfirmDel(null) }
    finally { setDeleting(false) }
  }

  const saveLeg = async (orderId, legKey, carKey, carrier, number) => {
    await updateTracking(orderId, { [legKey]: number || null, [carKey]: carrier || null })
  }

  return (
    <div>
      {/* KPI cards — matches JEI Shipments KPIs */}
      <div className="kpi-grid kpi-grid-4">
        <div className="kpi-card">
          <div className="kpi-label">TOTAL SHIPMENTS</div>
          <div className="kpi-value">{total}</div>
          <div className="kpi-sub">with orders</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">IN TRANSIT</div>
          <div className="kpi-value">{inTransit}</div>
          <div className="kpi-sub">not yet delivered</div>
        </div>
        <div className={`kpi-card ${delUnpaid > 0 ? 'kpi-card-warn' : ''}`}>
          <div className="kpi-label">DELIVERED, UNPAID</div>
          <div className={`kpi-value ${delUnpaid > 0 ? 'kpi-value-warn' : ''}`}>{delUnpaid}</div>
          <div className="kpi-sub">money owed</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">PAID</div>
          <div className="kpi-value">{paid}</div>
          <div className="kpi-sub">settled</div>
        </div>
      </div>

      {/* Stage filter chips */}
      <div className="stage-filter-row">
        {STAGE_FILTER_FULL.map(lbl => (
          <button key={lbl}
            className={`stage-filter-chip ${stageFilter === lbl ? 'active' : ''}`}
            onClick={() => setStageFilter(stageFilter === lbl && lbl !== 'All' ? 'All' : lbl)}>
            {lbl}
            <span className="stage-filter-count">{stageCounts[lbl] || 0}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="search-wrap" style={{marginBottom:16, maxWidth:400}}>
        <Search size={15} className="search-icon" />
        <input className="search-input" type="text"
          placeholder="Search shipments…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Shipment cards */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><Truck size={26} /></div>
            <h3>No shipments</h3>
            <p>{search || stageFilter !== 'All' ? 'Try clearing filters.' : 'Orders will appear here once created.'}</p>
          </div>
        </div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          {filtered.map(order => {
            const t      = getT(order.id)
            if (!t) return null
            const seq    = getStageSequence(order.service_type)
            const stage  = t.current_stage
            const isLast = isFinalStage(order, t)
            const pay    = t.payment || 'Unpaid'
            const carrier = carriers.find(c => c.id === t.carrier_id)
            const stageUpdated = t.stage_history?.slice(-1)[0]?.timestamp

            return (
              <div className="card ship-card" key={order.id}>
                {/* Card header */}
                <div className="ship-card-header">
                  <div className="flex-center gap-12">
                    <span className="ship-id">ORD-{order.id?.substring(0,6).toUpperCase()}</span>
                    {carrier && <span className="text-sm text-muted">{carrier.name}</span>}
                    <span className={`pay-badge pay-${pay.toLowerCase()}`}>{pay}</span>
                    {/* 3 status bubbles: tracking / invoice / cost */}
                    {(() => {
                      const costRec = costs.find(c => c.original_order_id === order.id)
                      return (
                        <div className="flex-center gap-4" title="Tracking · Invoice · Cost">
                          <div style={{width:8, height:8, borderRadius:'50%', background: costRec?.tracking_done ? 'var(--green)' : 'var(--gray-200)'}} />
                          <div style={{width:8, height:8, borderRadius:'50%', background: costRec?.invoice_done ? 'var(--green)' : 'var(--gray-200)'}} />
                          <div style={{width:8, height:8, borderRadius:'50%', background: costRec?.cost_done ? 'var(--green)' : 'var(--gray-200)'}} />
                        </div>
                      )
                    })()}
                  </div>
                  <div className="flex-center gap-12">
                    <span className="text-sm text-muted">1 order: {order.customer_name}</span>
                    {stageUpdated && (
                      <span className="text-sm text-muted">
                        Stage updated {new Date(stageUpdated).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                      </span>
                    )}
                    <button className="btn-ghost btn-sm" title="Delete order" style={{color:'var(--red)'}}
                      onClick={e => { e.stopPropagation(); setConfirmDel(order.id) }}>
                      <Trash2 size={14} />
                    </button>
                    <CompleteButton orderId={order.id} costs={costs} archiveOrder={archiveOrder} />
                  </div>
                </div>

                <div className="ship-card-body">
                  {/* Checkpoint timeline — click done to revert, click future to advance */}
                  <div className="checkpoint-row">
                    {seq.map(s => {
                      const done   = stage > s
                      const active = stage === s
                      return (
                        <button key={s}
                          className={`checkpoint ${done ? 'cp-done' : active ? 'cp-active' : 'cp-future'}`}
                          disabled={advancing === order.id}
                          title={done ? 'Click to revert to this stage' : active ? 'Current stage' : 'Click to advance here'}
                          onClick={() => {
                            if (done) revertTo(order, s)
                            else if (!active) advance(order, stage)
                          }}>
                          {done && <Check size={11} style={{marginRight:4}} />}
                          {getStageLabel(order.service_type, s)}
                        </button>
                      )
                    })}
                  </div>

                  {/* Tracking legs — 3 legs */}
                  <div className="tracking-legs-row">
                    <div className="tracking-legs-label text-sm text-muted">
                      🚚 Tracking
                    </div>
                    <div className="tracking-legs-grid">
                      <TrackingLeg
                        label="US → SG"
                        carrier={t.track_us_sg_carrier}
                        number={t.track_us_sg}
                        carriers={carriers}
                        onSave={(car, num) => saveLeg(order.id, 'track_us_sg', 'track_us_sg_carrier', car, num)}
                      />
                      <TrackingLeg
                        label="SG → ID"
                        carrier={t.track_sg_id_carrier}
                        number={t.track_sg_id}
                        carriers={carriers}
                        onSave={(car, num) => saveLeg(order.id, 'track_sg_id', 'track_sg_id_carrier', car, num)}
                      />
                      <TrackingLeg
                        label="ID → Customer"
                        carrier={t.track_id_cust_carrier}
                        number={t.track_id_cust}
                        carriers={carriers}
                        onSave={(car, num) => saveLeg(order.id, 'track_id_cust', 'track_id_cust_carrier', car, num)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="overlay">
          <div className="confirm-modal">
            <h3>Delete this order?</h3>
            <p>This will permanently remove the order from all tabs (Orders, Invoice, Cost). <strong>This cannot be undone.</strong></p>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleting} onClick={() => handleDelete(confirmDel)}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

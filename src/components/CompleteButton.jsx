// src/components/CompleteButton.jsx
// Shows a "Move to Completed" button when all 3 criteria are done.
// Used in Orders, Tracking, Invoice, and Cost tabs.
import { useState } from 'react'
import { CheckCircle } from 'lucide-react'

export function allDone(costRec) {
  return !!(costRec?.tracking_done && costRec?.invoice_done && costRec?.cost_done)
}

export default function CompleteButton({ orderId, costs, archiveOrder, size = 'sm' }) {
  const [busy, setBusy]           = useState(false)
  const [confirm, setConfirm]     = useState(false)
  const [error, setError]         = useState(null)

  const costRec = costs?.find(c => c.original_order_id === orderId)
  if (!allDone(costRec)) return null

  const handleClick = async (e) => {
    e.stopPropagation()
    if (!confirm) { setConfirm(true); return }
    setBusy(true); setError(null)
    try {
      await archiveOrder(orderId)
    } catch (err) {
      console.error('Archive failed:', err)
      setError(err.message || 'Failed to complete')
      setBusy(false)
      setConfirm(false)
    }
  }

  return (
    <span onClick={e => e.stopPropagation()}>
      {error && <span style={{color:'var(--red)', fontSize:11, marginRight:6}}>{error}</span>}
      <button
        disabled={busy}
        onClick={handleClick}
        className={`btn btn-green ${size === 'sm' ? 'btn-sm' : ''}`}
        style={{whiteSpace:'nowrap'}}
        title="All 3 criteria met — click to move to Completed tab">
        <CheckCircle size={13} />
        {busy ? 'Moving…' : confirm ? 'Confirm?' : '✓ Move to Completed'}
      </button>
      {confirm && !busy && (
        <button
          className="btn btn-outline btn-sm"
          style={{marginLeft:6}}
          onClick={e => { e.stopPropagation(); setConfirm(false) }}>
          Cancel
        </button>
      )}
    </span>
  )
}

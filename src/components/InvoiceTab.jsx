// components/InvoiceTab.jsx
import { useState } from 'react';
import { getStageSequence } from '../lib/data';
import { generateInvoicePDF } from '../lib/pdf';

export default function InvoiceTab({ orders, tracking, invoices, addAdditionalCost, upsertInvoice, completeOrder }) {
  const [confirmId, setConfirmId]   = useState(null);
  const [costDesc, setCostDesc]     = useState('');
  const [costAmt, setCostAmt]       = useState('');
  const [addingCostId, setAddingCostId] = useState(null);
  const [completing, setCompleting] = useState(false);

  // Only show orders where current stage is the final stage
  const invoiceReady = orders.filter(order => {
    const t = tracking.find(t => t.order_id === order.id);
    if (!t) return false;
    const seq = getStageSequence(order.service_type);
    return t.current_stage === seq[seq.length - 1];
  });

  const getInvoice = (orderId) => invoices.find(inv => inv.order_id === orderId);

  const handleAddCost = async (orderId) => {
    if (!costDesc.trim() || !costAmt) return;
    await addAdditionalCost(orderId, costDesc.trim(), parseFloat(costAmt));
    setCostDesc(''); setCostAmt(''); setAddingCostId(null);
  };

  const handleComplete = async (orderId) => {
    setCompleting(true);
    try {
      await completeOrder(orderId);
      setConfirmId(null);
    } finally {
      setCompleting(false);
    }
  };

  const handlePrint = (order) => {
    const invoice = getInvoice(order.id);
    generateInvoicePDF(order, invoice);
  };

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:18, fontWeight:700, color:'var(--navy)'}}>Invoices</h2>
        <p className="text-muted text-small" style={{marginTop:2}}>Appears once package is received by customer</p>
      </div>

      {invoiceReady.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🧾</div>
            <h3>No invoices ready</h3>
            <p>Invoices appear once a package reaches the final delivery stage.</p>
          </div>
        </div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          {invoiceReady.map(order => {
            const invoice = getInvoice(order.id);
            const extraCosts = invoice?.additional_costs || [];
            const base  = invoice?.base_price || 0;
            const extra = extraCosts.reduce((s, c) => s + Number(c.amount), 0);
            const total = base + extra;

            return (
              <div className="card" key={order.id}>
                <div className="card-header">
                  <div>
                    <span style={{fontWeight:700, color:'var(--navy)'}}>{order.customer_name}</span>
                    <span className="text-muted text-small" style={{marginLeft:10}}>
                      {new Date(order.order_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                    </span>
                  </div>
                  <div className="flex gap-8">
                    <button className="btn btn-outline btn-sm" onClick={() => handlePrint(order)}>🖨 Print</button>
                    <button className="btn btn-green btn-sm" onClick={() => setConfirmId(order.id)}>✓ Complete</button>
                  </div>
                </div>

                <div className="card-body">
                  {/* Order summary */}
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16}}>
                    {[
                      ['Direction', order.direction === 'us_jkt' ? 'US → JKT' : order.direction === 'jkt_us' ? 'JKT → US' : order.direction_other_note || 'Other'],
                      ['Service',   order.service_type === 'full_service' ? 'Full Service' : 'Shipping Only'],
                      ['Goods',     order.goods_description || '—'],
                      ['Weight',    order.weight_kg ? `${order.weight_kg} kg` : '—'],
                    ].map(([k,v]) => (
                      <div key={k}>
                        <div className="text-small text-muted" style={{marginBottom:2}}>{k}</div>
                        <div style={{fontSize:13, fontWeight:500}}>{v}</div>
                      </div>
                    ))}
                  </div>

                  <hr className="divider" />

                  {/* Cost breakdown */}
                  <div style={{marginBottom:12}}>
                    <div className="flex-between text-small" style={{padding:'6px 0'}}>
                      <span>Base price</span>
                      <span>${base.toFixed(2)}</span>
                    </div>
                    {extraCosts.map((c, i) => (
                      <div key={i} className="flex-between text-small" style={{padding:'4px 0', color:'var(--gray-600)'}}>
                        <span>{c.description}</span>
                        <span>+${Number(c.amount).toFixed(2)}</span>
                      </div>
                    ))}
                    <hr className="divider" />
                    <div className="flex-between" style={{fontWeight:700, fontSize:15, color:'var(--navy)'}}>
                      <span>Total</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Additional cost input */}
                  {addingCostId === order.id ? (
                    <div style={{background:'var(--off-white)', borderRadius:'var(--radius)', padding:12, marginTop:8}}>
                      <div className="form-label" style={{marginBottom:8}}>Add Additional Cost</div>
                      <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                        <input className="form-input" style={{flex:2, minWidth:140}} type="text"
                          placeholder="Description (e.g. customs fee)"
                          value={costDesc} onChange={e => setCostDesc(e.target.value)} />
                        <input className="form-input" style={{flex:1, minWidth:80}} type="number" min="0" step="0.01"
                          placeholder="Amount"
                          value={costAmt} onChange={e => setCostAmt(e.target.value)} />
                        <button className="btn btn-primary btn-sm" onClick={() => handleAddCost(order.id)}>Add</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setAddingCostId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn btn-outline btn-sm" onClick={() => setAddingCostId(order.id)}>
                      + Additional Cost
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm complete modal */}
      {confirmId && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Mark as Complete?</h3>
            <p>
              This will move the order, tracking, and invoice to <strong>Completed</strong> and
              remove them from all active tabs. This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setConfirmId(null)}>Cancel</button>
              <button className="btn btn-green" disabled={completing}
                onClick={() => handleComplete(confirmId)}>
                {completing ? 'Processing...' : 'Yes, Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

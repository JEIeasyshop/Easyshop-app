// src/components/CustomersTab.jsx
// Stores customer profiles used for autofilling new orders.
// All fields match what OrderForm step 1 collects.
import { useState, useMemo } from 'react'
import { Users, Plus, Pencil, Trash2, X, Check, Search } from 'lucide-react'

function CustomerForm({ initial = {}, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    name:           initial.name           || '',
    contact_number: initial.contact_number || '',
    address:        initial.address        || '',
    notes:          initial.notes          || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="customer-form-inline">
      <div className="form-row">
        <div className="form-group" style={{marginBottom:0}}>
          <label className="form-label">Customer Name</label>
          <input className="form-input" type="text" placeholder="Full name"
            value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
        </div>
        <div className="form-group" style={{marginBottom:0}}>
          <label className="form-label">Contact Number <span className="optional">(optional)</span></label>
          <input className="form-input" type="tel" placeholder="+62 812 3456 7890"
            value={form.contact_number} onChange={e => set('contact_number', e.target.value)} />
        </div>
      </div>
      <div className="form-group mt-12" style={{marginBottom:0}}>
        <label className="form-label">Delivery Address <span className="optional">(optional)</span></label>
        <textarea className="form-textarea" style={{minHeight:64}}
          placeholder="Street, city, postal code…"
          value={form.address} onChange={e => set('address', e.target.value)} />
      </div>
      <div className="form-group mt-12" style={{marginBottom:0}}>
        <label className="form-label">Notes <span className="optional">(optional)</span></label>
        <input className="form-input" type="text" placeholder="Any special notes about this customer…"
          value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex-center gap-8 mt-12" style={{justifyContent:'flex-end'}}>
        <button className="btn btn-outline btn-sm" onClick={onCancel}>
          <X size={13} /> Cancel
        </button>
        <button className="btn btn-primary btn-sm" disabled={saving || !form.name.trim()}
          onClick={() => onSave(form)}>
          {saving ? '…' : <><Check size={13} /> Save</>}
        </button>
      </div>
    </div>
  )
}

export default function CustomersTab({ customers, orders, completedOrders, addCustomer, updateCustomer, deleteCustomer }) {
  const [showAdd, setShowAdd]     = useState(false)
  const [editId, setEditId]       = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [search, setSearch]       = useState('')

  // Count orders per customer name (active + completed)
  const orderCounts = useMemo(() => {
    const counts = {}
    orders.forEach(o => {
      const n = (o.customer_name || '').trim().toLowerCase()
      if (n) counts[n] = (counts[n] || 0) + 1
    })
    completedOrders.forEach(c => {
      const n = ((c.order_snapshot?.customer_name) || '').trim().toLowerCase()
      if (n) counts[n] = (counts[n] || 0) + 1
    })
    return counts
  }, [orders, completedOrders])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return customers
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.contact_number || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q)
    )
  }, [customers, search])

  const handleAdd = async (form) => {
    setSaving(true)
    try { await addCustomer(form); setShowAdd(false) }
    finally { setSaving(false) }
  }

  const handleEdit = async (form) => {
    setSaving(true)
    try { await updateCustomer(editId, form); setEditId(null) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    setSaving(true)
    try { await deleteCustomer(id); setConfirmDel(null) }
    finally { setSaving(false) }
  }

  return (
    <div>
      {/* Header row */}
      <div className="page-header-row">
        <div className="page-header" style={{marginBottom:0}}>
          <h2>Customers</h2>
          <p>{customers.length} customer{customers.length !== 1 ? 's' : ''} · used to autofill new orders</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowAdd(true); setEditId(null) }}>
          <Plus size={15} /> Add Customer
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card mt-16" style={{border:'1.5px solid var(--navy)'}}>
          <div className="card-header">
            <h3>New Customer</h3>
          </div>
          <div className="card-body">
            <CustomerForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saving={saving} />
          </div>
        </div>
      )}

      {/* Search */}
      <div className="search-wrap mt-16" style={{maxWidth:380, marginBottom:14}}>
        <Search size={15} className="search-icon" />
        <input className="search-input" type="text"
          placeholder="Search customers…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* KPI row */}
      <div className="kpi-grid" style={{marginBottom:16}}>
        <div className="kpi-card">
          <div className="kpi-label">Total Customers</div>
          <div className="kpi-value">{customers.length}</div>
          <div className="kpi-sub">in address book</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">With Active Orders</div>
          <div className="kpi-value">
            {customers.filter(c => orderCounts[(c.name || '').toLowerCase()] > 0).length}
          </div>
          <div className="kpi-sub">currently shipping</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Returning</div>
          <div className="kpi-value">
            {customers.filter(c => (orderCounts[(c.name || '').toLowerCase()] || 0) > 1).length}
          </div>
          <div className="kpi-sub">2+ orders</div>
        </div>
      </div>

      {/* Customer list */}
      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Users size={26} /></div>
            <h3>{search ? 'No results' : 'No customers yet'}</h3>
            <p>{search ? 'Try a different search.' : 'Add your first customer to enable autofill in orders.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Address</th>
                  <th>Orders</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const count = orderCounts[(c.name || '').toLowerCase()] || 0
                  return <>
                    <tr key={c.id}>
                      <td style={{fontWeight:700}}>{c.name}</td>
                      <td className="text-sm">{c.contact_number || <span className="text-muted">—</span>}</td>
                      <td className="text-sm" style={{maxWidth:200}}>
                        <div className="ellipsis">{c.address || <span className="text-muted">—</span>}</div>
                      </td>
                      <td>
                        {count > 0
                          ? <span className={`badge ${count > 1 ? 'badge-gold' : 'badge-blue'}`}>
                              {count} order{count !== 1 ? 's' : ''}
                            </span>
                          : <span className="badge badge-gray">0 orders</span>
                        }
                      </td>
                      <td className="text-sm text-muted">{c.notes || '—'}</td>
                      <td>
                        <div className="flex-center gap-6">
                          <button className="btn-ghost btn-sm"
                            onClick={() => { setEditId(editId === c.id ? null : c.id); setShowAdd(false) }}
                            title="Edit">
                            <Pencil size={13} />
                          </button>
                          <button className="btn-ghost btn-sm"
                            style={{color:'var(--red)'}}
                            onClick={() => setConfirmDel(c.id)}
                            title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Inline edit row */}
                    {editId === c.id && (
                      <tr key={c.id + '-edit'}>
                        <td colSpan={6} style={{background:'var(--gray-50)', padding:'16px 20px'}}>
                          <CustomerForm
                            initial={c}
                            onSave={handleEdit}
                            onCancel={() => setEditId(null)}
                            saving={saving}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm delete */}
      {confirmDel && (
        <div className="overlay">
          <div className="confirm-modal">
            <h3>Delete Customer?</h3>
            <p>This only removes them from the address book — it does not affect any existing orders.</p>
            <div className="confirm-actions">
              <button className="btn btn-outline" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={saving}
                onClick={() => handleDelete(confirmDel)}>
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

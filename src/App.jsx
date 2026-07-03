// src/App.jsx
import { useState, useEffect } from 'react'
import { Package, Truck, FileText, Receipt, Archive, Users, DollarSign } from 'lucide-react'
import { getSession, onAuthStateChange, signOut, getUserRole } from './lib/auth'
import { useAppData } from './lib/data'
import { useKeepAlive, useLiveTicker } from './lib/supabaseClient'
import Login          from './components/Login'
import ErrorBoundary  from './components/ErrorBoundary'
import OrdersTab      from './components/OrdersTab'
import TrackingTab    from './components/TrackingTab'
import InvoiceTab     from './components/InvoiceTab'
import CostTab        from './components/CostTab'
import CompletedTab   from './components/CompletedTab'
import CustomersTab   from './components/CustomersTab'
import FinanceTab     from './components/FinanceTab'

const ALL_TABS = [
  { id: 'orders',    label: 'Orders',    Icon: Package,    ownerOnly: false },
  { id: 'tracking',  label: 'Tracking',  Icon: Truck,      ownerOnly: false },
  { id: 'invoices',  label: 'Invoices',  Icon: FileText,   ownerOnly: false },
  { id: 'cost',      label: 'Cost',      Icon: Receipt,    ownerOnly: false },
  { id: 'completed', label: 'Completed', Icon: Archive,    ownerOnly: false },
  { id: 'customers', label: 'Customers', Icon: Users,      ownerOnly: false },
  { id: 'finance',   label: 'Finance',   Icon: DollarSign, ownerOnly: true  },
]

function Dashboard({ session, role }) {
  const [tab, setTab] = useState('orders')

  // Keep Supabase alive (ping every 4 days)
  useKeepAlive()

  const {
    orders, tracking, invoices, completedOrders, carriers, customers, costs,
    loading, error,
    addOrder, updateOrder, deleteOrder,
    updateTracking, advanceStage,
    upsertInvoice, addInvoiceCost, removeInvoiceCost, lockInvoiceTotal,
    completeOrder,
    addCostLine, removeCostLine, updateCostNotes, setDoneFlag, completeCost, manualArchive, archiveOrder,
    revertCompleted, deleteCompleted, cleanupExpired,
    addCustomer, updateCustomer, deleteCustomer,
  } = useAppData()

  // Live ticker — must be after useAppData so orders is defined
  const { timeStr, dateStr, orderCount } = useLiveTicker(orders || [])

  useEffect(() => { cleanupExpired() }, []) // eslint-disable-line

  const tabs = ALL_TABS.filter(t => !t.ownerOnly || role === 'owner')

  if (loading) return <div className="loading-screen">Loading…</div>
  if (error) return (
    <div className="error-boundary" style={{margin:24}}>
      <strong>Failed to load data.</strong>
      <pre>{error.message}</pre>
    </div>
  )

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <img src="/logo.png" alt="JEI" className="header-logo-img" />
          <div className="header-brand-text">
            <h1>Jon Express <span>International</span></h1>
            <p>Jastip</p>
          </div>
        </div>
        <div className="header-right">
          {/* Live activity ticker */}
          <div style={{
            display:'flex', alignItems:'center', gap:8,
            padding:'4px 12px', borderRadius:20,
            background:'rgba(255,255,255,0.08)',
            border:'1px solid rgba(255,255,255,0.12)',
          }}>
            {/* Pulsing green dot */}
            <span style={{
              width:7, height:7, borderRadius:'50%',
              background:'#4ade80',
              boxShadow:'0 0 0 0 rgba(74,222,128,0.6)',
              animation:'pulse-dot 2s infinite',
              flexShrink:0,
            }} />
            <span style={{fontSize:11, color:'rgba(255,255,255,0.55)', fontFamily:'var(--font-mono)', letterSpacing:'0.03em'}}>
              {dateStr}
            </span>
            <span style={{fontSize:12, color:'rgba(255,255,255,0.9)', fontFamily:'var(--font-mono)', fontWeight:600, letterSpacing:'0.05em'}}>
              {timeStr}
            </span>
            <span style={{fontSize:11, color:'rgba(255,255,255,0.45)', marginLeft:2}}>
              · {orderCount} orders
            </span>
          </div>
          <span className="header-user">{session.user.email}</span>
          <span className="header-role">{role}</span>
          <button className="btn-signout" onClick={() => signOut()}>Sign Out</button>
        </div>
      </header>

      <nav className="tab-nav">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id}
            className={`tab-btn ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}>
            <span className="tab-icon"><Icon size={14} /></span>
            {label}
          </button>
        ))}
      </nav>

      <main className="tab-content">
        <ErrorBoundary>
          {tab === 'orders' && (
            <OrdersTab
              orders={orders} tracking={tracking} costs={costs}
              addOrder={addOrder} updateOrder={updateOrder} deleteOrder={deleteOrder}
              customers={customers} addCustomer={addCustomer}
              archiveOrder={archiveOrder}
            />
          )}
          {tab === 'tracking' && (
            <TrackingTab
              orders={orders} tracking={tracking} carriers={carriers} costs={costs}
              updateTracking={updateTracking} advanceStage={advanceStage}
              deleteOrder={deleteOrder} archiveOrder={archiveOrder}
            />
          )}
          {tab === 'invoices' && (
            <InvoiceTab
              orders={orders} tracking={tracking} invoices={invoices} costs={costs}
              addInvoiceCost={addInvoiceCost} removeInvoiceCost={removeInvoiceCost}
              lockInvoiceTotal={lockInvoiceTotal} completeOrder={completeOrder}
              updateTracking={updateTracking} setDoneFlag={setDoneFlag}
              deleteOrder={deleteOrder} archiveOrder={archiveOrder}
            />
          )}
          {tab === 'cost' && (
            <CostTab
              costs={costs}
              addCostLine={addCostLine} removeCostLine={removeCostLine}
              updateCostNotes={updateCostNotes} setDoneFlag={setDoneFlag}
              completeCost={completeCost} manualArchive={manualArchive}
              deleteOrder={deleteOrder}
            />
          )}
          {tab === 'completed' && (
            <CompletedTab
              completedOrders={completedOrders}
              revertCompleted={revertCompleted}
              deleteCompleted={deleteCompleted}
            />
          )}
          {tab === 'customers' && (
            <CustomersTab
              customers={customers} orders={orders}
              completedOrders={completedOrders}
              addCustomer={addCustomer}
              updateCustomer={updateCustomer}
              deleteCustomer={deleteCustomer}
            />
          )}
          {tab === 'finance' && role === 'owner' && (
            <FinanceTab completedOrders={completedOrders} />
          )}
        </ErrorBoundary>
      </main>
    </div>
  )
}

export default function App() {
  const [session, setSession]   = useState(null)
  const [role, setRole]         = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    getSession().then(s => {
      setSession(s); setRole(getUserRole(s)); setChecking(false)
    })
    return onAuthStateChange(s => { setSession(s); setRole(getUserRole(s)) })
  }, [])

  if (checking) return <div className="loading-screen">Loading…</div>
  if (!session) return <Login onLogin={s => { setSession(s); setRole(getUserRole(s)) }} />
  return <Dashboard session={session} role={role} />
}

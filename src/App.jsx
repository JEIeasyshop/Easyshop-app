// src/App.jsx
import { useState, useEffect } from 'react'
import { Package, Truck, FileText, Archive, DollarSign, Users } from 'lucide-react'
import { getSession, onAuthStateChange, signOut, getUserRole } from './lib/auth'
import { useAppData } from './lib/data'
import Login          from './components/Login'
import ErrorBoundary  from './components/ErrorBoundary'
import OrdersTab      from './components/OrdersTab'
import TrackingTab    from './components/TrackingTab'
import InvoiceTab     from './components/InvoiceTab'
import CompletedTab   from './components/CompletedTab'
import CustomersTab   from './components/CustomersTab'
import FinanceTab     from './components/FinanceTab'

const ALL_TABS = [
  { id: 'orders',    label: 'Orders',    Icon: Package,    ownerOnly: false },
  { id: 'tracking',  label: 'Tracking',  Icon: Truck,      ownerOnly: false },
  { id: 'invoices',  label: 'Invoices',  Icon: FileText,   ownerOnly: false },
  { id: 'completed', label: 'Completed', Icon: Archive,    ownerOnly: false },
  { id: 'customers', label: 'Customers', Icon: Users,      ownerOnly: false },
  { id: 'finance',   label: 'Finance',   Icon: DollarSign, ownerOnly: true  },
]

function Dashboard({ session, role }) {
  const [tab, setTab] = useState('orders')

  const {
    orders, tracking, invoices, completedOrders, carriers, customers,
    loading, error,
    addOrder, updateOrder,
    updateTracking, advanceStage,
    upsertInvoice, addInvoiceCost, lockInvoiceTotal,
    completeOrder, revertCompleted, deleteCompleted, cleanupExpired,
    addCustomer, updateCustomer, deleteCustomer,
  } = useAppData()

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
            <p>Freight Management</p>
          </div>
        </div>
        <div className="header-right">
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
              orders={orders} tracking={tracking}
              addOrder={addOrder} customers={customers}
            />
          )}
          {tab === 'tracking' && (
            <TrackingTab
              orders={orders} tracking={tracking} carriers={carriers}
              updateTracking={updateTracking} advanceStage={advanceStage}
            />
          )}
          {tab === 'invoices' && (
            <InvoiceTab
              orders={orders} tracking={tracking} invoices={invoices}
              addInvoiceCost={addInvoiceCost} lockInvoiceTotal={lockInvoiceTotal}
              completeOrder={completeOrder}
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
            <FinanceTab
              completedOrders={completedOrders}
              orders={orders}
            />
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

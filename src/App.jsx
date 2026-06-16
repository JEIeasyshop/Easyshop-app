// App.jsx
import { useState, useEffect } from 'react';
import './App.css';
import { getSession, onAuthStateChange, signOut, getUserRole } from './lib/auth';
import { useAppData } from './lib/data';
import Login           from './components/Login';
import ErrorBoundary   from './components/ErrorBoundary';
import OrdersTab       from './components/OrdersTab';
import TrackingTab     from './components/TrackingTab';
import InvoiceTab      from './components/InvoiceTab';
import CompletedTab    from './components/CompletedTab';
import FinanceTab      from './components/FinanceTab';

const TABS = [
  { id: 'orders',    label: '📦 Orders' },
  { id: 'tracking',  label: '🚚 Tracking' },
  { id: 'invoices',  label: '🧾 Invoices' },
  { id: 'completed', label: '✅ Completed' },
  { id: 'finance',   label: '💰 Finance', ownerOnly: true },
];

function Dashboard({ session, role }) {
  const [tab, setTab] = useState('orders');
  const {
    orders, tracking, invoices, completedOrders, carriers,
    loading, error, reload,
    addOrder, updateTracking, advanceStage,
    upsertInvoice, addAdditionalCost, completeOrder,
  } = useAppData();

  const visibleTabs = TABS.filter(t => !t.ownerOnly || role === 'owner');

  if (loading) return <div className="loading-screen">Loading data...</div>;
  if (error)   return <div className="error-boundary"><strong>Failed to load:</strong> {error.message}</div>;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <div>
            <h1>JE <span>Easyshop</span></h1>
            <div className="tagline">Freight Management</div>
          </div>
        </div>
        <div className="header-right">
          <span className="header-user">{session.user.email}</span>
          <span className="header-role">{role}</span>
          <button className="btn-signout" onClick={() => signOut()}>Sign Out</button>
        </div>
      </header>

      <nav className="tab-nav">
        {visibleTabs.map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="tab-content">
        <ErrorBoundary>
          {tab === 'orders'    && <OrdersTab   orders={orders} tracking={tracking} addOrder={addOrder} />}
          {tab === 'tracking'  && <TrackingTab orders={orders} tracking={tracking} carriers={carriers} updateTracking={updateTracking} advanceStage={advanceStage} />}
          {tab === 'invoices'  && <InvoiceTab  orders={orders} tracking={tracking} invoices={invoices} addAdditionalCost={addAdditionalCost} upsertInvoice={upsertInvoice} completeOrder={completeOrder} />}
          {tab === 'completed' && <CompletedTab completedOrders={completedOrders} />}
          {tab === 'finance'   && role === 'owner' && <FinanceTab completedOrders={completedOrders} />}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default function App() {
  const [session, setSession]               = useState(null);
  const [role, setRole]                     = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    getSession().then(s => {
      setSession(s);
      setRole(getUserRole(s));
      setCheckingSession(false);
    });
    const unsub = onAuthStateChange(s => {
      setSession(s);
      setRole(getUserRole(s));
    });
    return unsub;
  }, []);

  if (checkingSession) return <div className="loading-screen">Loading...</div>;
  if (!session) return <Login onLogin={s => { setSession(s); setRole(getUserRole(s)); }} />;
  return <Dashboard session={session} role={role} />;
}

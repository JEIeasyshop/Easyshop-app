// App.jsx (skeleton — wire into your existing app structure)
import { useState, useEffect } from 'react';
import { getSession, onAuthStateChange, signOut, getUserRole } from './lib/auth';
import Login from './components/Login';
// import Dashboard from './components/Dashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setRole(getUserRole(s));
      setCheckingSession(false);
    });

    const unsubscribe = onAuthStateChange((s) => {
      setSession(s);
      setRole(getUserRole(s));
    });
    return unsubscribe;
  }, []);

  if (checkingSession) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!session) {
    return <Login onLogin={(s) => { setSession(s); setRole(getUserRole(s)); }} />;
  }

  return (
    <div className="app">
      <header>
        <span>Signed in as {session.user.email} ({role})</span>
        <button onClick={() => signOut()}>Sign Out</button>
      </header>
      {/* Pass role into Dashboard so it can hide Finance tab for admin */}
      {/* <Dashboard role={role} /> */}
      <p>Logged in. Role: {role}. Replace this with your tabbed Dashboard.</p>
    </div>
  );
}

// App.jsx (skeleton — wire into your existing app structure)
import { useState, useEffect } from 'react';
import { getSession, onAuthStateChange, signOut } from './lib/auth';
import Login from './components/Login';
// import Dashboard from './components/Dashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setCheckingSession(false);
    });

    const unsubscribe = onAuthStateChange((s) => setSession(s));
    return unsubscribe;
  }, []);

  if (checkingSession) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!session) {
    return <Login onLogin={setSession} />;
  }

  return (
    <div className="app">
      <header>
        <span>Signed in as {session.user.email}</span>
        <button onClick={() => signOut()}>Sign Out</button>
      </header>
      {/* <Dashboard /> */}
      <p>Replace this with your tabbed Dashboard component.</p>
    </div>
  );
}

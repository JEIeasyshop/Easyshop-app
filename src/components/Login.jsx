// src/components/Login.jsx
import { useState } from 'react'
import { signIn } from '../lib/auth'

export default function Login({ onLogin }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const session = await signIn(email, password)
      onLogin(session)
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo.png" alt="JEI Logo" className="login-logo-img" />
          <h1>Jon Express <span>International</span></h1>
          <p>Jastip</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label>Email</label>
            <input type="email" value={email} placeholder="you@company.com"
              onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input type="password" value={password} placeholder="••••••••"
              onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

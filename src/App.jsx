import { useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext.jsx'
import { Admin } from './pages/Admin.jsx'

function LoginForm() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setBusy(true)
    try { await signIn(email, password) }
    catch (err) { setError(err.message || 'লগইন ব্যর্থ') }
    finally { setBusy(false) }
  }

  return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
      <form onSubmit={submit} className="card" style={{width:'100%', maxWidth:380, padding:28}}>
        <h2 style={{marginBottom:6}}>🛠️ CashSkillBD Admin</h2>
        <p style={{color:'var(--muted)', marginBottom:20, fontSize:'.9rem'}}>ম্যানেজমেন্ট প্যানেলে লগইন করুন</p>
        {error && <p style={{color:'#ff7d7d', marginBottom:12}}>{error}</p>}
        <input type="email" placeholder="ইমেইল" value={email} onChange={e=>setEmail(e.target.value)}
          required style={{width:'100%', marginBottom:10}} />
        <input type="password" placeholder="পাসওয়ার্ড" value={password} onChange={e=>setPassword(e.target.value)}
          required style={{width:'100%', marginBottom:16}} />
        <button className="btn btn-block" disabled={busy}>{busy ? '...' : 'লগইন'}</button>
      </form>
    </div>
  )
}

function Shell() {
  const { session, loading, signOut } = useAuth()
  if (loading) return <p className="center" style={{padding:60}}>লোড হচ্ছে…</p>
  if (!session) return <LoginForm />
  return (
    <div>
      <div style={{display:'flex', justifyContent:'flex-end', padding:'10px 16px'}}>
        <button className="btn btn-sm btn-ghost" onClick={signOut}>লগআউট</button>
      </div>
      <Admin />
    </div>
  )
}

export default function App() {
  return <AuthProvider><Shell /></AuthProvider>
}

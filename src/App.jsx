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
      <form onSubmit={submit} className="card" style={{width:'100%', maxWidth:400, padding:32}}>
        <div className="center" style={{marginBottom:20}}>
          <div style={{fontSize:'2.6rem', marginBottom:8}}>🛠️</div>
          <h2 style={{marginBottom:6}}>CashSkillBD Admin</h2>
          <p style={{color:'var(--muted)', fontSize:'.92rem'}}>ম্যানেজমেন্ট প্যানেলে লগইন করুন</p>
        </div>
        {error && <p style={{color:'#ff7d7d', marginBottom:12, textAlign:'center'}}>{error}</p>}
        <label className="f-label">ইমেইল</label>
        <input className="inp" type="email" placeholder="admin@example.com" value={email} onChange={e=>setEmail(e.target.value)} required />
        <label className="f-label">পাসওয়ার্ড</label>
        <input className="inp" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required />
        <button className="btn btn-block" disabled={busy} style={{marginTop:8}}>{busy ? 'লগইন হচ্ছে…' : '🔐 লগইন'}</button>
      </form>
    </div>
  )
}

function Shell() {
  const { session, loading } = useAuth()
  if (loading) return <p className="center" style={{padding:60}}>লোড হচ্ছে…</p>
  if (!session) return <LoginForm />
  return <Admin />
}

export default function App() {
  return (
    <>
      <div className="ambient" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <AuthProvider><Shell /></AuthProvider>
    </>
  )
}

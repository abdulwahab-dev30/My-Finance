import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Wallet } from 'lucide-react'
import { supabase } from './lib/supabase'

type Props = { recovery?: boolean; onRecoveryComplete?: () => void; configurationMissing?: boolean }

export default function Auth({ recovery = false, onRecoveryComplete, configurationMissing = false }: Props) {
  const [mode, setMode] = useState<'login'|'signup'|'forgot'|'reset'>(recovery ? 'reset' : 'login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(''); setMessage('')
    if (!supabase) return setError('Supabase is not configured. Add the Vercel environment variables and redeploy.')
    if ((mode === 'signup' || mode === 'reset') && password.length < 8) return setError('Password must be at least 8 characters.')
    if (mode === 'signup' && password !== confirm) return setError('Passwords do not match.')
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin }
        })
        if (error) throw error
        setMessage(data.session ? 'Your account is ready. Welcome to My Finance!' : 'Account created. Check your email and confirm your address before signing in.')
        if (!data.session) setMode('login')
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
        if (error) throw error
        setMessage('If an account exists for this email, a password reset link has been sent.')
      } else {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setMessage('Password updated. You are now signed in.')
        onRecoveryComplete?.()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally { setBusy(false) }
  }

  const title = mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : mode === 'reset' ? 'Choose a new password' : 'Welcome back'
  const subtitle = mode === 'signup' ? 'Start bringing your money into focus.' : mode === 'forgot' ? 'We will email you a secure reset link.' : mode === 'reset' ? 'Choose a strong new password.' : 'Sign in to your personal money workspace.'

  return <main className="auth-page">
    <div className="auth-decoration auth-decoration-one"/><div className="auth-decoration auth-decoration-two"/>
    <section className="auth-card">
      <div className="auth-brand"><div className="auth-brand-mark"><Wallet size={22}/></div><div><b>my finance</b><span>PERSONAL MONEY</span></div></div>
      <div className="auth-heading"><div className="auth-eyebrow">YOUR MONEY, IN ONE PLACE</div><h1>{title}<span>.</span></h1><p>{subtitle}</p></div>
      {configurationMissing ? <div className="auth-alert error">Authentication is not configured. Check Vercel variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then redeploy.</div> : <form onSubmit={submit}>
        {mode === 'signup' && <label>Full name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" autoComplete="name" required/></label>}
        {mode !== 'reset' && <label>Email address<div className="auth-input-icon"><Mail size={17}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></div></label>}
        {mode !== 'forgot' && <label>{mode === 'reset' ? 'New password' : 'Password'}<div className="auth-input-icon"><LockKeyhole size={17}/><input type={visible?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete={mode==='login'?'current-password':'new-password'} minLength={8} required/><button type="button" className="password-toggle" onClick={()=>setVisible(!visible)} aria-label={visible?'Hide password':'Show password'}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}
        {mode === 'signup' && <label>Confirm password<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Enter password again" autoComplete="new-password" minLength={8} required/></label>}
        {mode === 'login' && <button type="button" className="auth-link forgot-link" onClick={()=>{setMode('forgot');setError('');setMessage('')}}>Forgot password?</button>}
        {error && <div className="auth-alert error">{error}</div>}
        {message && <div className="auth-alert success">{message}</div>}
        <button className="auth-submit" disabled={busy}>{busy?'Please wait...':mode==='login'?'Sign in':mode==='signup'?'Create account':mode==='forgot'?'Send reset link':'Update password'} <ArrowRight size={17}/></button>
      </form>}
      {!configurationMissing && <div className="auth-switch">{mode==='login'?'New to My Finance?':mode==='signup'?'Already have an account?':mode==='forgot'?'Remember your password?':'Back to sign in'} <button onClick={()=>{setMode(mode==='login'?'signup':'login');setError('');setMessage('')}}>{mode==='login'?'Create an account':'Sign in'}</button></div>}
      <div className="auth-security"><LockKeyhole size={14}/> Secure sign-in powered by Supabase</div>
    </section>
    <p className="auth-footer">© 2026 My Finance · Your financial data stays yours.</p>
  </main>
}

import { useEffect, useMemo, useState } from 'react'
import { LogOut } from 'lucide-react'
import Auth from './Auth'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { ArrowDownLeft, ArrowUpRight, Bell, ChevronDown, CircleHelp, CreditCard, Download, Eye, EyeOff, Filter, Home, Landmark, Menu, MoreHorizontal, Plus, Search, Settings, ShieldCheck, Sparkles, Target, TrendingDown, TrendingUp, Wallet, X, Zap } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

type Tx = { title: string; category: string; date: string; amount: number; wallet: string; kind: 'in' | 'out'; icon: string }
const transactions: Tx[] = [
  { title: 'Transfer received', category: 'Money received', date: 'Today, 10:42 AM', amount: 18500, wallet: 'NayaPay', kind: 'in', icon: '↙' },
  { title: 'Grocery store', category: 'Shopping', date: 'Today, 09:18 AM', amount: 4250, wallet: 'Easypaisa', kind: 'out', icon: '⌂' },
  { title: 'Mobile package', category: 'Bills & utilities', date: 'Yesterday, 08:30 PM', amount: 1200, wallet: 'NayaPay', kind: 'out', icon: '⌁' },
  { title: 'Payment received', category: 'Income', date: 'Yesterday, 02:15 PM', amount: 12000, wallet: 'Easypaisa', kind: 'in', icon: '↗' },
  { title: 'Food & dining', category: 'Food', date: 'Nov 01, 07:45 PM', amount: 1850, wallet: 'NayaPay', kind: 'out', icon: '◒' }
]
const chartData = [{day:'Mon',in:12,out:7},{day:'Tue',in:18,out:10},{day:'Wed',in:11,out:8},{day:'Thu',in:24,out:13},{day:'Fri',in:17,out:11},{day:'Sat',in:29,out:16},{day:'Sun',in:22,out:9}]
const money = (n:number) => new Intl.NumberFormat('en-PK',{maximumFractionDigits:0}).format(n)
function Dashboard({ onSignOut, userEmail }: { onSignOut: () => void; userEmail: string }) {
  const [active,setActive] = useState('Overview')
  const [query,setQuery] = useState('')
  const [walletFilter,setWalletFilter] = useState('All wallets')
  const [showBalance,setShowBalance] = useState(true)
  const [notice,setNotice] = useState('')
  const [mobileNav,setMobileNav] = useState(false)
  const filtered = useMemo(()=>transactions.filter(t => (walletFilter==='All wallets'||t.wallet===walletFilter) && (t.title.toLowerCase().includes(query.toLowerCase())||t.category.toLowerCase().includes(query.toLowerCase()))),[query,walletFilter])
  const nav = [{label:'Overview',icon:Home},{label:'Transactions',icon:CreditCard},{label:'My wallets',icon:Wallet},{label:'Budgets',icon:Target},{label:'Insights',icon:TrendingUp}]
  const comingSoon = (label:string) => { setActive(label); if(label!=='Overview'&&label!=='Transactions') setNotice(label+' workspace is being prepared.') }
  return <div className="app-shell">
    <aside className={mobileNav?'sidebar open':'sidebar'}>
      <div className="brand"><div className="brand-mark"><Wallet size={21}/></div><div><b>my finance</b><span>PERSONAL MONEY</span></div><button className="mobile-close icon-btn" onClick={()=>setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{nav.map(item=><button key={item.label} className={active===item.label?'nav-item active':'nav-item'} onClick={()=>{comingSoon(item.label);setMobileNav(false)}}><item.icon size={18}/><span>{item.label}</span>{item.label==='Transactions'&&<small>5</small>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18}/></div><b>Need a hand?</b><p>Your money overview, all in one calm place.</p><button onClick={()=>setNotice('Help centre will be available soon.')}>Visit help centre <span>↗</span></button></div><button className="nav-item" onClick={()=>setNotice('Settings are coming soon.')}><Settings size={18}/>Settings</button><div className="profile"><div className="avatar">{(userEmail[0] || "U").toUpperCase()}</div><div className="profile-copy"><b>{userEmail || "My account"}</b><span>Personal workspace</span></div><button className="signout-btn" onClick={onSignOut} title="Sign out" aria-label="Sign out"><LogOut size={17}/></button></div></div>
    </aside>
    {mobileNav&&<button className="scrim" onClick={()=>setMobileNav(false)} aria-label="Close navigation"/>}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu" onClick={()=>setMobileNav(true)}><Menu size={20}/></button><div className="breadcrumb">Workspace <span>/</span> <b>{active}</b></div></div><div className="top-actions"><div className="sync-status"><span/> Demo preview</div><button className="icon-btn notification" onClick={()=>setNotice('You are all caught up.')}><Bell size={19}/><i/></button><div className="avatar small">W</div></div></header>
      <div className="content">
        <div className="welcome-row"><div><div className="eyebrow">TUESDAY, NOVEMBER 03, 2026</div><h1>Good evening<span>.</span></h1><p>Here’s what’s happening with your money.</p></div><button className="primary-btn" onClick={()=>setNotice('Wallet linking will be enabled when an official personal-wallet API is approved.')}><Plus size={17}/> Connect a wallet</button></div>
        {notice&&<div className="notice"><ShieldCheck size={17}/><span>{notice}</span><button onClick={()=>setNotice('')}><X size={16}/></button></div>}
        <section className="summary-grid">
          <div className="balance-card"><div className="card-top"><span>Total wallet balance</span><button className="balance-eye" onClick={()=>setShowBalance(!showBalance)}>{showBalance?<Eye size={17}/>:<EyeOff size={17}/>}</button></div><div className="balance-value">{showBalance?'Rs. 42,850':'••••••'}</div><div className="balance-meta"><span className="trend-pill"><TrendingUp size={13}/> 8.4%</span><span>vs. last month</span></div><div className="balance-footer"><div><span>AVAILABLE IN</span><b>2 wallets</b></div><div className="balance-art"><div/><div/><div/></div></div></div>
          <div className="stat-card"><div className="stat-head"><span>Money received</span><div className="stat-icon green"><ArrowDownLeft size={18}/></div></div><b>Rs. 30,500</b><div className="stat-foot"><span className="positive"><TrendingUp size={13}/> 12.6%</span><span>this month</span></div><div className="mini-bars green-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div>
          <div className="stat-card"><div className="stat-head"><span>Money spent</span><div className="stat-icon orange"><ArrowUpRight size={18}/></div></div><b>Rs. 18,250</b><div className="stat-foot"><span className="negative"><TrendingDown size={13}/> 4.2%</span><span>this month</span></div><div className="mini-bars orange-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div>
        </section>
        <section className="wallet-section"><div className="section-heading"><div><h2>Your wallets</h2><p>Keep an eye on both balances at a glance.</p></div><button className="text-btn" onClick={()=>comingSoon('My wallets')}>View all <span>→</span></button></div><div className="wallet-grid">
          <div className="wallet-card nayapay"><div className="wallet-card-top"><div className="provider-logo naya">n</div><span className="wallet-type">DIGITAL WALLET</span><MoreHorizontal size={19}/></div><div className="provider-name">NayaPay</div><div className="wallet-balance">{showBalance?'Rs. 28,450':'••••••'}</div><div className="wallet-card-bottom"><span className="pending-dot"/> Connection pending <span className="wallet-link" onClick={()=>setNotice('NayaPay personal-wallet API access has not been verified yet.')}>Details ↗</span></div></div>
          <div className="wallet-card easypaisa"><div className="wallet-card-top"><div className="provider-logo easy">e</div><span className="wallet-type">DIGITAL WALLET</span><MoreHorizontal size={19}/></div><div className="provider-name">easypaisa</div><div className="wallet-balance">{showBalance?'Rs. 14,400':'••••••'}</div><div className="wallet-card-bottom"><span className="pending-dot"/> Connection pending <span className="wallet-link" onClick={()=>setNotice('Easypaisa personal-wallet API access has not been verified yet.')}>Details ↗</span></div></div>
        </div><p className="demo-note"><ShieldCheck size={14}/> Preview balances are illustrative demo values, not live wallet data.</p></section>
        <section className="lower-grid"><div className="panel activity-panel"><div className="section-heading"><div><h2>Money activity</h2><p>Your incoming and outgoing money.</p></div><button className="period-select" onClick={()=>setNotice('Showing the last 7 days in this preview.')}>Last 7 days <ChevronDown size={15}/></button></div><div className="chart-legend"><span><i className="legend-in"/> Received</span><span><i className="legend-out"/> Spent</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:10,right:5,left:-24,bottom:0}}><defs><linearGradient id="received" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#269d79" stopOpacity={.2}/><stop offset="100%" stopColor="#269d79" stopOpacity={0}/></linearGradient><linearGradient id="spent" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e6a45c" stopOpacity={.18}/><stop offset="100%" stopColor="#e6a45c" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#edf0f3" vertical={false}/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'#9aa3af',fontSize:11}} dy={9}/><Tooltip formatter={(v:any)=>['Rs. '+Number(v*1000).toLocaleString(),'']} contentStyle={{borderRadius:12,border:'1px solid #edf0f3',fontSize:12}}/><Area type="monotone" dataKey="in" stroke="#269d79" strokeWidth={2.5} fill="url(#received)"/><Area type="monotone" dataKey="out" stroke="#e6a45c" strokeWidth={2.5} fill="url(#spent)"/></AreaChart></ResponsiveContainer></div></div>
          <div className="panel insight-panel"><div className="insight-title"><div className="spark-icon"><Sparkles size={17}/></div><div><h2>Spending snapshot</h2><p>This month · demo preview</p></div></div><div className="spend-total">Rs. 18,250 <span>spent</span></div><div className="spend-track"><i/><i/><i/><i/></div><div className="spend-legend"><div><i className="c1"/> Shopping <b>Rs. 7,200</b></div><div><i className="c2"/> Bills <b>Rs. 5,400</b></div><div><i className="c3"/> Food <b>Rs. 3,850</b></div><div><i className="c4"/> Other <b>Rs. 1,800</b></div></div><div className="insight-tip"><Zap size={15}/><span>Connect an eligible wallet to unlock your personal spending insights.</span></div></div></section>
        <section className="panel transactions-panel"><div className="section-heading transaction-heading"><div><h2>Recent transactions</h2><p>A quick look at your latest activity.</p></div><button className="text-btn" onClick={()=>setActive('Transactions')}>All transactions <span>→</span></button></div><div className="transaction-tools"><div className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search transactions"/></div><select value={walletFilter} onChange={e=>setWalletFilter(e.target.value)}><option>All wallets</option><option>NayaPay</option><option>Easypaisa</option></select><button className="filter-btn" onClick={()=>setNotice('Date and category filters are coming soon.')}><Filter size={15}/> Filters</button></div><div className="transaction-list">{filtered.map((t,i)=><div className="transaction-row" key={t.title+i}><div className={'transaction-icon '+(t.kind==='in'?'in':'out')}>{t.kind==='in'?<ArrowDownLeft size={18}/>:<ArrowUpRight size={18}/>}</div><div className="transaction-name"><b>{t.title}</b><span>{t.category} · {t.date}</span></div><div className="transaction-wallet">{t.wallet}</div><div className={t.kind==='in'?'transaction-amount income':'transaction-amount'}>{t.kind==='in'?'+':'−'} Rs. {money(t.amount)}</div><button className="row-more" onClick={()=>setNotice('Transaction details will be available with connected wallet data.')}><MoreHorizontal size={18}/></button></div>)}{filtered.length===0&&<div className="empty-state">No matching demo transactions.</div>}</div><div className="table-foot"><span>Showing {filtered.length} illustrative transactions</span><button onClick={()=>setNotice('Export will be enabled for your own imported or authorized wallet transactions.') }><Download size={15}/> Export</button></div></section>
        <footer><span>© 2026 My Finance</span><span><ShieldCheck size={13}/> Your financial data stays yours.</span></footer>
      </div>
    </main>
  </div>
}
function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') setRecovery(false)
      setLoading(false)
    })
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => { if (supabase) await supabase.auth.signOut() }

  if (loading) return <div className="auth-loading"><div className="auth-spinner"/><span>Loading your secure workspace...</span></div>
  if (!isSupabaseConfigured) return <Auth configurationMissing />
  if (!session || recovery) return <Auth recovery={recovery} onRecoveryComplete={() => setRecovery(false)} />
  return <Dashboard onSignOut={signOut} userEmail={session.user.email || ''} />
}

export default App
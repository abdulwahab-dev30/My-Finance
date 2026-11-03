import { useCallback, useEffect, useMemo, useState } from 'react'
import { LogOut } from 'lucide-react'
import Auth from './Auth'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { ArrowDownLeft, ArrowUpRight, Bell, CircleHelp, CreditCard, Download, Eye, EyeOff, Filter, Home, Menu, MoreHorizontal, Plus, Search, Settings, ShieldCheck, Target, TrendingUp, Wallet, X, Zap } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

type WalletRow = { id:string; provider:'nayapay'|'easypaisa'|'manual'; display_name:string; connection_status:string }
type CategoryRow = { id:string; name:string; kind:'income'|'expense' }
type TxRow = { id:string; title:string; amount:number; direction:'incoming'|'outgoing'; occurred_at:string; description:string|null; wallet_id:string|null; category_id:string|null; wallet_accounts?:{display_name:string}|null; categories?:{name:string}|null }
const money = (n:number) => new Intl.NumberFormat('en-PK',{maximumFractionDigits:0}).format(n)
const dateLabel = (v:string) => new Date(v).toLocaleString('en-PK',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})
const today = () => new Date().toISOString().slice(0,16)
const defaultCategories = [
  ...['Salary','Business','Gift','Other income'].map(name=>({name,kind:'income' as const})),
  ...['Food','Shopping','Bills & utilities','Transport','Health','Education','Entertainment','Other expense'].map(name=>({name,kind:'expense' as const}))
]
function Dashboard({ onSignOut, userEmail, userId }: { onSignOut:()=>void; userEmail:string; userId:string }) {
  const [active,setActive]=useState('Overview')
  const [wallets,setWallets]=useState<WalletRow[]>([])
  const [categories,setCategories]=useState<CategoryRow[]>([])
  const [transactions,setTransactions]=useState<TxRow[]>([])
  const [loadingData,setLoadingData]=useState(true)
  const [saving,setSaving]=useState(false)
  const [query,setQuery]=useState('')
  const [walletFilter,setWalletFilter]=useState('all')
  const [showBalance,setShowBalance]=useState(true)
  const [notice,setNotice]=useState('')
  const [mobileNav,setMobileNav]=useState(false)
  const [modal,setModal]=useState<'transaction'|'wallet'|null>(null)
  const [txTitle,setTxTitle]=useState('')
  const [txAmount,setTxAmount]=useState('')
  const [txDirection,setTxDirection]=useState<'outgoing'|'incoming'>('outgoing')
  const [txWallet,setTxWallet]=useState('')
  const [txCategory,setTxCategory]=useState('')
  const [txDate,setTxDate]=useState(today())
  const [txDescription,setTxDescription]=useState('')
  const [walletProvider,setWalletProvider]=useState<'nayapay'|'easypaisa'|'manual'>('nayapay')
  const [walletName,setWalletName]=useState('')

  const loadData=useCallback(async()=>{
    if(!supabase)return
    setLoadingData(true)
    const [w,c,t]=await Promise.all([
      supabase.from('wallet_accounts').select('id,provider,display_name,connection_status').order('created_at',{ascending:true}),
      supabase.from('categories').select('id,name,kind').or('user_id.is.null,user_id.eq.'+userId).order('name'),
      supabase.from('transactions').select('id,title,amount,direction,occurred_at,description,wallet_id,category_id,wallet_accounts(display_name),categories(name)').order('occurred_at',{ascending:false}).limit(500)
    ])
    const err=w.error||c.error||t.error
    if(err)setNotice(err.message)
    setWallets((w.data||[]) as WalletRow[])
    setCategories((c.data||[]) as CategoryRow[])
    setTransactions((t.data||[]) as unknown as TxRow[])
    setLoadingData(false)
  },[userId])
  useEffect(()=>{void loadData()},[loadData])

  const now=new Date()
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1)
  const monthTx=transactions.filter(t=>new Date(t.occurred_at)>=monthStart)
  const received=monthTx.filter(t=>t.direction==='incoming').reduce((s,t)=>s+Number(t.amount),0)
  const spent=monthTx.filter(t=>t.direction==='outgoing').reduce((s,t)=>s+Number(t.amount),0)
  const totalBalance=transactions.reduce((s,t)=>s+(t.direction==='incoming'?1:-1)*Number(t.amount),0)
  const walletBalance=(id:string)=>transactions.filter(t=>t.wallet_id===id).reduce((s,t)=>s+(t.direction==='incoming'?1:-1)*Number(t.amount),0)
  const filtered=useMemo(()=>transactions.filter(t=>(walletFilter==='all'||t.wallet_id===walletFilter)&&((t.title+' '+(t.categories?.name||'')+' '+(t.wallet_accounts?.display_name||'')).toLowerCase().includes(query.toLowerCase()))),[transactions,walletFilter,query])
  const chartData=Array.from({length:7},(_,i)=>{
    const d=new Date();d.setDate(d.getDate()-(6-i));d.setHours(0,0,0,0)
    const next=new Date(d);next.setDate(next.getDate()+1)
    const day=transactions.filter(t=>new Date(t.occurred_at)>=d&&new Date(t.occurred_at)<next)
    return {day:d.toLocaleDateString('en',{weekday:'short'}),in:day.filter(t=>t.direction==='incoming').reduce((s,t)=>s+Number(t.amount),0),out:day.filter(t=>t.direction==='outgoing').reduce((s,t)=>s+Number(t.amount),0)}
  })
  const saveWallet=async(e:React.FormEvent)=>{
    e.preventDefault();if(!supabase||!walletName.trim())return
    setSaving(true)
    const {error}=await supabase.from('wallet_accounts').insert({user_id:userId,provider:walletProvider,display_name:walletName.trim(),connection_status:'pending'})
    setSaving(false)
    if(error){setNotice(error.message);return}
    setWalletName('');setModal(null);setNotice('Wallet account added. Add its opening balance as an incoming transaction if needed.');await loadData()
  }
  const saveTransaction=async(e:React.FormEvent)=>{
    e.preventDefault();if(!supabase||!txTitle.trim()||!Number(txAmount)||Number(txAmount)<=0)return
    setSaving(true)
    const {error}=await supabase.from('transactions').insert({user_id:userId,title:txTitle.trim(),amount:Number(txAmount),direction:txDirection,wallet_id:txWallet||null,category_id:txCategory||null,occurred_at:new Date(txDate).toISOString(),description:txDescription.trim()||null,source:'manual',currency:'PKR'})
    setSaving(false)
    if(error){setNotice(error.message);return}
    setTxTitle('');setTxAmount('');setTxDescription('');setModal(null);setNotice('Transaction saved successfully.');await loadData()
  }
  const removeTransaction=async(id:string)=>{
    if(!supabase||!window.confirm('Delete this transaction?'))return
    const {error}=await supabase.from('transactions').delete().eq('id',id)
    if(error)setNotice(error.message);else{setNotice('Transaction deleted.');await loadData()}
  }
  const exportCsv=()=>{
    const rows=[['Date','Title','Type','Category','Wallet','Amount'],...filtered.map(t=>[t.occurred_at,t.title,t.direction,t.categories?.name||'',t.wallet_accounts?.display_name||'',String(t.amount)])]
    const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n')
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='my-finance-transactions.csv';a.click();URL.revokeObjectURL(url)
  }
  const nav=[{label:'Overview',icon:Home},{label:'Transactions',icon:CreditCard},{label:'My wallets',icon:Wallet},{label:'Budgets',icon:Target},{label:'Insights',icon:TrendingUp}]
  const go=(label:string)=>{setActive(label);setMobileNav(false)}
  const walletLabel=(id:string|null)=>wallets.find(w=>w.id===id)?.display_name||'No wallet'
  return <div className="app-shell">
    <aside className={mobileNav?'sidebar open':'sidebar'}>
      <div className="brand"><div className="brand-mark"><Wallet size={21}/></div><div><b>my finance</b><span>PERSONAL MONEY</span></div><button className="mobile-close icon-btn" onClick={()=>setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div><nav>{nav.map(item=><button key={item.label} className={active===item.label?'nav-item active':'nav-item'} onClick={()=>go(item.label)}><item.icon size={18}/><span>{item.label}</span>{item.label==='Transactions'&&<small>{transactions.length}</small>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18}/></div><b>Need a hand?</b><p>Track your money in one calm place.</p><button onClick={()=>setNotice('Add your wallets and record transactions manually. Official wallet sync is not connected yet.')}>How it works ↗</button></div><button className="nav-item" onClick={()=>setNotice('Settings are coming in the next update.')}><Settings size={18}/>Settings</button><div className="profile"><div className="avatar">{(userEmail[0]||'U').toUpperCase()}</div><div className="profile-copy"><b>{userEmail||'My account'}</b><span>Personal workspace</span></div><button className="signout-btn" onClick={onSignOut} title="Sign out" aria-label="Sign out"><LogOut size={17}/></button></div></div>
    </aside>
    {mobileNav&&<button className="scrim" onClick={()=>setMobileNav(false)} aria-label="Close navigation"/>}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu" onClick={()=>setMobileNav(true)}><Menu size={20}/></button><div className="breadcrumb">Workspace <span>/</span> <b>{active}</b></div></div><div className="top-actions"><div className="sync-status"><span style={{background:'#269d79'}}/> Live database</div><button className="icon-btn notification" onClick={()=>setNotice('You are all caught up.')}><Bell size={19}/></button><div className="avatar small">{(userEmail[0]||'U').toUpperCase()}</div></div></header>
      <div className="content">
        <div className="welcome-row"><div><div className="eyebrow">{now.toLocaleDateString('en-PK',{weekday:'long',year:'numeric',month:'long',day:'numeric'}).toUpperCase()}</div><h1>{active==='Overview'?'Your money, clearly':active}<span>.</span></h1><p>{active==='Overview'?'Here’s what’s happening with your money.':'Manage your personal finance records.'}</p></div><div className="welcome-actions"><button className="secondary-btn" onClick={()=>setModal('wallet')}><Plus size={16}/> Add wallet</button><button className="primary-btn" onClick={()=>setModal('transaction')}><Plus size={17}/> Add transaction</button></div></div>
        {notice&&<div className="notice"><ShieldCheck size={17}/><span>{notice}</span><button onClick={()=>setNotice('')}><X size={16}/></button></div>}
        {active==='Overview'&&<><section className="summary-grid">
          <div className="balance-card"><div className="card-top"><span>Net recorded balance</span><button className="balance-eye" onClick={()=>setShowBalance(!showBalance)}>{showBalance?<Eye size={17}/>:<EyeOff size={17}/>}</button></div><div className="balance-value">{showBalance?'Rs. '+money(totalBalance):'••••••'}</div><div className="balance-meta"><span>{transactions.length} recorded transactions</span></div><div className="balance-footer"><div><span>AVAILABLE IN</span><b>{wallets.length} wallets</b></div><div className="balance-art"><div/><div/><div/></div></div></div>
          <div className="stat-card"><div className="stat-head"><span>Money received</span><div className="stat-icon green"><ArrowDownLeft size={18}/></div></div><b>Rs. {money(received)}</b><div className="stat-foot"><span>this month</span></div><div className="mini-bars green-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div>
          <div className="stat-card"><div className="stat-head"><span>Money spent</span><div className="stat-icon orange"><ArrowUpRight size={18}/></div></div><b>Rs. {money(spent)}</b><div className="stat-foot"><span>this month</span></div><div className="mini-bars orange-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div>
        </section>
        <section className="wallet-section"><div className="section-heading"><div><h2>Your wallets</h2><p>Balances calculated from transactions you record.</p></div><button className="text-btn" onClick={()=>go('My wallets')}>View all <span>→</span></button></div><div className="wallet-grid">{wallets.length?wallets.map(w=><div className={'wallet-card '+(w.provider==='easypaisa'?'easypaisa':'nayapay')} key={w.id}><div className="wallet-card-top"><div className={'provider-logo '+(w.provider==='easypaisa'?'easy':'naya')}>{w.provider==='easypaisa'?'e':w.provider==='nayapay'?'n':'₨'}</div><span className="wallet-type">{w.provider.toUpperCase()}</span><MoreHorizontal size={19}/></div><div className="provider-name">{w.display_name}</div><div className="wallet-balance">{showBalance?'Rs. '+money(walletBalance(w.id)):'••••••'}</div><div className="wallet-card-bottom"><span className="pending-dot"/> Manual tracking <span className="wallet-link">{w.connection_status}</span></div></div>):<div className="empty-state">No wallets yet. Add NayaPay, Easypaisa or a cash account to get started.</div>}</div><p className="demo-note"><ShieldCheck size={14}/> Balances are based on transactions entered in My Finance; no live wallet connection is active.</p></section>
        <section className="lower-grid"><div className="panel activity-panel"><div className="section-heading"><div><h2>Money activity</h2><p>Incoming and outgoing · last 7 days.</p></div></div><div className="chart-legend"><span><i className="legend-in"/> Received</span><span><i className="legend-out"/> Spent</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:10,right:5,left:-24,bottom:0}}><defs><linearGradient id="received" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#269d79" stopOpacity={.2}/><stop offset="100%" stopColor="#269d79" stopOpacity={0}/></linearGradient><linearGradient id="spent" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e6a45c" stopOpacity={.18}/><stop offset="100%" stopColor="#e6a45c" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#edf0f3" vertical={false}/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'#9aa3af',fontSize:11}} dy={9}/><Tooltip formatter={(v:any)=>['Rs. '+money(Number(v)),'']} contentStyle={{borderRadius:12,border:'1px solid #edf0f3',fontSize:12}}/><Area type="monotone" dataKey="in" stroke="#269d79" strokeWidth={2.5} fill="url(#received)"/><Area type="monotone" dataKey="out" stroke="#e6a45c" strokeWidth={2.5} fill="url(#spent)"/></AreaChart></ResponsiveContainer></div></div>
          <div className="panel insight-panel"><div className="insight-title"><div className="spark-icon"><Zap size={17}/></div><div><h2>Getting started</h2><p>Your finance workspace</p></div></div><div className="spend-total">{transactions.length} <span>transactions saved</span></div><div className="insight-tip"><ShieldCheck size={15}/><span>Start by adding your wallets, then record income and expenses. You can import statements in a later update.</span></div></div></section></>}
        {active==='Transactions'&&<section className="panel transactions-panel"><div className="section-heading transaction-heading"><div><h2>All transactions</h2><p>Your saved income and expenses.</p></div><button className="text-btn" onClick={()=>setModal('transaction')}><Plus size={15}/> Add new</button></div><div className="transaction-tools"><div className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search transactions"/></div><select value={walletFilter} onChange={e=>setWalletFilter(e.target.value)}><option value="all">All wallets</option>{wallets.map(w=><option key={w.id} value={w.id}>{w.display_name}</option>)}</select><button className="filter-btn" onClick={exportCsv}><Download size={15}/> Export CSV</button></div><TransactionList rows={filtered} onDelete={removeTransaction}/></section>}
        {active==='My wallets'&&<section className="panel transactions-panel"><div className="section-heading"><div><h2>Your wallets</h2><p>Add manual accounts and track their balances.</p></div><button className="primary-btn" onClick={()=>setModal('wallet')}><Plus size={16}/> Add wallet</button></div><div className="wallet-grid">{wallets.map(w=><div className="wallet-card nayapay" key={w.id}><div className="provider-name">{w.display_name}</div><div className="wallet-balance">Rs. {money(walletBalance(w.id))}</div><div className="wallet-card-bottom">{w.provider} · Manual tracking</div></div>)}{!wallets.length&&<div className="empty-state">No wallets added yet.</div>}</div></section>}
        {active==='Budgets'&&<section className="panel transactions-panel"><h2>Budgets</h2><p>Budget creation and tracking is the next module. Your transactions and categories are now stored securely.</p></section>}
        {active==='Insights'&&<section className="panel transactions-panel"><h2>Insights</h2><p>Your charts and totals are calculated from your saved transactions.</p><p>Monthly income: Rs. {money(received)} · Monthly expenses: Rs. {money(spent)}</p></section>}
        {loadingData&&<div className="loading-inline">Loading your financial records…</div>}
        <footer><span>© 2026 My Finance</span><span><ShieldCheck size={13}/> Your financial data stays yours.</span></footer>
      </div>
    </main>
    {modal&&<div className="modal-backdrop" onClick={()=>setModal(null)}><div className="finance-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><h2>{modal==='wallet'?'Add a wallet':'Add transaction'}</h2><button className="icon-btn" onClick={()=>setModal(null)}><X size={19}/></button></div>
      {modal==='wallet'?<form onSubmit={saveWallet}><label>Wallet provider</label><select value={walletProvider} onChange={e=>setWalletProvider(e.target.value as typeof walletProvider)}><option value="nayapay">NayaPay</option><option value="easypaisa">Easypaisa</option><option value="manual">Cash / Other</option></select><label>Wallet name</label><input required value={walletName} onChange={e=>setWalletName(e.target.value)} placeholder="e.g. My NayaPay"/><p className="form-hint">This creates a manual tracking account. It does not connect to the provider.</p><button className="primary-btn" disabled={saving}>{saving?'Saving…':'Save wallet'}</button></form>:
      <form onSubmit={saveTransaction}><label>Transaction type</label><select value={txDirection} onChange={e=>{const v=e.target.value as typeof txDirection;setTxDirection(v);setTxCategory('')}}><option value="outgoing">Expense</option><option value="incoming">Income</option></select><label>Description</label><input required value={txTitle} onChange={e=>setTxTitle(e.target.value)} placeholder="e.g. Grocery shopping"/><label>Amount (PKR)</label><input required type="number" min="0.01" step="0.01" value={txAmount} onChange={e=>setTxAmount(e.target.value)} placeholder="0.00"/><label>Wallet</label><select value={txWallet} onChange={e=>setTxWallet(e.target.value)}><option value="">No wallet selected</option>{wallets.map(w=><option key={w.id} value={w.id}>{w.display_name}</option>)}</select><label>Category</label><select value={txCategory} onChange={e=>setTxCategory(e.target.value)}><option value="">Uncategorized</option>{categories.filter(c=>c.kind===(txDirection==='incoming'?'income':'expense')).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><label>Date and time</label><input type="datetime-local" required value={txDate} onChange={e=>setTxDate(e.target.value)}/><label>Notes (optional)</label><input value={txDescription} onChange={e=>setTxDescription(e.target.value)} placeholder="Add a note"/><button className="primary-btn" disabled={saving}>{saving?'Saving…':'Save transaction'}</button></form>}
    </div></div>}
  </div>
}
function TransactionList({rows,onDelete}:{rows:TxRow[];onDelete:(id:string)=>void}) {
  if(!rows.length)return <div className="empty-state">No transactions found. Add your first transaction to begin.</div>
  return <><div className="transaction-list">{rows.map(t=><div className="transaction-row" key={t.id}><div className={'transaction-icon '+(t.direction==='incoming'?'in':'out')}>{t.direction==='incoming'?<ArrowDownLeft size={18}/>:<ArrowUpRight size={18}/>}</div><div className="transaction-name"><b>{t.title}</b><span>{t.categories?.name||'Uncategorized'} · {dateLabel(t.occurred_at)}</span></div><div className="transaction-wallet">{t.wallet_accounts?.display_name||'—'}</div><div className={t.direction==='incoming'?'transaction-amount income':'transaction-amount'}>{t.direction==='incoming'?'+':'−'} Rs. {money(Number(t.amount))}</div><button className="row-more" onClick={()=>onDelete(t.id)} title="Delete transaction"><MoreHorizontal size={18}/></button></div>)}</div><div className="table-foot"><span>{rows.length} saved transactions</span></div></>
}
function App() {
  const [session,setSession]=useState<Session|null>(null)
  const [loading,setLoading]=useState(true)
  const [recovery,setRecovery]=useState(false)
  useEffect(()=>{
    if(!supabase){setLoading(false);return}
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,nextSession)=>{setSession(nextSession);if(event==='PASSWORD_RECOVERY')setRecovery(true);if(event==='SIGNED_OUT')setRecovery(false);setLoading(false)})
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)})
    return ()=>subscription.unsubscribe()
  },[])
  const signOut=async()=>{if(supabase)await supabase.auth.signOut()}
  if(loading)return <div className="auth-loading"><div className="auth-spinner"/><span>Loading your secure workspace...</span></div>
  if(!isSupabaseConfigured)return <Auth configurationMissing/>
  if(!session||recovery)return <Auth key={recovery?'password-recovery':'sign-in'} recovery={recovery} onRecoveryComplete={()=>setRecovery(false)}/>
  return <Dashboard onSignOut={signOut} userEmail={session.user.email||''} userId={session.user.id}/>
}
export default App

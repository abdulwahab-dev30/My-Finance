import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import Auth from './Auth'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { ArrowDownLeft, ArrowUpRight, Bell, CircleHelp, CreditCard, Download, Eye, EyeOff, Filter, Home, Menu, MoreHorizontal, Pencil, Plus, Search, Settings, ShieldCheck, Tag, Target, Trash2, TrendingUp, Upload, Wallet, X, Zap, Building2, Link2, LockKeyhole } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { bankInstitutions, type BankInstitution } from './lib/bankConnections'

type WalletRow = { id:string; provider:'nayapay'|'easypaisa'|'manual'; display_name:string; connection_status:string }
type BankRequestRow = { id:string; institution_code:string; institution_name:string; access_status:string; created_at:string }
type CategoryRow = { id:string; name:string; kind:'income'|'expense'; user_id:string|null }
type TxRow = { id:string; title:string; amount:number; direction:'incoming'|'outgoing'; occurred_at:string; description:string|null; wallet_id:string|null; category_id:string|null; wallet_accounts?:{display_name:string}|null; categories?:{name:string}|null }
type BudgetRow = { id:string; name:string; amount:number; period:'weekly'|'monthly'; starts_on:string; category_id:string|null; categories?:{name:string}|null }
type RecurringRow = { id:string; title:string; amount:number; direction:'incoming'|'outgoing'; frequency:'weekly'|'monthly'|'yearly'; next_due_on:string; end_on:string|null; reminder_days:number; wallet_id:string|null; category_id:string|null; notes:string|null; is_active:boolean; wallet_accounts?:{display_name:string}|null; categories?:{name:string}|null }
const addFrequency = (date:string,frequency:RecurringRow['frequency']) => {
  const d=new Date(date+'T12:00:00Z')
  if(frequency==='weekly')d.setUTCDate(d.getUTCDate()+7)
  else {
    const day=d.getUTCDate();d.setUTCDate(1)
    if(frequency==='monthly')d.setUTCMonth(d.getUTCMonth()+1);else d.setUTCFullYear(d.getUTCFullYear()+1)
    const lastDay=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()
    d.setUTCDate(Math.min(day,lastDay))
  }
  return d.toISOString().slice(0,10)
}
const dayDistance = (date:string) => { const today=new Date();today.setHours(0,0,0,0);const due=new Date(date+'T00:00:00');return Math.round((due.getTime()-today.getTime())/86400000) }
const money = (n:number) => new Intl.NumberFormat('en-PK',{maximumFractionDigits:0}).format(n)
const dateLabel = (v:string) => new Date(v).toLocaleString('en-PK',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})
const today = () => new Date().toISOString().slice(0,16)
function parseStatementDate(value:string):Date {
  const v=value.trim();if(/^\d{4}-\d{2}-\d{2}/.test(v))return new Date(v.length===10?v+'T12:00:00':v)
  const match=v.match(/^(\d{1,2})[\\/-](\d{1,2})[\\/-](\d{2,4})/)
  if(match){const day=Number(match[1]),month=Number(match[2])-1,rawYear=Number(match[3]),year=rawYear<100?2000+rawYear:rawYear;return new Date(year,month,day,12)}
  return new Date(v)
}

type CsvImportRow = { title:string; amount:number; direction:'incoming'|'outgoing'; occurred_at:string; category_id:string|null; wallet_id:string|null; categoryLabel:string; walletLabel:string; line:number }
type StatementRow = { date:string; title:string; type:'incoming'|'outgoing'; amount:number }
function parseCsvText(text:string): string[][] {
  const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false
  for(let i=0;i<text.length;i++){
    const ch=text[i]
    if(ch==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++}
    else if(ch==='"'){quoted=!quoted}
    else if(ch===','&&!quoted){row.push(cell.trim());cell=''}
    else if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&text[i+1]==='\n')i++
      row.push(cell.trim());cell=''
      if(row.some(v=>v!==''))rows.push(row)
      row=[]
    } else cell+=ch
  }
  row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row)
  return rows
}
async function extractPdfStatementRows(file:File):Promise<StatementRow[]> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const pdf = await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise
  const lines:string[]=[]
  for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
    const page=await pdf.getPage(pageNo);const content=await page.getTextContent();const grouped=new Map<number,string[]>()
    for(const item of content.items as any[]){if(!('str' in item)||!item.str.trim())continue;const y=Math.round(item.transform?.[5]||0);const parts=grouped.get(y)||[];parts.push(item.str.trim());grouped.set(y,parts)}
    for(const [,parts] of [...grouped.entries()].sort((a,b)=>b[0]-a[0]))lines.push(parts.join(' '))
  }
  const datePattern=/^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/
  const amountPattern=/-?\d[\d,]*(?:\.\d{1,2})?/g
  const rows:StatementRow[]=[]
  const header=lines.find(line=>/debit/i.test(line)&&/credit/i.test(line))||''
  for(const line of lines){
    const dateMatch=line.match(datePattern);if(!dateMatch)continue
    const rawDate=dateMatch[1];let date:Date
    if(/^\d{4}-/.test(rawDate))date=new Date(rawDate+'T12:00:00')
    else {const [day,month,rawYear]=rawDate.split(/[/-]/).map(Number);const year=rawYear<100?2000+rawYear:rawYear;date=new Date(year,month-1,day,12)}
    if(Number.isNaN(date.getTime()))continue
    const tail=line.slice(dateMatch[0].length).trim();const values=(tail.match(amountPattern)||[]).map(v=>Math.abs(Number(v.replace(/,/g,'')))).filter(v=>Number.isFinite(v)&&v>0)
    if(!values.length)continue
    const marker=tail.match(/\b(CR|CREDIT|DR|DEBIT)\b/i)?.[1]?.toUpperCase()
    let amount=0;let direction:'incoming'|'outgoing'|null=null
    if(marker){direction=marker==='CR'||marker==='CREDIT'?'incoming':'outgoing';amount=values[0]}
    else if(header&&values.length>=3){const debit=values[values.length-3];const credit=values[values.length-2];if(credit>0){direction='incoming';amount=credit}else if(debit>0){direction='outgoing';amount=debit}}
    else if(/-\s*\d/.test(tail)){direction='outgoing';amount=values[0]}
    if(!direction||!amount)continue
    const title=tail.replace(amountPattern,' ').replace(/\b(CR|CREDIT|DR|DEBIT)\b/ig,' ').replace(/\s+/g,' ').trim()
    if(!title)continue
    rows.push({date:date.toISOString(),title:title.slice(0,180),type:direction,amount})
  }
  return rows
}
const defaultCategories = [
  ...['Salary','Business','Gift','Other income'].map(name=>({name,kind:'income' as const})),
  ...['Food','Shopping','Bills & utilities','Transport','Health','Education','Entertainment','Other expense'].map(name=>({name,kind:'expense' as const}))
]
function Dashboard({ onSignOut, userEmail, userId }: { onSignOut:()=>void; userEmail:string; userId:string }) {
  const [active,setActive]=useState('Overview')
  const [wallets,setWallets]=useState<WalletRow[]>([])
  const [bankRequests,setBankRequests]=useState<BankRequestRow[]>([])
  const [categories,setCategories]=useState<CategoryRow[]>([])
  const [budgets,setBudgets]=useState<BudgetRow[]>([])
  const [recurringItems,setRecurringItems]=useState<RecurringRow[]>([])
  const [transactions,setTransactions]=useState<TxRow[]>([])
  const [loadingData,setLoadingData]=useState(true)
  const [saving,setSaving]=useState(false)
  const [query,setQuery]=useState('')
  const [walletFilter,setWalletFilter]=useState('all')
  const [showBalance,setShowBalance]=useState(true)
  const [settingsBusy,setSettingsBusy]=useState(false)
  const [notice,setNotice]=useState('')
  const [mobileNav,setMobileNav]=useState(false)
  const [modal,setModal]=useState<'transaction'|'category'|'budget'|'recurring'|null>(null)
  const [editingCategory,setEditingCategory]=useState<CategoryRow|null>(null)
  const [categoryName,setCategoryName]=useState('')
  const [categoryKind,setCategoryKind]=useState<'income'|'expense'>('expense')
  const [editingBudget,setEditingBudget]=useState<BudgetRow|null>(null)
  const [budgetName,setBudgetName]=useState('')
  const [budgetAmount,setBudgetAmount]=useState('')
  const [budgetPeriod,setBudgetPeriod]=useState<'weekly'|'monthly'>('monthly')
  const [budgetCategory,setBudgetCategory]=useState('')
  const [budgetStart,setBudgetStart]=useState(new Date().toISOString().slice(0,10))
  const [txTitle,setTxTitle]=useState('')
  const [txAmount,setTxAmount]=useState('')
  const [txDirection,setTxDirection]=useState<'outgoing'|'incoming'>('outgoing')
  const [txWallet,setTxWallet]=useState('')
  const [txCategory,setTxCategory]=useState('')
  const [txDate,setTxDate]=useState(today())
  const [txDescription,setTxDescription]=useState('')
  const [importRows,setImportRows]=useState<CsvImportRow[]>([])
  const [importInvalid,setImportInvalid]=useState(0)
  const [importFileName,setImportFileName]=useState('')
  const [importInstitution,setImportInstitution]=useState('')
  const [importWalletId,setImportWalletId]=useState('')
  const [importError,setImportError]=useState('')
  const statementFileInputRef=useRef<HTMLInputElement>(null)
  const [insightRange,setInsightRange]=useState<'7d'|'30d'|'month'|'90d'|'all'>('30d')
  const [editingRecurring,setEditingRecurring]=useState<RecurringRow|null>(null)
  const [recurringTitle,setRecurringTitle]=useState('')
  const [recurringAmount,setRecurringAmount]=useState('')
  const [recurringDirection,setRecurringDirection]=useState<'outgoing'|'incoming'>('outgoing')
  const [recurringFrequency,setRecurringFrequency]=useState<RecurringRow['frequency']>('monthly')
  const [recurringDue,setRecurringDue]=useState(new Date().toISOString().slice(0,10))
  const [recurringEnd,setRecurringEnd]=useState('')
  const [recurringReminder,setRecurringReminder]=useState('3')
  const [recurringWallet,setRecurringWallet]=useState('')
  const [recurringCategory,setRecurringCategory]=useState('')
  const [recurringNotes,setRecurringNotes]=useState('')

  const loadData=useCallback(async()=>{
    if(!supabase)return
    setLoadingData(true)
    const [w,c,t,b,r,br]=await Promise.all([
      supabase.from('wallet_accounts').select('id,provider,display_name,connection_status').order('created_at',{ascending:true}),
      supabase.from('categories').select('id,name,kind,user_id').or('user_id.is.null,user_id.eq.'+userId).order('name'),
      supabase.from('transactions').select('id,title,amount,direction,occurred_at,description,wallet_id,category_id,wallet_accounts(display_name),categories(name)').order('occurred_at',{ascending:false}).limit(500),
      supabase.from('budgets').select('id,name,amount,period,starts_on,category_id,categories(name)').order('starts_on',{ascending:false}),
      supabase.from('recurring_items').select('id,title,amount,direction,frequency,next_due_on,end_on,reminder_days,wallet_id,category_id,notes,is_active,wallet_accounts(display_name),categories(name)').order('next_due_on',{ascending:true}),
      supabase.from('bank_connection_requests').select('id,institution_code,institution_name,access_status,created_at').order('created_at',{ascending:false})
    ])
    const err=w.error||c.error||t.error||b.error||r.error||br.error
    if(err)setNotice(err.message)
    if(!c.error&&(!c.data||c.data.length===0)){
      const seeded=await supabase.from('categories').insert(defaultCategories.map(cat=>({...cat,user_id:userId})))
      if(seeded.error)setNotice(seeded.error.message)
      else {const refreshed=await supabase.from('categories').select('id,name,kind,user_id').or('user_id.is.null,user_id.eq.'+userId).order('name');if(!refreshed.error)c.data=refreshed.data}
    }
    setWallets((w.data||[]) as WalletRow[])
    setCategories((c.data||[]) as CategoryRow[])
    setTransactions((t.data||[]) as unknown as TxRow[])
    setBudgets((b.data||[]) as unknown as BudgetRow[])
    setRecurringItems((r.data||[]) as unknown as RecurringRow[])
    setBankRequests((br.data||[]) as BankRequestRow[])
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
  const insightStart=useMemo(()=>{
    const d=new Date();d.setHours(0,0,0,0)
    if(insightRange==='7d')d.setDate(d.getDate()-6)
    else if(insightRange==='30d')d.setDate(d.getDate()-29)
    else if(insightRange==='90d')d.setDate(d.getDate()-89)
    else if(insightRange==='month')d.setDate(1)
    else return null
    return d
  },[insightRange])
  const insightTx=transactions.filter(t=>!insightStart||new Date(t.occurred_at)>=insightStart)
  const insightIncome=insightTx.filter(t=>t.direction==='incoming').reduce((s,t)=>s+Number(t.amount),0)
  const insightExpense=insightTx.filter(t=>t.direction==='outgoing').reduce((s,t)=>s+Number(t.amount),0)
  const categorySpend=Object.values(insightTx.filter(t=>t.direction==='outgoing').reduce((acc,t)=>{
    const name=t.categories?.name||'Uncategorized'
    acc[name]=(acc[name]||0)+Number(t.amount);return acc
  },{} as Record<string,number>)).length
    ? Object.entries(insightTx.filter(t=>t.direction==='outgoing').reduce((acc,t)=>{
        const name=t.categories?.name||'Uncategorized';acc[name]=(acc[name]||0)+Number(t.amount);return acc
      },{} as Record<string,number>)).map(([name,amount])=>({name,amount})).sort((x,y)=>y.amount-x.amount)
    : []
  const monthlyTrend=Array.from({length:6},(_,i)=>{
    const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-(5-i))
    const next=new Date(d);next.setMonth(next.getMonth()+1)
    const rows=transactions.filter(t=>new Date(t.occurred_at)>=d&&new Date(t.occurred_at)<next)
    return {month:d.toLocaleDateString('en-PK',{month:'short'}),income:rows.filter(t=>t.direction==='incoming').reduce((s,t)=>s+Number(t.amount),0),expenses:rows.filter(t=>t.direction==='outgoing').reduce((s,t)=>s+Number(t.amount),0)}
  })
  const topExpenses=insightTx.filter(t=>t.direction==='outgoing').sort((x,y)=>Number(y.amount)-Number(x.amount)).slice(0,5)

  const chartData=Array.from({length:7},(_,i)=>{
    const d=new Date();d.setDate(d.getDate()-(6-i));d.setHours(0,0,0,0)
    const next=new Date(d);next.setDate(next.getDate()+1)
    const day=transactions.filter(t=>new Date(t.occurred_at)>=d&&new Date(t.occurred_at)<next)
    return {day:d.toLocaleDateString('en',{weekday:'short'}),in:day.filter(t=>t.direction==='incoming').reduce((s,t)=>s+Number(t.amount),0),out:day.filter(t=>t.direction==='outgoing').reduce((s,t)=>s+Number(t.amount),0)}
  })

  const resetRecurringForm=(item?:RecurringRow)=>{
    setEditingRecurring(item||null);setRecurringTitle(item?.title||'');setRecurringAmount(item?String(item.amount):'')
    setRecurringDirection(item?.direction||'outgoing');setRecurringFrequency(item?.frequency||'monthly')
    setRecurringDue(item?.next_due_on||new Date().toISOString().slice(0,10));setRecurringEnd(item?.end_on||'')
    setRecurringReminder(String(item?.reminder_days??3));setRecurringWallet(item?.wallet_id||'')
    setRecurringCategory(item?.category_id||'');setRecurringNotes(item?.notes||'')
  }
  const saveRecurring=async(e:React.FormEvent)=>{
    e.preventDefault();if(!supabase||!recurringTitle.trim()||Number(recurringAmount)<=0)return
    if(recurringEnd&&recurringEnd<recurringDue){setNotice('End date must be on or after the first due date.');return}
    setSaving(true)
    const payload={user_id:userId,title:recurringTitle.trim(),amount:Number(recurringAmount),direction:recurringDirection,frequency:recurringFrequency,next_due_on:recurringDue,end_on:recurringEnd||null,reminder_days:Number(recurringReminder),wallet_id:recurringWallet||null,category_id:recurringCategory||null,notes:recurringNotes.trim()||null}
    const result=editingRecurring?await supabase.from('recurring_items').update(payload).eq('id',editingRecurring.id).eq('user_id',userId):await supabase.from('recurring_items').insert(payload)
    setSaving(false)
    if(result.error){setNotice(result.error.message);return}
    setModal(null);setNotice(editingRecurring?'Recurring item updated.':'Recurring item added.');resetRecurringForm();await loadData()
  }
  const toggleRecurring=async(item:RecurringRow)=>{
    if(!supabase)return
    const {error}=await supabase.from('recurring_items').update({is_active:!item.is_active}).eq('id',item.id).eq('user_id',userId)
    if(error)setNotice(error.message);else{setNotice(item.is_active?'Reminder paused.':'Reminder resumed.');await loadData()}
  }
  const removeRecurring=async(id:string)=>{
    if(!supabase||!window.confirm('Delete this recurring item? Past recorded transactions will remain.'))return
    const {error}=await supabase.from('recurring_items').delete().eq('id',id).eq('user_id',userId)
    if(error)setNotice(error.message);else{setNotice('Recurring item deleted.');await loadData()}
  }
  const recordRecurring=async(item:RecurringRow)=>{
    if(!supabase)return
    setSaving(true)
    const occurrence=item.next_due_on
    const {data:existing,error:lookupError}=await supabase.from('transactions').select('id').eq('recurring_item_id',item.id).eq('recurring_occurrence_on',occurrence).maybeSingle()
    if(lookupError){setSaving(false);setNotice(lookupError.message);return}
    if(!existing){
      const {error}=await supabase.from('transactions').insert({user_id:userId,title:item.title,amount:item.amount,direction:item.direction,occurred_at:new Date(occurrence+'T12:00:00').toISOString(),wallet_id:item.wallet_id,category_id:item.category_id,description:item.notes,source:'manual',currency:'PKR',recurring_item_id:item.id,recurring_occurrence_on:occurrence})
      if(error){setSaving(false);setNotice(error.message);return}
    }
    const next=addFrequency(occurrence,item.frequency)
    const stillActive=!item.end_on||next<=item.end_on
    const {error:updateError}=await supabase.from('recurring_items').update({next_due_on:stillActive?next:occurrence,is_active:stillActive}).eq('id',item.id).eq('user_id',userId)
    setSaving(false)
    if(updateError){setNotice('Transaction recorded, but schedule update failed: '+updateError.message);await loadData();return}
    setNotice('Transaction recorded for '+item.title+'.');await loadData()
  }
  const addBankToTracker=async(bank:BankInstitution)=>{
    if(!supabase)return
    setSaving(true)
    const {error}=await supabase.from('bank_connection_requests').upsert({user_id:userId,institution_code:bank.code,institution_name:bank.name,access_status:'provider_access_required'},{onConflict:'user_id,institution_code',ignoreDuplicates:true})
    setSaving(false)
    if(error){setNotice(error.message);return}
    setNotice(bank.name+' added to your official API access tracker. No bank login details were requested or stored.')
    await loadData()
  }
  const removeBankFromTracker=async(id:string)=>{
    if(!supabase)return
    const {error}=await supabase.from('bank_connection_requests').delete().eq('id',id).eq('user_id',userId)
    if(error)setNotice(error.message);else{setNotice('Bank removed from your access tracker.');await loadData()}
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
  const saveCategory=async(e:React.FormEvent)=>{
    e.preventDefault();if(!supabase||!categoryName.trim())return
    setSaving(true)
    const payload={name:categoryName.trim(),kind:categoryKind,user_id:userId}
    const result=editingCategory?await supabase.from('categories').update(payload).eq('id',editingCategory.id).eq('user_id',userId):await supabase.from('categories').insert(payload)
    setSaving(false)
    if(result.error){setNotice(result.error.message);return}
    setCategoryName('');setEditingCategory(null);setModal(null);setNotice('Category saved.');await loadData()
  }
  const removeCategory=async(id:string)=>{
    if(!supabase||!window.confirm('Delete this category? Transactions and budgets using it will become uncategorized.'))return
    const {error}=await supabase.from('categories').delete().eq('id',id).eq('user_id',userId)
    if(error)setNotice(error.message);else{setNotice('Category deleted.');await loadData()}
  }
  const saveBudget=async(e:React.FormEvent)=>{
    e.preventDefault();if(!supabase||!budgetName.trim()||Number(budgetAmount)<=0)return
    setSaving(true)
    const payload={user_id:userId,name:budgetName.trim(),amount:Number(budgetAmount),period:budgetPeriod,starts_on:budgetStart,category_id:budgetCategory||null}
    const {error}=editingBudget?await supabase.from('budgets').update(payload).eq('id',editingBudget.id):await supabase.from('budgets').insert(payload)
    setSaving(false)
    if(error){setNotice(error.message);return}
    setBudgetName('');setBudgetAmount('');setBudgetCategory('');setEditingBudget(null);setModal(null);setNotice(editingBudget?'Budget updated.':'Budget created.');await loadData()
  }
  const removeBudget=async(id:string)=>{
    if(!supabase||!window.confirm('Delete this budget?'))return
    const {error}=await supabase.from('budgets').delete().eq('id',id)
    if(error)setNotice(error.message);else{setNotice('Budget deleted.');await loadData()}
  }
  const budgetSpent=(budget:BudgetRow)=>{
    const now=new Date()
    const configuredStart=new Date(budget.starts_on+'T00:00:00')
    const periodStart=new Date(now)
    if(budget.period==='monthly'){periodStart.setDate(1);periodStart.setHours(0,0,0,0)}
    else {periodStart.setDate(now.getDate()-((now.getDay()+6)%7));periodStart.setHours(0,0,0,0)}
    const start=configuredStart>periodStart?configuredStart:periodStart
    return transactions.filter(t=>t.direction==='outgoing'&&(!budget.category_id||t.category_id===budget.category_id)&&new Date(t.occurred_at)>=start&&new Date(t.occurred_at)<=now).reduce((sum,t)=>sum+Number(t.amount),0)
  }

  const handleCsvFile=async(file?:File)=>{
    setImportRows([]);setImportInvalid(0);setImportError('');setImportFileName(file?.name||'')
    if(!file)return
    if(!importInstitution){setImportError('Please select your bank or wallet before choosing a statement.');return}
    try{
      let parsed:string[][]
      if(file.name.toLowerCase().endsWith('.csv')) parsed=parseCsvText(await file.text())
      else if(file.name.toLowerCase().endsWith('.pdf')){
        const extracted=await extractPdfStatementRows(file)
        parsed=[['Date','Title','Type','Amount'],...extracted.map(r=>[r.date,r.title,r.type,String(r.amount)])]
        if(extracted.length===0){setImportError('No readable transaction rows were detected. This may be a scanned PDF or an unsupported statement layout. Try a text-based PDF or CSV export.');return}
      } else {setImportError('Please choose a CSV or PDF statement.');return}
      if(parsed.length<2){setImportError('This statement has no transaction rows.');return}
      const headerRowIndex=file.name.toLowerCase().endsWith('.csv')?parsed.findIndex(row=>{const cells=row.map(v=>v.toLowerCase().replace(/^\uFEFF/,'').trim());return (cells.includes('timestamp')||cells.includes('date')||cells.includes('transaction date'))&&cells.includes('description')&&cells.includes('amount')}):0
      if(headerRowIndex<0){setImportError('Could not find the transaction table in this CSV.');return}
      const headers=parsed[headerRowIndex].map(h=>h.toLowerCase().replace(/^\uFEFF/,'').trim())
      const idx=(...names:string[])=>headers.findIndex(h=>names.includes(h))
      const dateIdx=idx('date','timestamp','transaction date','value date','occurred_at','datetime','transaction datetime')
      const titleIdx=idx('title','description','transaction','name','narration','particulars','transaction details','details')
      const typeIdx=idx('type','direction','transaction type')
      const amountIdx=idx('amount','value')
      const debitIdx=idx('debit','debit amount','withdrawal','withdrawals','withdrawal amount','dr')
      const creditIdx=idx('credit','credit amount','deposit','deposits','deposit amount','cr')
      const categoryIdx=idx('category')
      const walletIdx=idx('wallet','account')
      if(dateIdx<0||titleIdx<0||(typeIdx<0&&amountIdx<0&&debitIdx<0&&creditIdx<0)){setImportError('Could not identify statement columns. Use Date, Description, Type, Amount, or Debit and Credit columns.');return}
      const seen=new Set<string>()
      const valid:CsvImportRow[]=[];let invalid=0
      parsed.slice(headerRowIndex+1).forEach((cells,i)=>{
        const description=cells[titleIdx]||''
        const amountCell=amountIdx>=0?cells[amountIdx]||'':''
        const debit=debitIdx>=0?Number((cells[debitIdx]||'').replace(/[,\s]/g,'')):0
        const credit=creditIdx>=0?Number((cells[creditIdx]||'').replace(/[,\s]/g,'')):0
        const amount=amountCell?Math.abs(Number(amountCell.replace(/[,\s]/g,''))):credit>0?credit:debit
        const type=typeIdx>=0?(cells[typeIdx]||'').toLowerCase():''
        const signedAmount=amountCell.trim()
        const direction=signedAmount.startsWith('-')?'outgoing':signedAmount.startsWith('+')?'incoming':type==='income'||type==='incoming'||type==='credit'||type==='raast in'||type==='ibft in'||type.includes('received')||type.includes('reversal')||type.includes('refund')?'incoming':type==='expense'||type==='outgoing'||type==='debit'||type==='raast out'||type.includes('sent')||type.includes('top-up')||type.includes('payment')?'outgoing':credit>0?'incoming':debit>0?'outgoing':null
        const title=[type,description.split(/\r?\n/)[0]].filter(Boolean).join(' · ')
        const dateValue=cells[dateIdx]||''
        const date=parseStatementDate(dateValue)
        if(!title||!Number.isFinite(amount)||amount<=0||!direction||!dateValue||Number.isNaN(date.getTime())){invalid++;return}
        const categoryLabel=categoryIdx>=0?(cells[categoryIdx]||''):''
        const walletLabel=walletIdx>=0?(cells[walletIdx]||''):''
        const category=categories.find(c=>c.kind===(direction==='incoming'?'income':'expense')&&c.name.toLowerCase()===categoryLabel.toLowerCase())
        const wallet=wallets.find(w=>w.display_name.toLowerCase()===walletLabel.toLowerCase())||wallets.find(w=>w.id===importWalletId)
        const fingerprint=[title.trim().toLowerCase(),amount,direction,date.toISOString()].join('|')
        if(seen.has(fingerprint)){invalid++;return}
        seen.add(fingerprint)
        valid.push({title:title.trim(),amount,direction,occurred_at:date.toISOString(),category_id:category?.id||null,wallet_id:wallet?.id||null,categoryLabel,walletLabel,line:i+2})
      })
      setImportRows(valid);setImportInvalid(invalid)
      if(!valid.length)setImportError('No valid transactions found. Check your CSV columns and values.')
    }catch{setImportError('Could not read this statement. Please try another PDF or CSV export.')}
  }
  const confirmCsvImport=async()=>{
    if(!supabase||!importRows.length)return
    setSaving(true);setImportError('')
    const existing=new Set(transactions.map(t=>[t.title.trim().toLowerCase(),Number(t.amount),t.direction,new Date(t.occurred_at).toISOString()].join('|')))
    const unique=importRows.filter(r=>!existing.has([r.title.toLowerCase(),r.amount,r.direction,r.occurred_at].join('|')))
    const skipped=importRows.length-unique.length
    let inserted=0
    for(let i=0;i<unique.length;i+=250){
      const batch=unique.slice(i,i+250).map(r=>({user_id:userId,title:r.title,amount:r.amount,direction:r.direction,occurred_at:r.occurred_at,category_id:r.category_id,wallet_id:r.wallet_id,description:[`Imported from ${bankInstitutions.find(b=>b.code===importInstitution)?.name||(importInstitution==='cash-other'?'Cash / Other':importInstitution)}`,r.categoryLabel&&!r.category_id?'Imported category: '+r.categoryLabel:'',r.walletLabel&&!r.wallet_id?'Imported wallet: '+r.walletLabel:''].filter(Boolean).join(' · '),source:'statement_import',currency:'PKR'}))
      const {error}=await supabase.from('transactions').insert(batch)
      if(error){setImportError('Import stopped after '+inserted+' rows: '+error.message);setSaving(false);await loadData();return}
      inserted+=batch.length
    }
    setSaving(false);setImportRows([]);setImportFileName('');setImportInvalid(0);setImportInstitution('');setImportWalletId('');setNotice(inserted+' transactions imported'+(skipped?' · '+skipped+' duplicates skipped':'')+(importInvalid?' · '+importInvalid+' invalid rows skipped':'' )+'.');await loadData()
  }
  const downloadCsvTemplate=()=>{
    const csv='Date,Title,Type,Category,Wallet,Amount\n2026-11-04T10:30:00,Grocery shopping,expense,Food,My NayaPay,1500\n2026-11-04T12:00:00,Salary,income,Salary,My NayaPay,50000'
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='my-finance-import-template.csv';a.click();URL.revokeObjectURL(url)
  }
  const exportCsv=()=>{
    const rows=[['Date','Title','Type','Category','Wallet','Amount'],...filtered.map(t=>[t.occurred_at,t.title,t.direction,t.categories?.name||'',t.wallet_accounts?.display_name||'',String(t.amount)])]
    const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n')
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='my-finance-transactions.csv';a.click();URL.revokeObjectURL(url)
  }
  const nav=[{label:'Overview',icon:Home},{label:'Transactions',icon:CreditCard},{label:'Bank connections',icon:Building2},{label:'Categories',icon:Tag},{label:'Budgets',icon:Target},{label:'Recurring',icon:Bell},{label:'Insights',icon:TrendingUp}]
  const go=(label:string)=>{setActive(label);setMobileNav(false)}
    return <div className="app-shell">
    <aside className={mobileNav?'sidebar open':'sidebar'}>
      <div className="brand"><div className="brand-mark"><Wallet size={21}/></div><div><b>my finance</b><span>PERSONAL MONEY</span></div><button className="mobile-close icon-btn" onClick={()=>setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div><nav>{nav.map(item=><button key={item.label} className={active===item.label?'nav-item active':'nav-item'} onClick={()=>go(item.label)}><item.icon size={18}/><span>{item.label}</span>{item.label==='Transactions'&&<small>{transactions.length}</small>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18}/></div><b>Need a hand?</b><p>Track your money in one calm place.</p><button onClick={()=>go('Bank connections')}>Manage accounts ↗</button></div><button className={active==='Settings'?'nav-item active':'nav-item'} onClick={()=>go('Settings')}><Settings size={18}/>Settings</button><div className="profile"><div className="avatar">{(userEmail[0]||'U').toUpperCase()}</div><div className="profile-copy"><b>{userEmail||'My account'}</b><span>Personal workspace</span></div><button className="signout-btn" onClick={onSignOut} title="Sign out" aria-label="Sign out"><LogOut size={17}/></button></div></div>
    </aside>
    {mobileNav&&<button className="scrim" onClick={()=>setMobileNav(false)} aria-label="Close navigation"/>}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu" onClick={()=>setMobileNav(true)}><Menu size={20}/></button><div className="breadcrumb">Workspace <span>/</span> <b>{active}</b></div></div><div className="top-actions"><div className="sync-status"><span style={{background:'#269d79'}}/> Live database</div><button className="icon-btn notification" onClick={()=>setNotice('You are all caught up.')}><Bell size={19}/></button><div className="avatar small">{(userEmail[0]||'U').toUpperCase()}</div></div></header>
      <div className="content">
        <div className="welcome-row"><div><div className="eyebrow">{now.toLocaleDateString('en-PK',{weekday:'long',year:'numeric',month:'long',day:'numeric'}).toUpperCase()}</div><h1>{active==='Overview'?'Your money, clearly':active}<span>.</span></h1><p>{active==='Overview'?'Here’s what’s happening with your money.':'Manage your personal finance records.'}</p></div><div className="welcome-actions"><button className="primary-btn" onClick={()=>setModal('transaction')}><Plus size={17}/> Add transaction</button></div></div>
        {notice&&<div className="notice"><ShieldCheck size={17}/><span>{notice}</span><button onClick={()=>setNotice('')}><X size={16}/></button></div>}
        {active==='Overview'&&<><section className="summary-grid">
          <div className="balance-card"><div className="card-top"><span title="Total recorded income minus total recorded expenses across all dates">Net recorded balance <small className="balance-explainer">· all time, not live bank balance</small></span><button className="balance-eye" onClick={()=>setShowBalance(!showBalance)}>{showBalance?<Eye size={17}/>:<EyeOff size={17}/>}</button></div><div className="balance-value">{showBalance?'Rs. '+money(totalBalance):'••••••'}</div><div className="balance-meta"><span>{transactions.length} recorded transactions · income minus expenses</span></div><div className="balance-footer"><div><span>TRACKED ACCOUNTS</span><b>{wallets.length} accounts</b></div><div className="balance-art"><div/><div/><div/></div></div></div>
          <div className="stat-card"><div className="stat-head"><span>Money received</span><div className="stat-icon green"><ArrowDownLeft size={18}/></div></div><b>Rs. {money(received)}</b><div className="stat-foot"><span>this month</span></div><div className="mini-bars green-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div>
          <div className="stat-card"><div className="stat-head"><span>Money spent</span><div className="stat-icon orange"><ArrowUpRight size={18}/></div></div><b>Rs. {money(spent)}</b><div className="stat-foot"><span>this month</span></div><div className="mini-bars orange-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div>
        </section>
        <section className="wallet-section"><div className="section-heading"><div><h2>Your accounts</h2><p>Accounts and statement imports are managed in one place.</p></div><button className="text-btn" onClick={()=>go('Bank connections')}>View accounts <span>→</span></button></div><div className="account-summary-strip"><div><Building2 size={18}/><span>{wallets.length} tracked accounts</span></div><button className="text-btn" onClick={()=>go('Bank connections')}>Manage in Bank Connections →</button></div></section>
        <section className="lower-grid"><div className="panel activity-panel"><div className="section-heading"><div><h2>Money activity</h2><p>Incoming and outgoing · last 7 days.</p></div></div><div className="chart-legend"><span><i className="legend-in"/> Received</span><span><i className="legend-out"/> Spent</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:10,right:5,left:-24,bottom:0}}><defs><linearGradient id="received" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#269d79" stopOpacity={.2}/><stop offset="100%" stopColor="#269d79" stopOpacity={0}/></linearGradient><linearGradient id="spent" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e6a45c" stopOpacity={.18}/><stop offset="100%" stopColor="#e6a45c" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#edf0f3" vertical={false}/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'#9aa3af',fontSize:11}} dy={9}/><Tooltip formatter={(v:any)=>['Rs. '+money(Number(v)),'']} contentStyle={{borderRadius:12,border:'1px solid #edf0f3',fontSize:12}}/><Area type="monotone" dataKey="in" stroke="#269d79" strokeWidth={2.5} fill="url(#received)"/><Area type="monotone" dataKey="out" stroke="#e6a45c" strokeWidth={2.5} fill="url(#spent)"/></AreaChart></ResponsiveContainer></div></div>
          <div className="panel insight-panel"><div className="insight-title"><div className="spark-icon"><Zap size={17}/></div><div><h2>Getting started</h2><p>Your finance workspace</p></div></div><div className="spend-total">{transactions.length} <span>transactions saved</span></div><div className="insight-tip"><ShieldCheck size={15}/><span>Start by adding your wallets, then record income and expenses. You can import statements in a later update.</span></div></div></section></>}
        {active==='Transactions'&&<section className="panel transactions-panel"><div className="section-heading transaction-heading"><div><h2>All transactions</h2><p>Your saved income and expenses.</p></div><button className="text-btn" onClick={()=>setModal('transaction')}><Plus size={15}/> Add new</button></div><div className="transaction-tools"><div className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search transactions"/></div><select value={walletFilter} onChange={e=>setWalletFilter(e.target.value)}><option value="all">All wallets</option>{wallets.map(w=><option key={w.id} value={w.id}>{w.display_name}</option>)}</select><div className="statement-import-controls"><select aria-label="Select bank or wallet first" value={importInstitution} onChange={e=>{setImportInstitution(e.target.value);setImportRows([]);setImportError('')}}><option value="">1. Select bank / wallet</option>{bankInstitutions.filter(b=>b.code!=='raast-open-banking').map(b=><option key={b.code} value={b.code}>{b.name}</option>)}<option value="cash-other">Cash / Other</option></select><select aria-label="Link imported transactions to wallet" value={importWalletId} onChange={e=>setImportWalletId(e.target.value)}><option value="">No wallet link</option>{wallets.map(w=><option key={w.id} value={w.id}>{w.display_name}</option>)}</select><button type="button" className="filter-btn import-file-btn" onClick={()=>{if(!importInstitution){setImportError('Please select your bank or wallet first, then tap Import PDF / CSV.');return}statementFileInputRef.current?.click()}}><Upload size={15}/> Import PDF / CSV</button><input ref={statementFileInputRef} className="statement-file-input" type="file" accept=".csv,text/csv,.pdf,application/pdf" onChange={e=>{void handleCsvFile(e.target.files?.[0]);e.currentTarget.value=''}}/></div><button className="filter-btn" onClick={exportCsv}><Download size={15}/> Export CSV</button></div>{importError&&<div className="import-error">{importError}</div>}{importRows.length>0&&<div className="csv-preview"><div className="csv-preview-head"><div><b>{importFileName||'Statement preview'}</b><span>{bankInstitutions.find(b=>b.code===importInstitution)?.name||(importInstitution==='cash-other'?'Cash / Other':'Selected provider')} · {importRows.length} valid rows · {importInvalid} invalid rows will be skipped</span></div><div><button className="text-btn" onClick={downloadCsvTemplate}>Download template</button><button className="row-action" onClick={()=>{setImportRows([]);setImportFileName('');setImportError('')}} title="Cancel import"><X size={16}/></button></div></div><div className="csv-preview-table"><div className="csv-preview-row csv-preview-header"><span>Date</span><span>Description</span><span>Type</span><span>Amount</span></div>{importRows.slice(0,5).map(r=><div className="csv-preview-row" key={r.line}><span>{new Date(r.occurred_at).toLocaleDateString('en-PK')}</span><span>{r.title}</span><span>{r.direction==='incoming'?'Income':'Expense'}</span><span>Rs. {money(r.amount)}</span></div>)}</div>{importRows.length>5&&<p className="form-hint">Showing first 5 of {importRows.length} rows. Source: {bankInstitutions.find(b=>b.code===importInstitution)?.name||'Cash / Other'}.</p>}<div className="csv-preview-actions"><button className="secondary-btn" onClick={()=>{setImportRows([]);setImportFileName('')}}>Cancel</button><button className="primary-btn" disabled={saving} onClick={()=>void confirmCsvImport()}>{saving?'Importing…':'Import '+importRows.length+' transactions'}</button></div></div>}<TransactionList rows={filtered} onDelete={removeTransaction}/></section>}
        {active==='Bank connections'&&<section className="panel transactions-panel bank-connections-page">
          <div className="section-heading"><div><h2>Bank connections</h2><p>Automatic bank and wallet connections are not available yet.</p></div><span className="bank-security-label"><LockKeyhole size={13}/> Coming soon</span></div>
          <section className="connected-accounts-panel"><div className="section-heading"><div><h3>Your accounts</h3><p>Imported and manually tracked accounts appear here. Live bank sync is not active yet.</p></div><span className="bank-coming-soon">{wallets.length} tracked</span></div>{wallets.length?<div className="connected-account-list">{wallets.map(w=><div className="connected-account-row" key={w.id}><div className="connected-account-icon"><Wallet size={17}/></div><div><b>{w.display_name}</b><span>{w.provider==='manual'?'Cash / Other':w.provider} · Statement/manual records</span></div><strong>{showBalance?'Rs. '+money(walletBalance(w.id)):'••••••'}</strong></div>)}</div>:<div className="empty-state">No accounts have been added through statements yet. When supported bank connections become available, connected accounts will appear here.</div>}</section>
          <div className="bank-framework-notice"><div className="bank-framework-icon"><ShieldCheck size={19}/></div><div><b>Pakistan Open Banking is moving toward a regulated model</b><p>SBP published draft Open Banking Regulations in October 2026. This is still a consultation draft—not a live universal connection service. My Finance will only activate providers after approved API access and security review.</p></div></div>
          <div className="bank-connection-grid">{bankInstitutions.map(bank=>{return <article className="bank-provider-card" key={bank.code}><div className="bank-provider-top"><div className="bank-provider-icon"><Building2 size={19}/></div><span className="bank-api-status pending">Coming soon</span></div><h3>{bank.name}</h3><p>{bank.note}</p><div className="bank-provider-footer"><span>{bank.categoryLabel}</span><span className="bank-coming-soon">Coming soon</span></div></article>})}</div>
          <div className="bank-framework-notice"><div className="bank-framework-icon"><ShieldCheck size={19}/></div><div><b>In the meantime, import a bank statement</b><p>You can upload a supported CSV or text-based PDF statement from the Transactions page. My Finance will preview the extracted entries before saving them.</p></div></div>
          <p className="insights-footnote"><LockKeyhole size={14}/> No internet-banking credentials, OTPs, access tokens or account numbers are collected by this tracker. No live sync is active.</p>
        </section>}
        {active==='Categories'&&<section className="panel transactions-panel"><div className="section-heading"><div><h2>Categories</h2><p>Organize income and expenses with your own categories.</p></div><button className="primary-btn" onClick={()=>{setEditingCategory(null);setCategoryName('');setCategoryKind('expense');setModal('category')}}><Plus size={16}/> Add category</button></div><div className="category-groups">{(['expense','income'] as const).map(kind=><div className="category-group" key={kind}><h3>{kind==='expense'?'Expense categories':'Income categories'}</h3>{categories.filter(cat=>cat.kind===kind).map(cat=><div className="category-row" key={cat.id}><span className={'category-dot '+kind}/><b>{cat.name}</b><span className="category-scope">{cat.user_id===userId?'Custom':'Default'}</span>{cat.user_id===userId&&<><button className="row-action" onClick={()=>{setEditingCategory(cat);setCategoryName(cat.name);setCategoryKind(cat.kind);setModal('category')}} title="Edit"><Pencil size={15}/></button><button className="row-action danger" onClick={()=>removeCategory(cat.id)} title="Delete"><Trash2 size={15}/></button></>}</div>)}{!categories.some(cat=>cat.kind===kind)&&<div className="empty-state">No categories yet.</div>}</div>)}</div></section>}
        {active==='Budgets'&&<section className="panel transactions-panel"><div className="section-heading"><div><h2>Your budgets</h2><p>Track category spending against weekly or monthly limits.</p></div><button className="primary-btn" onClick={()=>{setEditingBudget(null);setBudgetName('');setBudgetAmount('');setBudgetPeriod('monthly');setBudgetCategory('');setBudgetStart(new Date().toISOString().slice(0,10));setModal('budget')}}><Plus size={16}/> Create budget</button></div><div className="budget-grid">{budgets.map(b=>{const used=budgetSpent(b);const pct=Math.min(100,used/Number(b.amount)*100);const over=used>Number(b.amount);return <div className="budget-card" key={b.id}><div className="budget-card-head"><div><span className="budget-kicker">{b.period.toUpperCase()} BUDGET</span><h3>{b.name}</h3><p>{b.categories?.name||'All expenses'}</p></div><div className="budget-actions"><button className="row-action" onClick={()=>{setEditingBudget(b);setBudgetName(b.name);setBudgetAmount(String(b.amount));setBudgetPeriod(b.period);setBudgetCategory(b.category_id||'');setBudgetStart(b.starts_on);setModal('budget')}} title="Edit budget"><Pencil size={15}/></button><button className="row-action danger" onClick={()=>removeBudget(b.id)} title="Delete budget"><Trash2 size={15}/></button></div></div><div className="budget-amounts"><b>Rs. {money(used)}</b><span>of Rs. {money(Number(b.amount))}</span></div><div className="budget-progress"><i style={{width:pct+'%',background:over?'#d66b55':'#269d79'}}/></div><div className="budget-foot"><span>{Math.round(pct)}% used</span><span className={over?'budget-over':''}>{over?'Over by':'Remaining'} Rs. {money(Math.abs(Number(b.amount)-used))}</span></div></div>})}{!budgets.length&&<div className="empty-state">No budgets yet. Create a weekly or monthly budget to start tracking spending.</div>}</div></section>}

        {active==='Recurring'&&<section className="panel transactions-panel"><div className="section-heading"><div><h2>Recurring transactions & reminders</h2><p>Keep regular bills and income on a schedule. Record each occurrence with one tap.</p></div><button className="primary-btn" onClick={()=>{resetRecurringForm();setModal('recurring')}}><Plus size={16}/> Add recurring</button></div>
          <div className="recurring-summary"><div><b>{recurringItems.filter(x=>x.is_active).length}</b><span>Active schedules</span></div><div><b>{recurringItems.filter(x=>x.is_active&&dayDistance(x.next_due_on)<0).length}</b><span>Overdue</span></div><div><b>{recurringItems.filter(x=>x.is_active&&dayDistance(x.next_due_on)>=0&&dayDistance(x.next_due_on)<=x.reminder_days).length}</b><span>Due soon</span></div></div>
          <div className="recurring-list">{recurringItems.map(item=>{const days=dayDistance(item.next_due_on);const dueLabel=days<0?'Overdue by '+Math.abs(days)+' days':days===0?'Due today':days===1?'Due tomorrow':'Due in '+days+' days';const showReminder=item.is_active&&(days<=item.reminder_days);return <div className="recurring-card" key={item.id}><div className={'recurring-icon '+(item.direction==='incoming'?'income':'expense')}>{item.direction==='incoming'?<ArrowDownLeft size={18}/>:<Bell size={17}/>}</div><div className="recurring-copy"><div className="recurring-title"><b>{item.title}</b><span className={'recurring-status '+(!item.is_active?'paused':days<0?'overdue':showReminder?'due-soon':'scheduled')}>{!item.is_active?'Paused':showReminder?dueLabel:'Scheduled'}</span></div><p>{item.frequency} · {item.categories?.name||'Uncategorized'} · {item.wallet_accounts?.display_name||'No wallet'}</p><small>Next date: {new Date(item.next_due_on+'T12:00:00').toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})}{item.end_on?' · Ends '+new Date(item.end_on+'T12:00:00').toLocaleDateString('en-PK') : ''}</small></div><strong className={item.direction==='incoming'?'income-text':'expense-text'}>{item.direction==='incoming'?'+':'−'} Rs. {money(Number(item.amount))}</strong><div className="recurring-actions"><button className="row-action" onClick={()=>{resetRecurringForm(item);setModal('recurring')}} title="Edit"><Pencil size={15}/></button><button className="row-action" onClick={()=>void toggleRecurring(item)} title={item.is_active?'Pause':'Resume'}>{item.is_active?'Ⅱ':'▶'}</button><button className="row-action danger" onClick={()=>void removeRecurring(item.id)} title="Delete"><Trash2 size={15}/></button></div>{item.is_active&&<button className="record-recurring-btn" disabled={saving} onClick={()=>void recordRecurring(item)}>Record {item.direction==='incoming'?'income':'payment'} <ArrowUpRight size={14}/></button>}</div>})}{!recurringItems.length&&<div className="empty-state">No recurring items yet. Add rent, utility bills, subscriptions, salary or other regular transactions.</div>}</div>
          <p className="insights-footnote"><Bell size={14}/> Reminders appear inside this app when you open it. Push notifications and automatic bank payments are not enabled.</p>
        </section>}
        {active==='Insights'&&<div className="insights-page">
          <div className="insights-toolbar"><div><h2>Financial overview</h2><p>Reports calculated from your saved transactions.</p></div><div className="range-switch">{([{id:'7d',label:'7 days'},{id:'30d',label:'30 days'},{id:'month',label:'This month'},{id:'90d',label:'90 days'},{id:'all',label:'All time'}] as const).map(r=><button key={r.id} className={insightRange===r.id?'selected':''} onClick={()=>setInsightRange(r.id)}>{r.label}</button>)}</div></div>
          <section className="insight-summary-grid">
            <div className="insight-stat"><span>Total income</span><b className="income-text">Rs. {money(insightIncome)}</b><small>{insightTx.filter(t=>t.direction==='incoming').length} transactions</small></div>
            <div className="insight-stat"><span>Total expenses</span><b>Rs. {money(insightExpense)}</b><small>{insightTx.filter(t=>t.direction==='outgoing').length} transactions</small></div>
            <div className="insight-stat"><span>Net savings</span><b className={insightIncome-insightExpense>=0?'income-text':'expense-text'}>Rs. {money(insightIncome-insightExpense)}</b><small>Income minus expenses</small></div>
          </section>
          <section className="panel insight-chart-panel"><div className="section-heading"><div><h2>Monthly cash flow</h2><p>Income and expenses over the last six months.</p></div></div><div className="chart-legend"><span><i className="legend-in"/> Income</span><span><i className="legend-out"/> Expenses</span></div><div className="insights-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthlyTrend} margin={{top:10,right:8,left:-20,bottom:0}}><defs><linearGradient id="insightIncome" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#269d79" stopOpacity={.2}/><stop offset="100%" stopColor="#269d79" stopOpacity={0}/></linearGradient><linearGradient id="insightExpense" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e6a45c" stopOpacity={.2}/><stop offset="100%" stopColor="#e6a45c" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#edf0f3" vertical={false}/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill:'#9aa3af',fontSize:11}} dy={8}/><Tooltip formatter={(v:any)=>['Rs. '+money(Number(v)),'']}/><Area type="monotone" dataKey="income" name="Income" stroke="#269d79" strokeWidth={2.5} fill="url(#insightIncome)"/><Area type="monotone" dataKey="expenses" name="Expenses" stroke="#e6a45c" strokeWidth={2.5} fill="url(#insightExpense)"/></AreaChart></ResponsiveContainer></div></section>
          <div className="insights-detail-grid">
            <section className="panel"><div className="section-heading"><div><h2>Spending by category</h2><p>Where your money is going.</p></div></div>{categorySpend.length? <div className="category-spend-list">{categorySpend.map(c=><div className="category-spend-row" key={c.name}><div><b>{c.name}</b><span>Rs. {money(c.amount)}</span></div><div className="category-spend-track"><i style={{width:Math.min(100,c.amount/Math.max(...categorySpend.map(x=>x.amount))*100)+'%'}}/></div><small>{insightExpense?Math.round(c.amount/insightExpense*100):0}%</small></div>)}</div>:<div className="empty-state">No expense records in this period.</div>}</section>
            <section className="panel"><div className="section-heading"><div><h2>Highest expenses</h2><p>Your largest recorded outgoing transactions.</p></div></div>{topExpenses.length?topExpenses.map(t=><div className="top-expense-row" key={t.id}><div><b>{t.title}</b><span>{t.categories?.name||'Uncategorized'} · {new Date(t.occurred_at).toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})}</span></div><strong>Rs. {money(Number(t.amount))}</strong></div>):<div className="empty-state">No expenses recorded in this period.</div>}</section>
          </div>
          <p className="insights-footnote"><ShieldCheck size={14}/> Reports use your latest 500 saved transactions. All amounts are in PKR.</p>
        </div>}
        {active==='Settings'&&<section className="settings-page">
          <section className="panel settings-profile"><div className="settings-avatar">{(userEmail[0]||'U').toUpperCase()}</div><div><h2>Account profile</h2><p>{userEmail||'Signed-in account'}</p><small>Your My Finance account details</small></div></section>
          <section className="panel settings-section"><div className="settings-section-head"><div><h2>Preferences</h2><p>Control how your financial information appears.</p></div></div><div className="settings-row"><div><b>Hide balances</b><span>Mask balance amounts across Overview and account summaries.</span></div><button className={'settings-toggle '+(!showBalance?'enabled':'')} role="switch" aria-checked={!showBalance} onClick={()=>setShowBalance(!showBalance)}><i/></button></div><div className="settings-row"><div><b>Display currency</b><span>Pakistani Rupee (PKR)</span></div><span className="settings-value">PKR ₨</span></div></section>
          <section className="panel settings-section"><div className="settings-section-head"><div><h2>Security & data</h2><p>Manage account access and your records.</p></div></div><div className="settings-action-row"><div><b>Password reset</b><span>Send a secure password reset link to your email address.</span></div><button className="secondary-btn" disabled={settingsBusy} onClick={async()=>{if(!supabase||!userEmail)return;setSettingsBusy(true);const {error}=await supabase.auth.resetPasswordForEmail(userEmail,{redirectTo:window.location.origin});setSettingsBusy(false);setNotice(error?'Could not send reset email: '+error.message:'Password reset link sent to '+userEmail+'.')}}>{settingsBusy?'Sending…':'Send reset link'}</button></div><div className="settings-action-row"><div><b>Export transactions</b><span>Download your currently filtered transaction list as CSV.</span></div><button className="secondary-btn" onClick={exportCsv}><Download size={14}/> Export CSV</button></div><div className="settings-action-row"><div><b>Sign out</b><span>End your current My Finance session.</span></div><button className="secondary-btn settings-signout" onClick={onSignOut}><LogOut size={14}/> Sign out</button></div></section>
          <p className="insights-footnote"><ShieldCheck size={14}/> Currency is currently PKR throughout the app. Multi-currency support is not enabled.</p>
        </section>}
        {loadingData&&<div className="loading-inline">Loading your financial records…</div>}
        <footer><span>© 2026 My Finance</span><span><ShieldCheck size={13}/> Your financial data stays yours.</span></footer>
      </div>
    </main>
    {modal&&<div className="modal-backdrop" onClick={()=>setModal(null)}><div className="finance-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><h2>{modal==='category'?(editingCategory?'Edit category':'Add category'):modal==='budget'?'Create budget':modal==='recurring'?(editingRecurring?'Edit recurring item':'Add recurring item'):'Add transaction'}</h2><button className="icon-btn" onClick={()=>setModal(null)}><X size={19}/></button></div>
      {modal==='category'?<form onSubmit={saveCategory}><label>Category name</label><input required maxLength={40} value={categoryName} onChange={e=>setCategoryName(e.target.value)} placeholder="e.g. Groceries"/><label>Category type</label><select value={categoryKind} onChange={e=>setCategoryKind(e.target.value as 'income'|'expense')}><option value="expense">Expense</option><option value="income">Income</option></select><button className="primary-btn" disabled={saving}>{saving?'Saving…':editingCategory?'Update category':'Save category'}</button></form>:modal==='budget'?<form onSubmit={saveBudget}><label>Budget name</label><input required maxLength={60} value={budgetName} onChange={e=>setBudgetName(e.target.value)} placeholder="e.g. Monthly groceries"/><label>Budget amount (PKR)</label><input required type="number" min="1" step="1" value={budgetAmount} onChange={e=>setBudgetAmount(e.target.value)} placeholder="15000"/><label>Period</label><select value={budgetPeriod} onChange={e=>setBudgetPeriod(e.target.value as 'weekly'|'monthly')}><option value="monthly">Monthly</option><option value="weekly">Weekly</option></select><label>Category (optional)</label><select value={budgetCategory} onChange={e=>setBudgetCategory(e.target.value)}><option value="">All expenses</option>{categories.filter(cat=>cat.kind==='expense').map(cat=><option key={cat.id} value={cat.id}>{cat.name}</option>)}</select><label>Start date</label><input required type="date" value={budgetStart} onChange={e=>setBudgetStart(e.target.value)}/><button className="primary-btn" disabled={saving}>{saving?'Saving…':editingBudget?'Update budget':'Create budget'}</button></form>
:modal==='recurring'?<form onSubmit={saveRecurring}><label>What is this for?</label><input required maxLength={80} value={recurringTitle} onChange={e=>setRecurringTitle(e.target.value)} placeholder="e.g. House rent / Internet bill / Salary"/><label>Type</label><select value={recurringDirection} onChange={e=>{const v=e.target.value as 'incoming'|'outgoing';setRecurringDirection(v);setRecurringCategory('')}}><option value="outgoing">Expense / Bill</option><option value="incoming">Income</option></select><label>Amount (PKR)</label><input required type="number" min="0.01" step="0.01" value={recurringAmount} onChange={e=>setRecurringAmount(e.target.value)} placeholder="0.00"/><label>Repeat</label><select value={recurringFrequency} onChange={e=>setRecurringFrequency(e.target.value as RecurringRow['frequency'])}><option value="weekly">Every week</option><option value="monthly">Every month</option><option value="yearly">Every year</option></select><label>Next due date</label><input required type="date" value={recurringDue} onChange={e=>setRecurringDue(e.target.value)}/><label>End date (optional)</label><input type="date" min={recurringDue} value={recurringEnd} onChange={e=>setRecurringEnd(e.target.value)}/><label>Reminder window</label><select value={recurringReminder} onChange={e=>setRecurringReminder(e.target.value)}><option value="0">On due date</option><option value="1">1 day before</option><option value="3">3 days before</option><option value="7">7 days before</option><option value="14">14 days before</option></select><label>Wallet</label><select value={recurringWallet} onChange={e=>setRecurringWallet(e.target.value)}><option value="">No wallet selected</option>{wallets.map(w=><option key={w.id} value={w.id}>{w.display_name}</option>)}</select><label>Category</label><select value={recurringCategory} onChange={e=>setRecurringCategory(e.target.value)}><option value="">Uncategorized</option>{categories.filter(c=>c.kind===(recurringDirection==='incoming'?'income':'expense')).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><label>Notes (optional)</label><input value={recurringNotes} onChange={e=>setRecurringNotes(e.target.value)} placeholder="Account/reference details"/><button className="primary-btn" disabled={saving}>{saving?'Saving…':editingRecurring?'Update schedule':'Save schedule'}</button></form>
:
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

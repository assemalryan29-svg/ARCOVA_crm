import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

async function crmMutation(method, body) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('انتهت الجلسة.');
  const response = await fetch('/api/crm/mutate', { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'فشلت العملية.');
  return result;
}
import { can, PERMISSIONS } from '../lib/permissions';

const statusOptions = ['Pending','Done','Cancelled'];
const typeOptions = ['Call','WhatsApp','Meeting','Email','Other'];

export default function FollowupsPanel({ currentUser, userRole, leads = [] }) {
  const [followups, setFollowups] = useState([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('today');
  const [query, setQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  const load = async () => {
    const result = await supabase.from('followups').select('*, leads(name,phone)').order('followup_date', { ascending: true });
    setFollowups(result.data || []);
  };

  useEffect(() => { load(); }, []);

  const createFollowup = async (event) => {
    event.preventDefault();
    if (!can(userRole, PERMISSIONS.FOLLOWUPS_MANAGE)) return;
    const f = new FormData(event.currentTarget);
    setBusy(true);
    let result;
    try {
      result = await crmMutation('POST', { table: 'followups', data: {
        lead_id: f.get('lead_id'), assigned_to: currentUser.id,
        followup_date: new Date(f.get('followup_date')).toISOString(),
        type: f.get('type') || 'Call', status: 'Pending', notes: f.get('notes') || null
      }});
    } catch (error) { setBusy(false); alert('فشل إنشاء المتابعة: ' + error.message); return; }
    setBusy(false);
    if (!result?.success) { alert('فشل إنشاء المتابعة.'); return; }
    event.currentTarget.reset();
    await syncLeadNextFollowup(f.get('lead_id'));
    await load();
  };

  const updateStatus = async (id, status) => {
    if (!can(userRole, PERMISSIONS.FOLLOWUPS_MANAGE)) return;
    try { await crmMutation('PATCH', { table: 'followups', id, data: { status } }); } catch (error) { alert('فشل تحديث المتابعة: ' + error.message); return; }
    await load();
  };

  const syncLeadNextFollowup = async (leadId) => {
    if (!leadId) return;
    const result = await supabase.from('followups').select('followup_date').eq('lead_id', leadId).eq('status', 'Pending').order('followup_date', { ascending: true }).limit(1);
    if (result.error) throw result.error;
    const nextFollowup = result.data?.[0]?.followup_date || null;
    await crmMutation('PATCH', { table: 'leads', id: leadId, data: { next_follow_up: nextFollowup } });
  };

  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };

  const updateStatusAndSyncLead = async (item, status) => {
    if (!can(userRole, PERMISSIONS.FOLLOWUPS_MANAGE)) return;
    setBusy(true);
    try {
      await crmMutation('PATCH', { table: 'followups', id: item.id, data: { status } });
      if (item.lead_id) await syncLeadNextFollowup(item.lead_id);
      await load();
    } catch (error) { alert('فشل تحديث المتابعة: ' + error.message); }
    finally { setBusy(false); }
  };

  const snoozeOneDay = async (item) => {
    if (!can(userRole, PERMISSIONS.FOLLOWUPS_MANAGE)) return;
    const next = new Date(item.followup_date || Date.now());
    next.setDate(next.getDate() + 1);
    setBusy(true);
    try {
      await crmMutation('PATCH', { table: 'followups', id: item.id, data: { followup_date: next.toISOString(), status: 'Pending' } });
      if (item.lead_id) await syncLeadNextFollowup(item.lead_id);
      await load();
    } catch (error) { alert('فشل تأجيل المتابعة: ' + error.message); }
    finally { setBusy(false); }
  };

  const pending = followups.filter((f) => f.status === 'Pending' && f.leads?.status !== 'Archived');
  const overdue = pending.filter((f) => f.followup_date && new Date(f.followup_date) < startOfToday());
  const today = pending.filter((f) => { const d = new Date(f.followup_date); return d >= startOfToday() && d <= endOfToday(); });

  const visibleFollowups = useMemo(() => followups.filter((item) => {
    if (!showCompleted && item.status !== 'Pending') return false;
    if (item.leads?.status === 'Archived') return false;
    const needle = query.trim().toLowerCase();
    if (needle) {
      const hay = [item.leads?.name, item.leads?.phone, item.type, item.notes].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    const when = item.followup_date ? new Date(item.followup_date) : null;
    if (filter === 'overdue') return item.status === 'Pending' && when && when < startOfToday();
    if (filter === 'today') return when && when >= startOfToday() && when <= endOfToday();
    if (filter === 'upcoming') return when && when > endOfToday();
    return true;
  }), [followups, filter, query, showCompleted]);


  return (
    <div style={{ display:'grid', gap:'1rem' }}>
      {can(userRole, PERMISSIONS.FOLLOWUPS_MANAGE) && (
        <form onSubmit={createFollowup} style={{ background:'#3f321f', border:'1px solid #d9c5a4', borderRadius:'8px', padding:'0.9rem', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'0.5rem' }}>
          <select name='lead_id' required style={{ padding:'0.5rem', background:'#fffaf0', color:'#3f321f', border:'1px solid #d9c5a4', borderRadius:'5px' }}><option value=''>اختيار العميل</option>{leads.map((l)=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <input name='followup_date' type='datetime-local' required style={{ padding:'0.5rem', background:'#fffaf0', color:'#3f321f', border:'1px solid #d9c5a4', borderRadius:'5px' }} />
          <select name='type' style={{ padding:'0.5rem', background:'#fffaf0', color:'#3f321f', border:'1px solid #d9c5a4', borderRadius:'5px' }}>{typeOptions.map((type)=><option key={type}>{type}</option>)}</select>
          <input name='notes' placeholder='ملاحظات' style={{ padding:'0.5rem', background:'#fffaf0', color:'#3f321f', border:'1px solid #d9c5a4', borderRadius:'5px' }} />
          <button disabled={busy} type='submit' style={{ background:'#b08a4a', color:'#fffaf0', border:0, borderRadius:'5px', fontWeight:700 }}>إضافة متابعة</button>
        </form>
      )}
      <div style={{ background:'#fffaf0', border:'1px solid #d9c5a4', borderRadius:14, padding:12 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:8, marginBottom:10 }}>
          <div style={{background:'#fff7f2',padding:10,borderRadius:10}}><div style={{color:'#806f56',fontSize:11}}>متأخرة</div><strong style={{color:'#a7352b',fontSize:20}}>{overdue.length}</strong></div>
          <div style={{background:'#f5efe3',padding:10,borderRadius:10}}><div style={{color:'#806f56',fontSize:11}}>اليوم</div><strong style={{color:'#b08a4a',fontSize:20}}>{today.length}</strong></div>
          <div style={{background:'#eaf6ef',padding:10,borderRadius:10}}><div style={{color:'#806f56',fontSize:11}}>معلقة</div><strong style={{color:'#176b4d',fontSize:20}}>{pending.length}</strong></div>
        </div>
        <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:10}}>
          <button type='button' onClick={()=>setFilter('overdue')} style={{minHeight:40,padding:'0 12px',borderRadius:10,border:'1px solid #d9c5a4',background:filter==='overdue'?'#b08a4a':'#fffaf0',color:filter==='overdue'?'#fffaf0':'#765522',fontWeight:800}}>متأخرة ({overdue.length})</button>
          <button type='button' onClick={()=>setFilter('today')} style={{minHeight:40,padding:'0 12px',borderRadius:10,border:'1px solid #d9c5a4',background:filter==='today'?'#b08a4a':'#fffaf0',color:filter==='today'?'#fffaf0':'#765522',fontWeight:800}}>اليوم ({today.length})</button>
          <button type='button' onClick={()=>setFilter('upcoming')} style={{minHeight:40,padding:'0 12px',borderRadius:10,border:'1px solid #d9c5a4',background:filter==='upcoming'?'#b08a4a':'#fffaf0',color:filter==='upcoming'?'#fffaf0':'#765522',fontWeight:800}}>قادمة</button>
          <button type='button' onClick={()=>setFilter('all')} style={{minHeight:40,padding:'0 12px',borderRadius:10,border:'1px solid #d9c5a4',background:filter==='all'?'#b08a4a':'#fffaf0',color:filter==='all'?'#fffaf0':'#765522',fontWeight:800}}>الكل ({pending.length})</button>
          <button type='button' onClick={()=>setShowCompleted(v=>!v)} style={{minHeight:40,padding:'0 12px',borderRadius:10,border:'1px solid #d9c5a4',background:'#fffaf0',color:'#765522',fontWeight:800}}>{showCompleted?'إخفاء المكتملة':'إظهار المكتملة'}</button>
        </div>
        <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder='🔎 بحث في المتابعات باسم العميل أو الهاتف...' style={{width:'100%',boxSizing:'border-box',padding:11,marginBottom:12,background:'#fffaf0',color:'#3f321f',border:'1px solid #d9c5a4',borderRadius:10}} />
        <div style={{display:'grid',gap:8}}>
          {visibleFollowups.map((f)=>{
            const phone=String(f.leads?.phone||'').replace(/[^0-9]/g,'');
            const isOverdue=f.status==='Pending'&&f.followup_date&&new Date(f.followup_date)<startOfToday();
            return <article key={f.id} style={{background:isOverdue?'#fff7f2':'#f5efe3',border:'1px solid #d9c5a4',borderRadius:12,padding:12}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}><div><strong style={{color:'#3f321f'}}>{f.leads?.name||'عميل غير معروف'}</strong><div style={{color:'#806f56',fontSize:12,marginTop:3}}>{f.followup_date?new Date(f.followup_date).toLocaleString('ar-EG'):'بدون موعد'} · {f.type||'Call'}</div></div><span style={{color:isOverdue?'#a7352b':f.status==='Done'?'#176b4d':'#b08a4a',fontWeight:800,fontSize:12}}>{isOverdue?'متأخرة':f.status==='Done'?'مكتملة':f.status==='Cancelled'?'ملغاة':'معلقة'}</span></div>
              {f.notes&&<div style={{color:'#806f56',fontSize:12,marginTop:7}}>{f.notes}</div>}
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:7,marginTop:9}}>
                {phone&&<a href={'tel:'+phone} style={{minHeight:40,display:'grid',placeItems:'center',borderRadius:9,background:'#eaf6ef',color:'#176b4d',textDecoration:'none',fontWeight:800}}>📞 اتصال</a>}
                {phone&&<a href={'https://wa.me/'+phone} target='_blank' rel='noreferrer' style={{minHeight:40,display:'grid',placeItems:'center',borderRadius:9,background:'#eaf6ef',color:'#176b4d',textDecoration:'none',fontWeight:800}}>🟢 واتساب</a>}
                {can(userRole,PERMISSIONS.FOLLOWUPS_MANAGE)&&f.status==='Pending'&&<><button type='button' disabled={busy} onClick={()=>updateStatusAndSyncLead(f,'Done')} style={{minHeight:40,border:0,borderRadius:9,background:'#176b4d',color:'#fff',fontWeight:800}}>✅ تمت</button><button type='button' disabled={busy} onClick={()=>snoozeOneDay(f)} style={{minHeight:40,border:'1px solid #d9c5a4',borderRadius:9,background:'#fffaf0',color:'#765522',fontWeight:800}}>⏭️ تأجيل يوم</button><button type='button' disabled={busy} onClick={()=>updateStatusAndSyncLead(f,'Cancelled')} style={{minHeight:40,border:'1px solid #e2c0aa',borderRadius:9,background:'#fff7f2',color:'#a7352b',fontWeight:800}}>إلغاء</button></>}
              </div>
            </article>;
          })}
          {!visibleFollowups.length&&<div style={{color:'#806f56',padding:20,textAlign:'center',border:'1px dashed #d9c5a4',borderRadius:12}}>لا توجد متابعات في هذا العرض.</div>}
        </div>
      </div>
      <div style={{ color:'#806f56', fontSize:'0.75rem' }}>المتابعات المعلقة: {pending.length}</div>
    </div>
  );
}
import React, { useEffect, useState } from 'react';
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
    await load();
  };

  const updateStatus = async (id, status) => {
    if (!can(userRole, PERMISSIONS.FOLLOWUPS_MANAGE)) return;
    try { await crmMutation('PATCH', { table: 'followups', id, data: { status } }); } catch (error) { alert('فشل تحديث المتابعة: ' + error.message); return; }
    await load();
  };

  const pending = followups.filter((f) => f.status === 'Pending');

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
      <div style={{ display:'grid', gap:'0.5rem' }}>
        {followups.map((f)=><div key={f.id} style={{ background:'#3f321f', border:'1px solid #d9c5a4', borderRadius:'7px', padding:'0.8rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:'0.5rem', flexWrap:'wrap' }}><strong>{f.leads?.name || '—'}</strong><span style={{ color:'#b08a4a', fontSize:'0.75rem' }}>{new Date(f.followup_date).toLocaleString('ar-EG')}</span></div>
          <div style={{ color:'#806f56', fontSize:'0.75rem', marginTop:'0.3rem' }}>{f.type} · {f.notes || 'بدون ملاحظات'}</div>
          {can(userRole, PERMISSIONS.FOLLOWUPS_MANAGE) ? <select value={f.status || 'Pending'} onChange={(e)=>updateStatus(f.id,e.target.value)} style={{ marginTop:'0.5rem', padding:'0.35rem', background:'#fffaf0', color:'#b08a4a', border:'1px solid #d9c5a4', borderRadius:'4px' }}>{statusOptions.map((s)=><option key={s}>{s}</option>)}</select> : <div style={{ marginTop:'0.5rem', color:'#806f56', fontSize:'0.75rem' }}>الحالة: {f.status || 'Pending'}</div>}
        </div>)}
        {!followups.length && <div style={{ color:'#9a7b4b', background:'#3f321f', padding:'1rem', borderRadius:'8px' }}>لا توجد متابعات مسجلة.</div>}
      </div>
      <div style={{ color:'#806f56', fontSize:'0.75rem' }}>المتابعات المعلقة: {pending.length}</div>
    </div>
  );
}
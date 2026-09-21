import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

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
    if (!['admin','ceo','manager','team_leader','sales'].includes(userRole)) return;
    const f = new FormData(event.currentTarget);
    setBusy(true);
    const result = await supabase.from('followups').insert([{
      lead_id: f.get('lead_id'),
      assigned_to: currentUser.id,
      followup_date: new Date(f.get('followup_date')).toISOString(),
      type: f.get('type') || 'Call',
      status: 'Pending',
      notes: f.get('notes') || null
    }]);
    setBusy(false);
    if (result.error) { alert('فشل إنشاء المتابعة: ' + result.error.message); return; }
    event.currentTarget.reset();
    await load();
  };

  const updateStatus = async (id, status) => {
    const result = await supabase.from('followups').update({ status }).eq('id', id);
    if (result.error) { alert('فشل تحديث المتابعة: ' + result.error.message); return; }
    await load();
  };

  const pending = followups.filter((f) => f.status === 'Pending');

  return (
    <div style={{ display:'grid', gap:'1rem' }}>
      {['admin','ceo','manager','team_leader','sales'].includes(userRole) && (
        <form onSubmit={createFollowup} style={{ background:'#3f321faf0', border:'1px solid #d9c5a4', borderRadius:'8px', padding:'0.9rem', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'0.5rem' }}>
          <select name='lead_id' required style={{ padding:'0.5rem', background:'#3f321fdf8', color:'#3f321f', border:'1px solid #d9c5a4', borderRadius:'5px' }}><option value=''>اختيار العميل</option>{leads.map((l)=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <input name='followup_date' type='datetime-local' required style={{ padding:'0.5rem', background:'#3f321fdf8', color:'#3f321f', border:'1px solid #d9c5a4', borderRadius:'5px' }} />
          <select name='type' style={{ padding:'0.5rem', background:'#3f321fdf8', color:'#3f321f', border:'1px solid #d9c5a4', borderRadius:'5px' }}>{typeOptions.map((type)=><option key={type}>{type}</option>)}</select>
          <input name='notes' placeholder='ملاحظات' style={{ padding:'0.5rem', background:'#3f321fdf8', color:'#3f321f', border:'1px solid #d9c5a4', borderRadius:'5px' }} />
          <button disabled={busy} type='submit' style={{ background:'#b08a4a', color:'#3f321fdf8', border:0, borderRadius:'5px', fontWeight:700 }}>إضافة متابعة</button>
        </form>
      )}
      <div style={{ display:'grid', gap:'0.5rem' }}>
        {followups.map((f)=><div key={f.id} style={{ background:'#3f321faf0', border:'1px solid #d9c5a4', borderRadius:'7px', padding:'0.8rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', gap:'0.5rem', flexWrap:'wrap' }}><strong>{f.leads?.name || '—'}</strong><span style={{ color:'#b08a4a', fontSize:'0.75rem' }}>{new Date(f.followup_date).toLocaleString('ar-EG')}</span></div>
          <div style={{ color:'#806f56', fontSize:'0.75rem', marginTop:'0.3rem' }}>{f.type} · {f.notes || 'بدون ملاحظات'}</div>
          <select value={f.status || 'Pending'} onChange={(e)=>updateStatus(f.id,e.target.value)} style={{ marginTop:'0.5rem', padding:'0.35rem', background:'#3f321fdf8', color:'#b08a4a', border:'1px solid #d9c5a4', borderRadius:'4px' }}>{statusOptions.map((s)=><option key={s}>{s}</option>)}</select>
        </div>)}
        {!followups.length && <div style={{ color:'#9a7b4b', background:'#3f321faf0', padding:'1rem', borderRadius:'8px' }}>لا توجد متابعات مسجلة.</div>}
      </div>
      <div style={{ color:'#806f56', fontSize:'0.75rem' }}>المتابعات المعلقة: {pending.length}</div>
    </div>
  );
}
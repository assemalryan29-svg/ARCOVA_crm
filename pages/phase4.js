import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Phase4() {
  const [queue,setQueue]=useState([]);
  const [leads,setLeads]=useState({});
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  async function load(){
    setLoading(true); setError('');
    const {data:{session}}=await supabase.auth.getSession();
    if(!session?.access_token){window.location.href='/';return;}
    const r=await fetch('/api/phase4/duplicates',{headers:{Authorization:'Bearer '+session.access_token}});
    const data=await r.json().catch(()=>({}));
    if(!r.ok){setError(data.error||'تعذر تحميل قائمة التكرارات.');setLoading(false);return;}
    setQueue(data.pending||[]);setLeads(data.leads||{});setLoading(false);
  }
  useEffect(()=>{load();},[]);

  async function act(candidate_id,action){
    setBusy(candidate_id);setError('');setMessage('');
    const {data:{session}}=await supabase.auth.getSession();
    const r=await fetch('/api/phase4/duplicates',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({candidate_id,action})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok){setError(data.error||'تعذر تنفيذ العملية.');setBusy('');return;}
    setMessage(action==='approve'?'تم اعتماد الدمج ونقل العلاقات وحذف السجلات المكررة بأمان.':'تم رفض مجموعة التكرار بدون تعديل بيانات العملاء.');
    await load();setBusy('');
  }

  return <main dir="rtl" style={{minHeight:'100vh',background:'#f5efe3',color:'#3f321f',fontFamily:'Tahoma,Arial,sans-serif',padding:20}}>
    <div style={{maxWidth:1100,margin:'0 auto'}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:18}}>
        <div><h1 style={{margin:0,color:'#765522'}}>Phase 4 — مراجعة العملاء المكررين</h1><p style={{color:'#806f56'}}>لا يوجد دمج تلقائي. كل مجموعة تحتاج اعتماد Admin صريح.</p></div>
        <button onClick={load} style={{padding:'10px 16px',border:0,borderRadius:10,background:'#b08a4a',color:'#fff',fontWeight:800}}>تحديث</button>
      </header>
      {error&&<div style={{background:'#fff1ee',padding:12,borderRadius:10,color:'#a7352b',marginBottom:12}}>{error}</div>}
      {message&&<div style={{background:'#e8f4ec',padding:12,borderRadius:10,color:'#2d7a58',marginBottom:12}}>{message}</div>}
      <div style={{background:'#fffaf0',border:'1px solid #d9c5a4',borderRadius:14,padding:14,marginBottom:16}}><b>المجموعات المعلقة: {queue.length}</b><span style={{color:'#806f56',marginRight:12}}>كل Merge ينقل Activities / Follow-ups / Calls / Appointments / Deals / Reservations / Tasks إلى العميل الأساسي.</span></div>
      {loading?<p>جاري التحميل...</p>:queue.length===0?<div style={{background:'#fffaf0',padding:24,borderRadius:14}}>لا توجد مجموعات معلقة.</div>:
      <div style={{display:'grid',gap:12}}>{queue.map(c=>{
        const ids=c.duplicate_lead_ids||[];
        return <section key={c.candidate_id} style={{background:'#fffaf0',border:'1px solid #d9c5a4',borderRadius:14,padding:16}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><div><b>{c.identity_type}: {c.identity_value}</b><div style={{fontSize:12,color:'#806f56',marginTop:5}}>عدد السجلات: {c.group_size} — الأساسي المقترح: {leads[c.canonical_lead_id]?.name||c.canonical_lead_id}</div></div>
          <div style={{display:'flex',gap:8}}><button disabled={!!busy} onClick={()=>act(c.candidate_id,'approve')} style={{padding:'9px 14px',border:0,borderRadius:9,background:'#2d7a58',color:'#fff',fontWeight:800}}>{busy===c.candidate_id?'جاري...':'اعتماد الدمج'}</button><button disabled={!!busy} onClick={()=>act(c.candidate_id,'reject')} style={{padding:'9px 14px',border:0,borderRadius:9,background:'#d9c5a4',color:'#3f321f',fontWeight:800}}>رفض</button></div></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:8,marginTop:12}}>{ids.map(id=><div key={id} style={{border:'1px solid #eadcc5',borderRadius:10,padding:10}}><b>{leads[id]?.name||'غير موجود'}</b><div style={{fontSize:12,color:'#806f56'}}>Phone: {leads[id]?.phone||'-'}</div><div style={{fontSize:12,color:'#806f56'}}>Email: {leads[id]?.email||'-'}</div><div style={{fontSize:12,color:'#806f56'}}>Status: {leads[id]?.status||'-'}</div><div style={{fontSize:11,color:'#9b8b72',wordBreak:'break-all'}}>{id}</div></div>)}</div>
        </section>
      })}</div>}
    </div>
  </main>;
}

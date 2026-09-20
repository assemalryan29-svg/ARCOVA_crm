import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function ReportsPanel({ leads = [], tasks = [] }) {
  const [deals, setDeals] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    Promise.all([
      supabase.from('deals').select('deal_value,status'),
      supabase.from('reservations').select('reservation_amount,status'),
      supabase.from('deal_payments').select('amount,status,due_date')
    ]).then(([d,r,p]) => {
      setDeals(d.data || []);
      setReservations(r.data || []);
      setPayments(p.data || []);
    });
  }, []);

  const wonValue = useMemo(() => deals.filter((d) => d.status === 'Won').reduce((a,d) => a + Number(d.deal_value || 0), 0), [deals]);
  const reservedValue = useMemo(() => reservations.filter((r) => r.status !== 'Cancelled').reduce((a,r) => a + Number(r.reservation_amount || 0), 0), [reservations]);
  const pendingPayments = useMemo(() => payments.filter((p) => p.status !== 'Paid').reduce((a,p) => a + Number(p.amount || 0), 0), [payments]);
  const statusCount = useMemo(() => leads.reduce((m,l) => { const k=l.status || 'Unknown'; m[k]=(m[k]||0)+1; return m; }, {}), [leads]);
  const sourceCount = useMemo(() => leads.reduce((m,l) => { const k=l.lead_source || 'Unknown'; m[k]=(m[k]||0)+1; return m; }, {}), [leads]);

  const downloadCsv = () => {
    const rows = [['Metric','Value'],['Leads',leads.length],['Tasks',tasks.length],['Won Deals Value',wonValue],['Reservations Value',reservedValue],['Pending Payments',pendingPayments],...Object.entries(statusCount).map(([k,v])=>['Lead Status: '+k,v]),...Object.entries(sourceCount).map(([k,v])=>['Lead Source: '+k,v])];
    const csv='\uFEFF'+rows.map((row)=>row.map((x)=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='ARCOVA_Report.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const Card=({title,value})=><div style={{background:'#131822',border:'1px solid #1f2937',borderRadius:'8px',padding:'1rem'}}><div style={{color:'#9ca3af',fontSize:'0.72rem'}}>{title}</div><div style={{color:'#d4af37',fontSize:'1.35rem',fontWeight:700,marginTop:'0.25rem'}}>{value}</div></div>;

  return (
    <div style={{display:'grid',gap:'1rem'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:'0.7rem'}}>
        <Card title='إجمالي العملاء' value={leads.length}/>
        <Card title='المهام' value={tasks.length}/>
        <Card title='قيمة الصفقات الرابحة' value={wonValue.toLocaleString()+' ج'}/>
        <Card title='قيمة الحجوزات' value={reservedValue.toLocaleString()+' ج'}/>
        <Card title='الدفعات غير المسددة' value={pendingPayments.toLocaleString()+' ج'}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:'1rem'}}>
        <div style={{background:'#131822',border:'1px solid #1f2937',borderRadius:'8px',padding:'1rem'}}><h4 style={{color:'#d4af37',marginTop:0}}>مراحل العملاء</h4>{Object.entries(statusCount).map(([k,v])=><div key={k} style={{display:'flex',justifyContent:'space-between',padding:'0.3rem 0',borderBottom:'1px solid #1f2937',fontSize:'0.78rem'}}><span>{k}</span><strong>{v}</strong></div>)}</div>
        <div style={{background:'#131822',border:'1px solid #1f2937',borderRadius:'8px',padding:'1rem'}}><h4 style={{color:'#d4af37',marginTop:0}}>مصادر العملاء</h4>{Object.entries(sourceCount).map(([k,v])=><div key={k} style={{display:'flex',justifyContent:'space-between',padding:'0.3rem 0',borderBottom:'1px solid #1f2937',fontSize:'0.78rem'}}><span>{k}</span><strong>{v}</strong></div>)}</div>
      </div>
      <button type='button' onClick={downloadCsv} style={{justifySelf:'start',padding:'0.55rem 0.9rem',background:'#d4af37',color:'#0c0f17',border:0,borderRadius:'5px',fontWeight:700}}>تصدير التقرير CSV</button>
    </div>
  );
}
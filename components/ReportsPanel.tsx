import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { can, PERMISSIONS } from '../lib/permissions';

export default function ReportsPanel({ leads = [], tasks = [], userRole = 'sales' }) {
  const [deals, setDeals] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [calls, setCalls] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('deals').select('deal_value,status,created_at'),
      supabase.from('reservations').select('reservation_amount,status,created_at'),
      supabase.from('deal_payments').select('amount,status,due_date'),
      supabase.from('followups').select('status,followup_date'),
      supabase.from('calls').select('call_at,outcome'),
      supabase.from('appointments').select('scheduled_at,status'),
      supabase.from('projects').select('id,name'),
      supabase.from('units').select('id,status,price')
    ]).then(([d,r,p,f,c,a,pr,u]) => {
      if (!active) return;
      setDeals(d.data || []);
      setReservations(r.data || []);
      setPayments(p.data || []);
      setFollowups(f.data || []);
      setCalls(c.data || []);
      setAppointments(a.data || []);
      setProjects(pr.data || []);
      setUnits(u.data || []);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const now = Date.now();
  const wonValue = useMemo(() => deals.filter((d) => d.status === 'Won').reduce((a,d) => a + Number(d.deal_value || 0), 0), [deals]);
  const reservedValue = useMemo(() => reservations.filter((r) => r.status !== 'Cancelled').reduce((a,r) => a + Number(r.reservation_amount || 0), 0), [reservations]);
  const pendingPayments = useMemo(() => payments.filter((p) => p.status !== 'Paid' && p.status !== 'Cancelled').reduce((a,p) => a + Number(p.amount || 0), 0), [payments]);
  const overduePayments = useMemo(() => payments.filter((p) => p.status === 'Overdue' || (p.status === 'Pending' && p.due_date && new Date(p.due_date).getTime() < now)).length, [payments, now]);
  const pendingFollowups = useMemo(() => followups.filter((f) => f.status === 'Pending').length, [followups]);
  const overdueFollowups = useMemo(() => followups.filter((f) => f.status === 'Pending' && f.followup_date && new Date(f.followup_date).getTime() < now).length, [followups, now]);
  const upcomingAppointments = useMemo(() => appointments.filter((a) => a.status === 'Planned' && a.scheduled_at && new Date(a.scheduled_at).getTime() >= now).length, [appointments, now]);
  const pipeline = useMemo(() => leads.reduce((m,l) => { const k=l.status || 'Unknown'; m[k]=(m[k]||0)+1; return m; }, {}), [leads]);
  const sources = useMemo(() => leads.reduce((m,l) => { const k=l.lead_source || 'Unknown'; m[k]=(m[k]||0)+1; return m; }, {}), [leads]);

  const downloadCsv = () => {
    const rows = [
      ['Metric','Value'],
      ['Leads',leads.length],
      ['Followups',followups.length],
      ['Pending Followups',pendingFollowups],
      ['Overdue Followups',overdueFollowups],
      ['Calls',calls.length],
      ['Appointments',appointments.length],
      ['Upcoming Appointments',upcomingAppointments],
      ['Projects',projects.length],
      ['Units',units.length],
      ['Deals',deals.length],
      ['Won Deals Value',wonValue],
      ['Reservations Value',reservedValue],
      ['Pending Payments',pendingPayments],
      ['Overdue Payments',overduePayments],
      ...Object.entries(pipeline).map(([k,v])=>['Pipeline: '+k,v]),
      ...Object.entries(sources).map(([k,v])=>['Lead Source: '+k,v])
    ];
    const csv='\uFEFF'+rows.map((row)=>row.map((x)=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='ARCOVA_Report.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const Card=({title,value})=><div style={{background:'#3f321f',border:'1px solid #d9c5a4',borderRadius:'8px',padding:'1rem'}}><div style={{color:'#806f56',fontSize:'0.72rem'}}>{title}</div><div style={{color:'#b08a4a',fontSize:'1.35rem',fontWeight:700,marginTop:'0.25rem'}}>{value}</div></div>;

  if (loading) return <div style={{color:'#806f56'}}>جاري تحميل التقارير...</div>;

  return (
    <div style={{display:'grid',gap:'1rem'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:'0.7rem'}}>
        <Card title='العملاء' value={leads.length}/>
        <Card title='المتابعات المعلقة' value={pendingFollowups}/>
        <Card title='المتابعات المتأخرة' value={overdueFollowups}/>
        <Card title='المكالمات' value={calls.length}/>
        <Card title='المواعيد القادمة' value={upcomingAppointments}/>
        <Card title='المشاريع' value={projects.length}/>
        <Card title='الوحدات' value={units.length}/>
        <Card title='الصفقات الرابحة' value={wonValue.toLocaleString()+' ج'}/>
        <Card title='الحجوزات' value={reservedValue.toLocaleString()+' ج'}/>
        <Card title='دفعات مستحقة' value={pendingPayments.toLocaleString()+' ج'}/>
        <Card title='دفعات متأخرة' value={overduePayments}/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:'1rem'}}>
        <div style={{background:'#3f321f',border:'1px solid #d9c5a4',borderRadius:'8px',padding:'1rem'}}><h4 style={{color:'#b08a4a',marginTop:0}}>Pipeline</h4>{Object.entries(pipeline).map(([k,v])=><div key={k} style={{display:'flex',justifyContent:'space-between',padding:'.3rem 0',borderBottom:'1px solid #d9c5a4',fontSize:'.78rem'}}><span>{k}</span><strong>{v}</strong></div>)}</div>
        <div style={{background:'#3f321f',border:'1px solid #d9c5a4',borderRadius:'8px',padding:'1rem'}}><h4 style={{color:'#b08a4a',marginTop:0}}>مصادر العملاء</h4>{Object.entries(sources).map(([k,v])=><div key={k} style={{display:'flex',justifyContent:'space-between',padding:'.3rem 0',borderBottom:'1px solid #d9c5a4',fontSize:'.78rem'}}><span>{k}</span><strong>{v}</strong></div>)}</div>
      </div>

      {can(userRole, PERMISSIONS.REPORTS_EXPORT) && <button type='button' onClick={downloadCsv} style={{justifySelf:'start',padding:'.55rem .9rem',background:'#b08a4a',color:'#fffaf0',border:0,borderRadius:'5px',fontWeight:700}}>تصدير التقرير CSV</button>}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const tabs = [
  { key: 'deals', label: 'الصفقات' },
  { key: 'reservations', label: 'الحجوزات' },
  { key: 'calls', label: 'المكالمات' },
  { key: 'appointments', label: 'المواعيد' },
  { key: 'finance', label: 'المالية' }
];

export default function OperationsPanel({ currentUser, userRole, leads = [], units = [] }) {
  const [active, setActive] = useState('deals');
  const [deals, setDeals] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [calls, setCalls] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [busy, setBusy] = useState(false);
  const canFinanceView = ['admin','ceo','manager','finance'].includes(userRole);
  const canFinanceManage = ['admin','ceo','finance'].includes(userRole);
  const canOperate = ['admin','ceo','manager','team_leader','sales'].includes(userRole);

  const load = async () => {
    const results = await Promise.all([
      supabase.from('deals').select('*, leads(name), units(title,unit_number)').order('created_at', { ascending: false }),
      supabase.from('reservations').select('*, leads(name), units(title,unit_number)').order('created_at', { ascending: false }),
      supabase.from('calls').select('*, leads(name)').order('call_at', { ascending: false }),
      supabase.from('appointments').select('*, leads(name)').order('scheduled_at', { ascending: true }),
      supabase.from('deal_payments').select('*, deals(lead_id,sales_person,deal_value)').order('due_date', { ascending: true })
    ]);
    setDeals(results[0].data || []);
    setReservations(results[1].data || []);
    setCalls(results[2].data || []);
    setAppointments(results[3].data || []);
    setPayments(results[4].data || []);
  };

  useEffect(() => { load(); }, []);

  const submit = async (event, table, payload, message) => {
    event.preventDefault();
    setBusy(true);
    const result = await supabase.from(table).insert([payload]);
    setBusy(false);
    if (result.error) { alert(message + ': ' + result.error.message); return; }
    event.currentTarget.reset();
    await load();
  };

  const Input = ({ name, placeholder, type = 'text', required = false }) => <input name={name} type={type} placeholder={placeholder} required={required} style={{ padding: '0.45rem', background: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '5px', fontSize: '0.78rem' }} />;
  const selectStyle = { padding: '0.45rem', background: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '5px', fontSize: '0.78rem' };

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
        {tabs.filter((t) => t.key !== 'finance' || canFinanceView).map((t) => <button key={t.key} type='button' onClick={() => setActive(t.key)} style={{ padding: '0.5rem 0.8rem', background: active === t.key ? '#d4af37' : '#131822', color: active === t.key ? '#0c0f17' : '#d4af37', border: '1px solid #d4af37', borderRadius: '5px', cursor: 'pointer' }}>{t.label}</button>)}
      </div>

      {active === 'deals' && <div style={{ display: 'grid', gap: '0.7rem' }}>
        {canOperate && <form onSubmit={(e) => { const f=new FormData(e.currentTarget); return submit(e,'deals',{lead_id:f.get('lead_id'),unit_id:f.get('unit_id')||null,sales_person:currentUser.id,deal_value:Number(f.get('deal_value')||0),down_payment:Number(f.get('down_payment')||0),installment_months:Number(f.get('installment_months')||0),payment_frequency:f.get('payment_frequency'),status:f.get('status'),notes:f.get('notes')||null},'فشل إنشاء الصفقة'); }} style={{ background:'#131822',padding:'0.8rem',borderRadius:'8px',border:'1px solid #1f2937',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'0.45rem' }}>
          <select name='lead_id' required style={selectStyle}><option value=''>العميل</option>{leads.map((l)=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <select name='unit_id' style={selectStyle}><option value=''>الوحدة</option>{units.map((u)=><option key={u.id} value={u.id}>{u.unit_number || u.title}</option>)}</select>
          <Input name='deal_value' placeholder='قيمة الصفقة' type='number' required />
          <Input name='down_payment' placeholder='المقدم' type='number' />
          <Input name='installment_months' placeholder='مدة التقسيط بالشهور' type='number' />
          <select name='payment_frequency' style={selectStyle}><option value='monthly'>شهري</option><option value='quarterly'>ربع سنوي</option><option value='yearly'>سنوي</option></select>
          <select name='status' style={selectStyle}><option value='Pending'>Pending</option><option value='Won'>Won</option><option value='Cancelled'>Cancelled</option></select>
          <Input name='notes' placeholder='ملاحظات' />
          <button disabled={busy} type='submit' style={{ background:'#34d399', border:0, borderRadius:'5px', fontWeight:700 }}>حفظ الصفقة</button>
        </form>}
        <div style={{ display:'grid',gap:'0.5rem' }}>{deals.map((d)=><div key={d.id} style={{ background:'#131822',border:'1px solid #1f2937',borderRadius:'7px',padding:'0.7rem',fontSize:'0.78rem' }}><strong>{d.leads?.name || '—'}</strong> · {Number(d.deal_value || 0).toLocaleString()} ج · {d.status}</div>)}{!deals.length&&<div style={{color:'#64748b'}}>لا توجد صفقات.</div>}</div>
      </div>}

      {active === 'reservations' && <div style={{ display:'grid',gap:'0.7rem' }}>
        {canOperate && <form onSubmit={(e)=>{const f=new FormData(e.currentTarget);return submit(e,'reservations',{lead_id:f.get('lead_id'),unit_id:f.get('unit_id'),sales_person:currentUser.id,reservation_amount:Number(f.get('reservation_amount')||0),contract_value:Number(f.get('contract_value')||0),status:'Pending',notes:f.get('notes')||null},'فشل تسجيل الحجز');}} style={{ background:'#131822',padding:'0.8rem',borderRadius:'8px',border:'1px solid #1f2937',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'0.45rem' }}>
          <select name='lead_id' required style={selectStyle}><option value=''>العميل</option>{leads.map((l)=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <select name='unit_id' required style={selectStyle}><option value=''>الوحدة</option>{units.map((u)=><option key={u.id} value={u.id}>{u.unit_number || u.title}</option>)}</select>
          <Input name='reservation_amount' placeholder='مبلغ الحجز' type='number' required />
          <Input name='contract_value' placeholder='القيمة التعاقدية' type='number' />
          <Input name='notes' placeholder='ملاحظات' />
          <button disabled={busy} type='submit' style={{ background:'#d4af37',border:0,borderRadius:'5px',fontWeight:700 }}>تسجيل الحجز</button>
        </form>}
        <div style={{ display:'grid',gap:'0.5rem' }}>{reservations.map((r)=><div key={r.id} style={{ background:'#131822',border:'1px solid #1f2937',borderRadius:'7px',padding:'0.7rem',fontSize:'0.78rem' }}>{r.leads?.name||'—'} · {r.units?.unit_number||r.units?.title||'—'} · {Number(r.reservation_amount||0).toLocaleString()} ج · {r.status}</div>)}</div>
      </div>}

      {active === 'calls' && <div style={{ display:'grid',gap:'0.7rem' }}>
        {canOperate && <form onSubmit={(e)=>{const f=new FormData(e.currentTarget);return submit(e,'calls',{lead_id:f.get('lead_id'),assigned_to:currentUser.id,call_at:f.get('call_at')?new Date(f.get('call_at')).toISOString():new Date().toISOString(),duration_seconds:Number(f.get('duration_seconds')||0),outcome:f.get('outcome')||null,notes:f.get('notes')||null},'فشل تسجيل المكالمة');}} style={{ background:'#131822',padding:'0.8rem',borderRadius:'8px',border:'1px solid #1f2937',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'0.45rem' }}>
          <select name='lead_id' required style={selectStyle}><option value=''>العميل</option>{leads.map((l)=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <Input name='call_at' type='datetime-local' placeholder='' />
          <Input name='duration_seconds' placeholder='المدة بالثواني' type='number' />
          <Input name='outcome' placeholder='نتيجة المكالمة' />
          <Input name='notes' placeholder='ملاحظات' />
          <button disabled={busy} type='submit' style={{ background:'#60a5fa',border:0,borderRadius:'5px',fontWeight:700 }}>تسجيل المكالمة</button>
        </form>}
        <div style={{ display:'grid',gap:'0.5rem' }}>{calls.map((c)=><div key={c.id} style={{ background:'#131822',border:'1px solid #1f2937',borderRadius:'7px',padding:'0.7rem',fontSize:'0.78rem' }}>{c.leads?.name||'—'} · {c.outcome||'بدون نتيجة'} · {c.notes||''}</div>)}</div>
      </div>}

      {active === 'appointments' && <div style={{ display:'grid',gap:'0.7rem' }}>
        {canOperate && <form onSubmit={(e)=>{const f=new FormData(e.currentTarget);return submit(e,'appointments',{lead_id:f.get('lead_id'),assigned_to:currentUser.id,scheduled_at:new Date(f.get('scheduled_at')).toISOString(),type:f.get('type')||'Meeting',status:'Planned',notes:f.get('notes')||null},'فشل إنشاء الموعد');}} style={{ background:'#131822',padding:'0.8rem',borderRadius:'8px',border:'1px solid #1f2937',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'0.45rem' }}>
          <select name='lead_id' required style={selectStyle}><option value=''>العميل</option>{leads.map((l)=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <Input name='scheduled_at' type='datetime-local' placeholder='' required />
          <Input name='type' placeholder='نوع الموعد' />
          <Input name='notes' placeholder='ملاحظات' />
          <button disabled={busy} type='submit' style={{ background:'#a855f7',border:0,borderRadius:'5px',fontWeight:700 }}>حفظ الموعد</button>
        </form>}
        <div style={{ display:'grid',gap:'0.5rem' }}>{appointments.map((a)=><div key={a.id} style={{ background:'#131822',border:'1px solid #1f2937',borderRadius:'7px',padding:'0.7rem',fontSize:'0.78rem' }}>{a.leads?.name||'—'} · {new Date(a.scheduled_at).toLocaleString('ar-EG')} · {a.status}</div>)}</div>
      </div>}

      {active === 'finance' && canFinanceView && <div style={{ display:'grid',gap:'0.7rem' }}>
        {canFinanceManage && <form onSubmit={(e)=>{const f=new FormData(e.currentTarget);return submit(e,'deal_payments',{deal_id:f.get('deal_id'),installment_no:Number(f.get('installment_no')),due_date:f.get('due_date'),amount:Number(f.get('amount')),status:'Pending'},'فشل إضافة الدفعة');}} style={{ background:'#131822',padding:'0.8rem',borderRadius:'8px',border:'1px solid #1f2937',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'0.45rem' }}>
          <select name='deal_id' required style={selectStyle}><option value=''>الصفقة</option>{deals.map((d)=><option key={d.id} value={d.id}>{d.leads?.name||d.id}</option>)}</select>
          <Input name='installment_no' placeholder='رقم القسط' type='number' required />
          <Input name='due_date' placeholder='' type='date' required />
          <Input name='amount' placeholder='قيمة القسط' type='number' required />
          <button disabled={busy} type='submit' style={{ background:'#34d399',border:0,borderRadius:'5px',fontWeight:700 }}>إضافة دفعة</button>
        </form>}
        <div style={{ display:'grid',gap:'0.5rem' }}>{payments.map((p)=><div key={p.id} style={{ background:'#131822',border:'1px solid #1f2937',borderRadius:'7px',padding:'0.7rem',fontSize:'0.78rem' }}>قسط {p.installment_no} · {Number(p.amount||0).toLocaleString()} ج · {p.status} · {p.due_date}</div>)}</div>
      </div>}
    </div>
  );
}
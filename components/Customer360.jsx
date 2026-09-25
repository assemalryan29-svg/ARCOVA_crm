import { useEffect, useState } from 'react';

const labels = {
  followups: 'متابعة',
  calls: 'مكالمة',
  appointments: 'موعد',
  tasks: 'مهمة',
  reservations: 'حجز',
  deals: 'صفقة',
  opportunities: 'فرصة',
  deal_payments: 'دفعة',
  lead_activities: 'نشاط'
};

export default function Customer360({ leadId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const { supabase } = await import('../supabaseClient');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { setError('انتهت الجلسة.'); return; }
      const response = await fetch('/api/crm/customer360?lead_id=' + encodeURIComponent(leadId), {
        headers: { Authorization: 'Bearer ' + token }
      });
      const result = await response.json().catch(() => ({}));
      if (!active) return;
      if (!response.ok) { setError(result.error || 'تعذر تحميل الملف.'); return; }
      setData(result);
    })();
    return () => { active = false; };
  }, [leadId]);

  if (error) return <div style={{ padding:'1rem', background:'#fffaf0', border:'1px solid #d9c5a4', borderRadius:10, color:'#8b2f2f' }}>{error}</div>;
  if (!data) return <div style={{ padding:'1rem', background:'#fffaf0', border:'1px solid #d9c5a4', borderRadius:10 }}>جاري تحميل Customer 360...</div>;

  const customer = data.customer;
  const cards = [
    ['الحالة', customer.status || '—'],
    ['الهاتف', customer.phone || '—'],
    ['البريد', customer.email || '—'],
    ['الميزانية', customer.budget ? Number(customer.budget).toLocaleString() + ' ج' : '—'],
    ['المتابعات', data.followups.length],
    ['المكالمات', data.calls.length],
    ['المواعيد', data.appointments.length],
    ['الصفقات', data.deals.length],
    ['الفرص', data.opportunities?.length || 0],
    ['الدفعات', data.deal_payments?.length || 0]
  ];

  return (
    <section style={{ display:'grid', gap:'1rem' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:'0.6rem' }}>
        {cards.map(([label,value]) => <div key={label} style={{ background:'#3f321f', color:'#fffaf0', padding:'0.85rem', borderRadius:9, border:'1px solid #d9c5a4' }}><div style={{ fontSize:'.7rem', color:'#d9c5a4' }}>{label}</div><strong style={{ display:'block', marginTop:'.3rem', color:'#b08a4a' }}>{value}</strong></div>)}
      </div>
      <div style={{ background:'#3f321f', border:'1px solid #d9c5a4', borderRadius:10, padding:'1rem' }}>
        <h3 style={{ marginTop:0, color:'#b08a4a' }}>التاريخ التشغيلي</h3>
        <div style={{ display:'grid', gap:'.5rem' }}>
          {data.timeline.map((item, index) => {
            const date = item.created_at || item.followup_date || item.call_at || item.scheduled_at || item.due_date;
            return <article key={(item.id || index) + item.entity_type} style={{ background:'#fffaf0', borderRadius:8, padding:'.7rem', color:'#3f321f' }}>
              <strong>{labels[item.entity_type] || item.entity_type}</strong>
              <span style={{ marginRight:'.5rem', fontSize:'.72rem', color:'#806f56' }}>{date ? new Date(date).toLocaleString('ar-EG') : '—'}</span>
              <div style={{ marginTop:'.25rem', fontSize:'.78rem' }}>{item.notes || item.note || item.title || item.outcome || item.status || item.action || 'سجل تشغيلي'}</div>
            </article>;
          })}
          {!data.timeline.length && <div style={{ color:'#d9c5a4' }}>لا توجد أنشطة مسجلة لهذا العميل.</div>}
        </div>
      </div>
    </section>
  );
}

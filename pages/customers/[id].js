import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

const theme = { page: { minHeight: '100vh', background: '#f5efe3', color: '#3f321f', padding: 18, fontFamily: 'Arial,sans-serif' }, shell: { maxWidth: 1100, margin: '0 auto' }, card: { background: '#fffaf0', border: '1px solid #d9c5a4', borderRadius: 16, padding: 18, marginBottom: 16 }, title: { color: '#765522', margin: '0 0 8px' }, muted: { color: '#806f56' }, badge: { display: 'inline-block', padding: '5px 9px', borderRadius: 999, background: '#eadcc5', color: '#765522', fontSize: 12, fontWeight: 700 }, button: { border: '1px solid #b08a4a', background: '#b08a4a', color: '#fffaf0', borderRadius: 10, padding: '10px 14px', fontWeight: 700 }, secondary: { border: '1px solid #b08a4a', background: '#fffaf0', color: '#765522', borderRadius: 10, padding: '10px 14px', fontWeight: 700 } };

export default function Customer360Page() {
  const router = useRouter();
  const { id } = router.query;
  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [deals, setDeals] = useState([]);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true); setError('');
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { window.location.href = '/'; return; }
      const leadResult = await supabase.from('leads').select('*').eq('id', id).single();
      if (leadResult.error || !leadResult.data) { setError('لم يتم العثور على العميل أو لا تملك صلاحية الوصول.'); setLoading(false); return; }
      setLead(leadResult.data);
      const [logsResult, followupsResult, dealsResult, callsResult] = await Promise.all([
        supabase.from('lead_logs').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
        supabase.from('followups').select('*').eq('lead_id', id).order('followup_date', { ascending: true }),
        supabase.from('deals').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
        supabase.from('calls').select('*').eq('lead_id', id).order('created_at', { ascending: false })
      ]);
      setActivities(logsResult.data || []);
      setFollowups(followupsResult.data || []);
      setDeals(dealsResult.data || []);
      setCalls(callsResult.data || []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <main dir="rtl" style={theme.page}>جاري تحميل ملف العميل...</main>;
  if (error) return <main dir="rtl" style={theme.page}><div style={theme.shell}><div style={theme.card}>{error}<br/><button style={theme.secondary} onClick={() => router.back()}>رجوع</button></div></div></main>;

  const rows = (items, empty) => items.length ? items.map((item) => <div key={item.id || JSON.stringify(item)} style={{ borderBottom: '1px solid #e5d6be', padding: '10px 0' }}><strong>{item.title || item.type || item.status || item.action || 'سجل'}</strong><div style={theme.muted}>{item.note || item.description || item.notes || item.outcome || item.followup_date || item.created_at || '-'}</div></div>) : <div style={theme.muted}>{empty}</div>;

  return <main dir="rtl" style={theme.page}><div style={theme.shell}>
    <header style={{ ...theme.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><div><div style={theme.badge}>Customer 360</div><h1 style={theme.title}>{lead.name || 'بدون اسم'}</h1><div style={theme.muted}>{lead.phone || '-'} {lead.email ? `— ${lead.email}` : ''}</div></div><div style={{ display: 'flex', gap: 8 }}><button style={theme.secondary} onClick={() => router.back()}>رجوع</button><button style={theme.button} onClick={() => window.location.href = `https://wa.me/${String(lead.phone || '').replace(/[^0-9]/g, '')}`}>واتساب</button></div></header>
    <section style={theme.card}><h2 style={theme.title}>البيانات الأساسية</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>{[['الحالة', lead.status], ['المصدر', lead.lead_source], ['الميزانية', lead.budget], ['المنطقة', lead.preferred_area], ['نوع الوحدة', lead.desired_unit_type], ['المجلد', lead.folder]].map(([label, value]) => <div key={label}><div style={theme.muted}>{label}</div><strong>{value || 'غير محدد'}</strong></div>)}</div></section>
    <section style={theme.card}><h2 style={theme.title}>المكالمات</h2>{rows(calls, 'لا توجد مكالمات مسجلة.')}<p style={theme.muted}>ربط المكالمات يعتمد على وجود جدول calls وصلاحياته في Supabase.</p></section>
    <section style={theme.card}><h2 style={theme.title}>المتابعات</h2>{rows(followups, 'لا توجد متابعات مسجلة.')}</section>
    <section style={theme.card}><h2 style={theme.title}>الصفقات والحجوزات</h2>{rows(deals, 'لا توجد صفقات مرتبطة بالعميل.')}</section>
    <section style={theme.card}><h2 style={theme.title}>سجل النشاط والملاحظات</h2>{rows(activities, 'لا يوجد نشاط مسجل.')}</section>
  </div></main>;
}

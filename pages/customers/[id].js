import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';

const theme = {
  page: { minHeight: '100vh', background: '#f5efe3', color: '#3f321f', padding: 18, fontFamily: 'Arial,sans-serif' },
  shell: { maxWidth: 1180, margin: '0 auto' },
  card: { background: '#fffaf0', border: '1px solid #d9c5a4', borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: '0 8px 24px rgba(118,85,34,.06)' },
  title: { color: '#765522', margin: '0 0 8px' },
  muted: { color: '#806f56' },
  badge: { display: 'inline-block', padding: '5px 9px', borderRadius: 999, background: '#eadcc5', color: '#765522', fontSize: 12, fontWeight: 700 },
  button: { border: '1px solid #b08a4a', background: '#b08a4a', color: '#fffaf0', borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' },
  secondary: { border: '1px solid #b08a4a', background: '#fffaf0', color: '#765522', borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' },
  stat: { background: '#f1e5d1', border: '1px solid #dfcba9', borderRadius: 12, padding: 14 },
};

const text = (value) => value === null || value === undefined || value === '' ? 'غير محدد' : String(value);
const dateText = (value) => value ? new Date(value).toLocaleString('ar-EG') : 'بدون تاريخ';

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
  const [notice, setNotice] = useState('');
  const [activeSection, setActiveSection] = useState('timeline');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(''); setNotice('');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) { window.location.href = '/'; return; }

    const leadResult = await supabase.from('leads').select('*').eq('id', id).single();
    if (leadResult.error || !leadResult.data) {
      setError('لم يتم العثور على العميل أو لا تملك صلاحية الوصول.');
      setLoading(false);
      return;
    }
    setLead(leadResult.data);

    const results = await Promise.allSettled([
      supabase.from('lead_logs').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
      supabase.from('followups').select('*').eq('lead_id', id).order('followup_date', { ascending: true }),
      supabase.from('deals').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
      supabase.from('calls').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    ]);

    const [logsResult, followupsResult, dealsResult, callsResult] = results.map((result) => result.status === 'fulfilled' ? result.value : { data: [], error: result.reason });
    setActivities(logsResult.data || []);
    setFollowups(followupsResult.data || []);
    setDeals(dealsResult.data || []);
    setCalls(callsResult.data || []);
    const failed = [logsResult, followupsResult, dealsResult, callsResult].filter((result) => result.error);
    if (failed.length) setNotice('تم تحميل بيانات العميل، لكن بعض السجلات المرتبطة غير متاحة حاليًا.');
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const timeline = useMemo(() => [
    ...activities.map((item) => ({ ...item, kind: 'نشاط', date: item.created_at, heading: item.title || item.action || item.type || 'نشاط على العميل', body: item.note || item.description || item.notes || '' })),
    ...calls.map((item) => ({ ...item, kind: 'مكالمة', date: item.created_at || item.call_date, heading: item.title || item.outcome || 'مكالمة', body: item.notes || item.note || item.description || '' })),
    ...followups.map((item) => ({ ...item, kind: 'متابعة', date: item.followup_date || item.created_at, heading: item.title || item.status || 'متابعة', body: item.notes || item.note || item.description || '' })),
    ...deals.map((item) => ({ ...item, kind: 'صفقة', date: item.created_at, heading: item.title || item.status || 'صفقة', body: item.notes || item.description || '' })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [activities, calls, followups, deals]);

  const rows = (items, empty, fields = []) => items.length ? items.map((item, index) => (
    <div key={item.id || `${index}-${JSON.stringify(item)}`} style={{ borderBottom: '1px solid #e5d6be', padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><strong>{text(item.title || item.type || item.status || item.action || 'سجل')}</strong><span style={theme.muted}>{dateText(item.created_at || item.followup_date || item.call_date)}</span></div>
      <div style={theme.muted}>{text(item.note || item.description || item.notes || item.outcome)}</div>
      {fields.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 7 }}>{fields.map((field) => item[field] !== undefined && <span key={field} style={theme.badge}>{`${field}: ${text(item[field])}`}</span>)}</div>}
    </div>
  )) : <div style={theme.muted}>{empty}</div>;

  if (loading) return <main dir="rtl" style={theme.page}>جاري تحميل ملف العميل...</main>;
  if (error) return <main dir="rtl" style={theme.page}><div style={theme.shell}><div style={theme.card}>{error}<br /><button style={theme.secondary} onClick={() => router.back()}>رجوع</button></div></div></main>;

  return <main dir="rtl" style={theme.page}><div style={theme.shell}>
    <header style={{ ...theme.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div><div style={theme.badge}>Customer 360</div><h1 style={theme.title}>{text(lead.name)}</h1><div style={theme.muted}>{text(lead.phone)} {lead.email ? `— ${lead.email}` : ''}</div></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button style={theme.secondary} onClick={() => router.back()}>رجوع</button><button style={theme.secondary} onClick={load}>تحديث</button><button style={theme.button} onClick={() => window.location.href = `https://wa.me/${String(lead.phone || '').replace(/[^0-9]/g, '')}`}>واتساب</button></div>
    </header>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 10, marginBottom: 16 }}>
      {[['المكالمات', calls.length], ['المتابعات', followups.length], ['الصفقات', deals.length], ['النشاطات', activities.length]].map(([label, value]) => <div key={label} style={theme.stat}><div style={theme.muted}>{label}</div><strong style={{ fontSize: 25, color: '#765522' }}>{value}</strong></div>)}
    </section>

    <section style={theme.card}><h2 style={theme.title}>البيانات الأساسية</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>{[['الحالة', lead.status], ['المصدر', lead.lead_source], ['الميزانية', lead.budget], ['المنطقة', lead.preferred_area || lead.preferred_location], ['نوع الوحدة', lead.desired_unit_type || lead.property_type], ['المجلد', lead.folder], ['المسؤول', lead.assigned_to]].map(([label, value]) => <div key={label}><div style={theme.muted}>{label}</div><strong>{text(value)}</strong></div>)}</div></section>

    <nav style={{ ...theme.card, display: 'flex', gap: 8, flexWrap: 'wrap' }}>{[['timeline', 'الخط الزمني'], ['calls', 'المكالمات'], ['followups', 'المتابعات'], ['deals', 'الصفقات'], ['activities', 'سجل النشاط']].map(([key, label]) => <button key={key} style={activeSection === key ? theme.button : theme.secondary} onClick={() => setActiveSection(key)}>{label}</button>)}</nav>

    {notice && <div style={{ ...theme.card, color: '#765522' }}>{notice}</div>}
    {activeSection === 'timeline' && <section style={theme.card}><h2 style={theme.title}>الخط الزمني الموحد</h2>{rows(timeline, 'لا يوجد نشاط مرتبط بالعميل.')}</section>}
    {activeSection === 'calls' && <section style={theme.card}><h2 style={theme.title}>المكالمات</h2>{rows(calls, 'لا توجد مكالمات مسجلة.', ['status', 'duration'])}</section>}
    {activeSection === 'followups' && <section style={theme.card}><h2 style={theme.title}>المتابعات</h2>{rows(followups, 'لا توجد متابعات مسجلة.', ['status', 'priority'])}</section>}
    {activeSection === 'deals' && <section style={theme.card}><h2 style={theme.title}>الصفقات والحجوزات</h2>{rows(deals, 'لا توجد صفقات مرتبطة بالعميل.', ['status', 'amount', 'unit_id'])}</section>}
    {activeSection === 'activities' && <section style={theme.card}><h2 style={theme.title}>سجل النشاط والملاحظات</h2>{rows(activities, 'لا يوجد نشاط مسجل.')}</section>}
  </div></main>;
}

import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { can, normalizeRole, PERMISSIONS } from '../../lib/permissions';

const theme = {
  page: { minHeight: '100vh', background: '#f5efe3', color: '#3f321f', padding: 18, fontFamily: 'Arial,sans-serif' },
  shell: { maxWidth: 1180, margin: '0 auto' },
  card: { background: '#fffaf0', border: '1px solid #d9c5a4', borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: '0 8px 24px rgba(118,85,34,.06)' },
  title: { color: '#765522', margin: '0 0 8px' },
  muted: { color: '#806f56' },
  badge: { display: 'inline-block', padding: '5px 9px', borderRadius: 999, background: '#eadcc5', color: '#765522', fontSize: 12, fontWeight: 700 },
  button: { border: '1px solid #b08a4a', background: '#b08a4a', color: '#fffaf0', borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' },
  secondary: { border: '1px solid #b08a4a', background: '#fffaf0', color: '#765522', borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' },
  danger: { border: '1px solid #b65443', background: '#fff7f4', color: '#9b3e30', borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' },
  stat: { background: '#f1e5d1', border: '1px solid #dfcba9', borderRadius: 12, padding: 14 },
  input: { width: '100%', minWidth: 0, padding: 10, border: '1px solid #d9c5a4', borderRadius: 10, background: '#fffdf8', color: '#3f321f' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 },
};

const safeText = (value) => value === null || value === undefined || value === '' ? 'غير محدد' : String(value);
const dateText = (value) => value ? new Date(value).toLocaleString('ar-EG') : 'بدون تاريخ';
const toIso = (value) => value ? new Date(value).toISOString() : null;
const money = (value) => Number(value || 0).toLocaleString('ar-EG');

export default function Customer360Page() {
  const router = useRouter();
  const { id } = router.query;

  const [session, setSession] = useState(null);
  const [role, setRole] = useState('sales');
  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [deals, setDeals] = useState([]);
  const [calls, setCalls] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeSection, setActiveSection] = useState('timeline');
  const [activeAction, setActiveAction] = useState('');
  const [leadDraft, setLeadDraft] = useState({});

  const canCalls = can(role, PERMISSIONS.CALLS_MANAGE);
  const canFollowups = can(role, PERMISSIONS.FOLLOWUPS_MANAGE);
  const canDeals = can(role, PERMISSIONS.DEALS_MANAGE);
  const canReservations = can(role, PERMISSIONS.RESERVATIONS_MANAGE);
  const canAppointments = can(role, PERMISSIONS.APPOINTMENTS_MANAGE);
  const canFinance = can(role, PERMISSIONS.FINANCE_MANAGE);
  const canEditLead = can(role, PERMISSIONS.LEADS_UPDATE);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    setNotice('');

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      window.location.href = '/';
      return;
    }

    setSession(sessionData.session);
    const { data: roleRow } = await supabase.from('user_roles').select('role').eq('id', sessionData.session.user.id).single();
    setRole(normalizeRole(roleRow?.role));

    const leadResult = await supabase.from('leads').select('*').eq('id', id).single();
    if (leadResult.error || !leadResult.data) {
      setError('لم يتم العثور على العميل أو لا تملك صلاحية الوصول.');
      setLoading(false);
      return;
    }

    setLead(leadResult.data);
    setLeadDraft({
      name: leadResult.data.name || '',
      phone: leadResult.data.phone || '',
      email: leadResult.data.email || '',
      status: leadResult.data.status || 'New Lead',
      temperature: leadResult.data.temperature || 'Warm',
      budget: leadResult.data.budget ?? '',
      preferred_area: leadResult.data.preferred_area || '',
      desired_unit_type: leadResult.data.desired_unit_type || '',
      next_follow_up: leadResult.data.next_follow_up ? new Date(leadResult.data.next_follow_up).toISOString().slice(0, 16) : '',
    });

    const results = await Promise.allSettled([
      supabase.from('lead_logs').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
      supabase.from('followups').select('*').eq('lead_id', id).order('followup_date', { ascending: true }),
      supabase.from('deals').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
      supabase.from('calls').select('*').eq('lead_id', id).order('call_at', { ascending: false }),
      supabase.from('appointments').select('*').eq('lead_id', id).order('scheduled_at', { ascending: true }),
      supabase.from('reservations').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
      supabase.from('units').select('id,title,unit_number,price,status,project_id').order('created_at', { ascending: false }),
    ]);

    const normalized = results.map((result) => result.status === 'fulfilled' ? result.value : { data: [], error: result.reason });
    const [logsResult, followupsResult, dealsResult, callsResult, appointmentsResult, reservationsResult, unitsResult] = normalized;

    setActivities(logsResult.data || []);
    setFollowups(followupsResult.data || []);
    setDeals(dealsResult.data || []);
    setCalls(callsResult.data || []);
    setAppointments(appointmentsResult.data || []);
    setReservations(reservationsResult.data || []);
    setUnits(unitsResult.data || []);

    const dealIds = (dealsResult.data || []).map((item) => item.id);
    if (dealIds.length) {
      const paymentResult = await supabase.from('deal_payments').select('*').in('deal_id', dealIds).order('due_date', { ascending: true });
      setPayments(paymentResult.data || []);
      if (paymentResult.error) normalized.push(paymentResult);
    } else {
      setPayments([]);
    }

    if (normalized.some((result) => result.error)) {
      setNotice('تم تحميل ملف العميل، لكن بعض السجلات المرتبطة لم تُحمّل بسبب الصلاحيات أو إعدادات قاعدة البيانات.');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const logActivity = async (actionType, content) => {
    if (!session?.user) return;
    await supabase.from('lead_logs').insert([{
      lead_id: id,
      user_email: session.user.email || '',
      action_type: actionType,
      content,
    }]);
  };

  const submitRecord = async (event, table, payload, actionType, message) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice('');
    const { error: insertError } = await supabase.from(table).insert([payload]);
    if (insertError) {
      setNotice('تعذر الحفظ: ' + insertError.message);
      setBusy(false);
      return;
    }
    await logActivity(actionType, message);
    event.currentTarget.reset();
    setActiveAction('');
    setBusy(false);
    await load();
  };

  const updateLead = async (event) => {
    event.preventDefault();
    if (!canEditLead || busy) return;
    setBusy(true);
    setNotice('');

    const patch = {
      name: String(leadDraft.name || '').trim(),
      phone: String(leadDraft.phone || '').trim(),
      email: String(leadDraft.email || '').trim() || null,
      status: leadDraft.status,
      temperature: leadDraft.temperature,
      budget: leadDraft.budget === '' ? null : Number(leadDraft.budget),
      preferred_area: String(leadDraft.preferred_area || '').trim() || null,
      desired_unit_type: String(leadDraft.desired_unit_type || '').trim() || null,
      next_follow_up: toIso(leadDraft.next_follow_up),
    };

    if (!patch.name || !patch.phone) {
      setNotice('الاسم ورقم الهاتف مطلوبان.');
      setBusy(false);
      return;
    }

    const { error: updateError } = await supabase.from('leads').update(patch).eq('id', id);
    if (updateError) {
      setNotice('تعذر تحديث العميل: ' + updateError.message);
      setBusy(false);
      return;
    }

    await logActivity('LEAD_UPDATED', 'تم تحديث بيانات العميل من Customer 360');
    setActiveAction('');
    setBusy(false);
    await load();
  };

  const updateFollowupStatus = async (followupId, status) => {
    const { error: updateError } = await supabase.from('followups').update({ status }).eq('id', followupId);
    if (updateError) return setNotice('تعذر تحديث المتابعة: ' + updateError.message);
    await logActivity('FOLLOWUP_UPDATED', `تم تحديث حالة المتابعة إلى ${status}`);
    await load();
  };

  const updatePaymentStatus = async (paymentId, status) => {
    const patch = { status, paid_at: status === 'Paid' ? new Date().toISOString() : null };
    const { error: updateError } = await supabase.from('deal_payments').update(patch).eq('id', paymentId);
    if (updateError) return setNotice('تعذر تحديث الدفعة: ' + updateError.message);
    await logActivity('PAYMENT_UPDATED', `تم تحديث حالة الدفعة إلى ${status}`);
    await load();
  };

  const timeline = useMemo(() => [
    ...activities.map((item) => ({ ...item, kind: 'نشاط', date: item.created_at, heading: item.action_type || 'نشاط على العميل', body: item.content || '' })),
    ...calls.map((item) => ({ ...item, kind: 'مكالمة', date: item.call_at || item.created_at, heading: item.outcome || 'مكالمة', body: item.notes || '' })),
    ...followups.map((item) => ({ ...item, kind: 'متابعة', date: item.followup_date || item.created_at, heading: item.status || 'متابعة', body: item.notes || '' })),
    ...appointments.map((item) => ({ ...item, kind: 'موعد', date: item.scheduled_at || item.created_at, heading: item.type || 'موعد', body: item.notes || '' })),
    ...reservations.map((item) => ({ ...item, kind: 'حجز', date: item.created_at, heading: item.status || 'حجز', body: item.notes || '' })),
    ...deals.map((item) => ({ ...item, kind: 'صفقة', date: item.created_at, heading: item.status || 'صفقة', body: item.notes || '' })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [activities, calls, followups, appointments, reservations, deals]);

  const ActionButton = ({ action, allowed = true, children }) => allowed ? (
    <button type="button" style={activeAction === action ? theme.button : theme.secondary} onClick={() => setActiveAction(activeAction === action ? '' : action)}>{children}</button>
  ) : null;

  const Field = ({ label, children }) => <label style={{ display: 'grid', gap: 6, fontWeight: 700, fontSize: 13 }}><span>{label}</span>{children}</label>;

  const recordRows = (items, empty, fields = []) => items.length ? items.map((item, index) => (
    <div key={item.id || index} style={{ borderBottom: '1px solid #e5d6be', padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <strong>{safeText(item.outcome || item.type || item.status || item.action_type || item.title || 'سجل')}</strong>
        <span style={theme.muted}>{dateText(item.call_at || item.followup_date || item.scheduled_at || item.created_at)}</span>
      </div>
      <div style={theme.muted}>{safeText(item.content || item.notes || item.description)}</div>
      {fields.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 7 }}>
        {fields.map((field) => item[field] !== undefined && <span key={field} style={theme.badge}>{`${field}: ${safeText(item[field])}`}</span>)}
      </div>}
    </div>
  )) : <div style={theme.muted}>{empty}</div>;

  if (loading) return <main dir="rtl" style={theme.page}>جاري تحميل ملف العميل...</main>;
  if (error) return <main dir="rtl" style={theme.page}><div style={theme.shell}><div style={theme.card}>{error}<br /><button style={theme.secondary} onClick={() => router.back()}>رجوع</button></div></div></main>;
  if (!lead) return null;

  return <main dir="rtl" style={theme.page}><div style={theme.shell}>
    <header style={{ ...theme.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div style={theme.badge}>Customer 360</div>
        <h1 style={theme.title}>{safeText(lead.name)}</h1>
        <div style={theme.muted}>{safeText(lead.phone)} {lead.email ? `— ${lead.email}` : ''}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={theme.secondary} onClick={() => router.back()}>رجوع</button>
        <button style={theme.secondary} onClick={load}>تحديث</button>
        <button style={theme.button} onClick={() => window.open(`https://wa.me/${String(lead.phone || '').replace(/[^0-9]/g, '')}`, '_blank', 'noopener,noreferrer')}>واتساب</button>
      </div>
    </header>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(135px,1fr))', gap: 10, marginBottom: 16 }}>
      {[['المكالمات', calls.length], ['المتابعات', followups.length], ['المواعيد', appointments.length], ['الحجوزات', reservations.length], ['الصفقات', deals.length], ['الدفعات', payments.length]].map(([label, value]) => (
        <div key={label} style={theme.stat}><div style={theme.muted}>{label}</div><strong style={{ fontSize: 25, color: '#765522' }}>{value}</strong></div>
      ))}
    </section>

    <section style={theme.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <h2 style={theme.title}>البيانات الأساسية</h2>
        <ActionButton action="edit" allowed={canEditLead}>تعديل بيانات العميل</ActionButton>
      </div>
      <div style={theme.grid}>
        {[
          ['الحالة', lead.status], ['درجة العميل', lead.temperature], ['المصدر', lead.lead_source], ['الميزانية', lead.budget ? money(lead.budget) + ' ج' : null],
          ['المنطقة', lead.preferred_area || lead.preferred_location], ['نوع الوحدة', lead.desired_unit_type || lead.unit_type], ['المجلد', lead.folder], ['المتابعة القادمة', lead.next_follow_up ? dateText(lead.next_follow_up) : null]
        ].map(([label, value]) => <div key={label}><div style={theme.muted}>{label}</div><strong>{safeText(value)}</strong></div>)}
      </div>
    </section>

    <section style={{ ...theme.card, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <ActionButton action="call" allowed={canCalls}>+ مكالمة</ActionButton>
      <ActionButton action="followup" allowed={canFollowups}>+ متابعة</ActionButton>
      <ActionButton action="appointment" allowed={canAppointments}>+ موعد</ActionButton>
      <ActionButton action="reservation" allowed={canReservations}>+ حجز</ActionButton>
      <ActionButton action="deal" allowed={canDeals}>+ صفقة</ActionButton>
      <ActionButton action="payment" allowed={canFinance && deals.length > 0}>+ دفعة</ActionButton>
    </section>

    {activeAction === 'edit' && <form onSubmit={updateLead} style={theme.card}>
      <h3 style={theme.title}>تعديل بيانات العميل</h3>
      <div style={theme.grid}>
        <Field label="الاسم"><input style={theme.input} value={leadDraft.name || ''} onChange={(e) => setLeadDraft({ ...leadDraft, name: e.target.value })} required /></Field>
        <Field label="الهاتف"><input style={theme.input} value={leadDraft.phone || ''} onChange={(e) => setLeadDraft({ ...leadDraft, phone: e.target.value })} required /></Field>
        <Field label="البريد"><input style={theme.input} type="email" value={leadDraft.email || ''} onChange={(e) => setLeadDraft({ ...leadDraft, email: e.target.value })} /></Field>
        <Field label="الحالة"><select style={theme.input} value={leadDraft.status || 'New Lead'} onChange={(e) => setLeadDraft({ ...leadDraft, status: e.target.value })}>{['New Lead','Contacted','Interested','Meeting Set','Closed Won','Lost'].map((v) => <option key={v}>{v}</option>)}</select></Field>
        <Field label="درجة العميل"><select style={theme.input} value={leadDraft.temperature || 'Warm'} onChange={(e) => setLeadDraft({ ...leadDraft, temperature: e.target.value })}>{['Cold','Warm','Hot'].map((v) => <option key={v}>{v}</option>)}</select></Field>
        <Field label="الميزانية"><input style={theme.input} type="number" min="0" value={leadDraft.budget ?? ''} onChange={(e) => setLeadDraft({ ...leadDraft, budget: e.target.value })} /></Field>
        <Field label="المنطقة"><input style={theme.input} value={leadDraft.preferred_area || ''} onChange={(e) => setLeadDraft({ ...leadDraft, preferred_area: e.target.value })} /></Field>
        <Field label="نوع الوحدة"><input style={theme.input} value={leadDraft.desired_unit_type || ''} onChange={(e) => setLeadDraft({ ...leadDraft, desired_unit_type: e.target.value })} /></Field>
        <Field label="المتابعة القادمة"><input style={theme.input} type="datetime-local" value={leadDraft.next_follow_up || ''} onChange={(e) => setLeadDraft({ ...leadDraft, next_follow_up: e.target.value })} /></Field>
      </div>
      <button disabled={busy} style={{ ...theme.button, marginTop: 12 }} type="submit">{busy ? 'جاري الحفظ...' : 'حفظ التعديلات'}</button>
    </form>}

    {activeAction === 'call' && <form onSubmit={(e) => { const f = new FormData(e.currentTarget); submitRecord(e, 'calls', { lead_id: id, assigned_to: session.user.id, call_at: toIso(f.get('call_at')) || new Date().toISOString(), duration_seconds: Number(f.get('duration_seconds') || 0), outcome: f.get('outcome') || null, notes: f.get('notes') || null }, 'CALL_CREATED', 'تم تسجيل مكالمة جديدة'); }} style={theme.card}>
      <h3 style={theme.title}>تسجيل مكالمة</h3><div style={theme.grid}>
        <Field label="وقت المكالمة"><input name="call_at" type="datetime-local" style={theme.input} /></Field>
        <Field label="المدة بالثواني"><input name="duration_seconds" type="number" min="0" style={theme.input} /></Field>
        <Field label="النتيجة"><input name="outcome" style={theme.input} placeholder="مثال: مهتم / لم يرد" /></Field>
        <Field label="ملاحظات"><input name="notes" style={theme.input} /></Field>
      </div><button disabled={busy} style={{ ...theme.button, marginTop: 12 }}>حفظ المكالمة</button>
    </form>}

    {activeAction === 'followup' && <form onSubmit={(e) => { const f = new FormData(e.currentTarget); submitRecord(e, 'followups', { lead_id: id, assigned_to: session.user.id, followup_date: toIso(f.get('followup_date')), type: f.get('type') || 'Call', status: 'Pending', notes: f.get('notes') || null }, 'FOLLOWUP_CREATED', 'تم إنشاء متابعة جديدة'); }} style={theme.card}>
      <h3 style={theme.title}>إضافة متابعة</h3><div style={theme.grid}>
        <Field label="موعد المتابعة"><input name="followup_date" type="datetime-local" required style={theme.input} /></Field>
        <Field label="النوع"><select name="type" style={theme.input}>{['Call','WhatsApp','Meeting','Email','Other'].map((v) => <option key={v}>{v}</option>)}</select></Field>
        <Field label="ملاحظات"><input name="notes" style={theme.input} /></Field>
      </div><button disabled={busy} style={{ ...theme.button, marginTop: 12 }}>حفظ المتابعة</button>
    </form>}

    {activeAction === 'appointment' && <form onSubmit={(e) => { const f = new FormData(e.currentTarget); submitRecord(e, 'appointments', { lead_id: id, assigned_to: session.user.id, scheduled_at: toIso(f.get('scheduled_at')), type: f.get('type') || 'Meeting', status: 'Planned', notes: f.get('notes') || null }, 'APPOINTMENT_CREATED', 'تم إنشاء موعد جديد'); }} style={theme.card}>
      <h3 style={theme.title}>إضافة موعد</h3><div style={theme.grid}>
        <Field label="التاريخ والوقت"><input name="scheduled_at" type="datetime-local" required style={theme.input} /></Field>
        <Field label="نوع الموعد"><input name="type" defaultValue="Meeting" style={theme.input} /></Field>
        <Field label="ملاحظات"><input name="notes" style={theme.input} /></Field>
      </div><button disabled={busy} style={{ ...theme.button, marginTop: 12 }}>حفظ الموعد</button>
    </form>}

    {activeAction === 'reservation' && <form onSubmit={(e) => { const f = new FormData(e.currentTarget); submitRecord(e, 'reservations', { lead_id: id, unit_id: f.get('unit_id') || null, sales_person: session.user.id, reservation_amount: Number(f.get('reservation_amount') || 0), contract_value: f.get('contract_value') ? Number(f.get('contract_value')) : null, status: 'Pending', expires_at: toIso(f.get('expires_at')), notes: f.get('notes') || null }, 'RESERVATION_CREATED', 'تم إنشاء حجز جديد'); }} style={theme.card}>
      <h3 style={theme.title}>تسجيل حجز</h3><div style={theme.grid}>
        <Field label="الوحدة"><select name="unit_id" required style={theme.input}><option value="">اختر الوحدة</option>{units.filter((u) => u.status !== 'Sold').map((u) => <option key={u.id} value={u.id}>{u.unit_number || u.title} — {money(u.price)} ج</option>)}</select></Field>
        <Field label="مبلغ الحجز"><input name="reservation_amount" type="number" min="0" required style={theme.input} /></Field>
        <Field label="القيمة التعاقدية"><input name="contract_value" type="number" min="0" style={theme.input} /></Field>
        <Field label="انتهاء الحجز"><input name="expires_at" type="datetime-local" style={theme.input} /></Field>
        <Field label="ملاحظات"><input name="notes" style={theme.input} /></Field>
      </div><button disabled={busy} style={{ ...theme.button, marginTop: 12 }}>حفظ الحجز</button>
    </form>}

    {activeAction === 'deal' && <form onSubmit={(e) => { const f = new FormData(e.currentTarget); submitRecord(e, 'deals', { lead_id: id, unit_id: f.get('unit_id') || null, reservation_id: f.get('reservation_id') || null, sales_person: session.user.id, deal_value: Number(f.get('deal_value') || 0), down_payment: Number(f.get('down_payment') || 0), installment_months: Number(f.get('installment_months') || 0), payment_frequency: f.get('payment_frequency') || 'monthly', status: 'Pending', contract_date: f.get('contract_date') || null, notes: f.get('notes') || null }, 'DEAL_CREATED', 'تم إنشاء صفقة جديدة'); }} style={theme.card}>
      <h3 style={theme.title}>إنشاء صفقة</h3><div style={theme.grid}>
        <Field label="الوحدة"><select name="unit_id" style={theme.input}><option value="">بدون وحدة</option>{units.map((u) => <option key={u.id} value={u.id}>{u.unit_number || u.title}</option>)}</select></Field>
        <Field label="الحجز المرتبط"><select name="reservation_id" style={theme.input}><option value="">بدون حجز</option>{reservations.map((r) => <option key={r.id} value={r.id}>{r.id.slice(0, 8)} — {money(r.reservation_amount)} ج</option>)}</select></Field>
        <Field label="قيمة الصفقة"><input name="deal_value" type="number" min="0" required style={theme.input} /></Field>
        <Field label="المقدم"><input name="down_payment" type="number" min="0" style={theme.input} /></Field>
        <Field label="مدة التقسيط بالشهور"><input name="installment_months" type="number" min="0" style={theme.input} /></Field>
        <Field label="تكرار الدفع"><select name="payment_frequency" style={theme.input}><option value="monthly">شهري</option><option value="quarterly">ربع سنوي</option><option value="yearly">سنوي</option></select></Field>
        <Field label="تاريخ التعاقد"><input name="contract_date" type="date" style={theme.input} /></Field>
        <Field label="ملاحظات"><input name="notes" style={theme.input} /></Field>
      </div><button disabled={busy} style={{ ...theme.button, marginTop: 12 }}>حفظ الصفقة</button>
    </form>}

    {activeAction === 'payment' && <form onSubmit={(e) => { const f = new FormData(e.currentTarget); submitRecord(e, 'deal_payments', { deal_id: f.get('deal_id'), installment_no: Number(f.get('installment_no')), due_date: f.get('due_date'), amount: Number(f.get('amount')), status: 'Pending', notes: f.get('notes') || null }, 'PAYMENT_CREATED', 'تمت إضافة دفعة جديدة'); }} style={theme.card}>
      <h3 style={theme.title}>إضافة دفعة</h3><div style={theme.grid}>
        <Field label="الصفقة"><select name="deal_id" required style={theme.input}>{deals.map((d) => <option key={d.id} value={d.id}>{d.id.slice(0, 8)} — {money(d.deal_value)} ج</option>)}</select></Field>
        <Field label="رقم القسط"><input name="installment_no" type="number" min="1" required style={theme.input} /></Field>
        <Field label="تاريخ الاستحقاق"><input name="due_date" type="date" required style={theme.input} /></Field>
        <Field label="المبلغ"><input name="amount" type="number" min="0" required style={theme.input} /></Field>
        <Field label="ملاحظات"><input name="notes" style={theme.input} /></Field>
      </div><button disabled={busy} style={{ ...theme.button, marginTop: 12 }}>حفظ الدفعة</button>
    </form>}

    {notice && <div style={{ ...theme.card, color: '#765522' }}>{notice}</div>}

    <nav style={{ ...theme.card, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {[['timeline','الخط الزمني'],['calls','المكالمات'],['followups','المتابعات'],['appointments','المواعيد'],['reservations','الحجوزات'],['deals','الصفقات'],['payments','الدفعات'],['activities','سجل النشاط']].map(([key,label]) => (
        <button key={key} type="button" style={activeSection === key ? theme.button : theme.secondary} onClick={() => setActiveSection(key)}>{label}</button>
      ))}
    </nav>

    {activeSection === 'timeline' && <section style={theme.card}><h2 style={theme.title}>الخط الزمني الموحد</h2>{recordRows(timeline, 'لا يوجد نشاط مرتبط بالعميل.')}</section>}
    {activeSection === 'calls' && <section style={theme.card}><h2 style={theme.title}>المكالمات</h2>{recordRows(calls, 'لا توجد مكالمات مسجلة.', ['outcome','duration_seconds'])}</section>}
    {activeSection === 'followups' && <section style={theme.card}><h2 style={theme.title}>المتابعات</h2>{followups.length ? followups.map((f) => <div key={f.id} style={{ borderBottom:'1px solid #e5d6be', padding:'12px 0' }}><div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}><strong>{f.type || 'متابعة'}</strong><span style={theme.muted}>{dateText(f.followup_date)}</span></div><div style={theme.muted}>{f.notes || 'بدون ملاحظات'}</div>{canFollowups && <select value={f.status || 'Pending'} onChange={(e) => updateFollowupStatus(f.id, e.target.value)} style={{ ...theme.input, width:'auto', marginTop:8 }}>{['Pending','Done','Cancelled'].map((v)=><option key={v}>{v}</option>)}</select>}</div>) : <div style={theme.muted}>لا توجد متابعات مسجلة.</div>}</section>}
    {activeSection === 'appointments' && <section style={theme.card}><h2 style={theme.title}>المواعيد</h2>{recordRows(appointments, 'لا توجد مواعيد مسجلة.', ['type','status'])}</section>}
    {activeSection === 'reservations' && <section style={theme.card}><h2 style={theme.title}>الحجوزات</h2>{recordRows(reservations, 'لا توجد حجوزات مرتبطة بالعميل.', ['status','reservation_amount','contract_value'])}</section>}
    {activeSection === 'deals' && <section style={theme.card}><h2 style={theme.title}>الصفقات</h2>{recordRows(deals, 'لا توجد صفقات مرتبطة بالعميل.', ['status','deal_value','down_payment'])}</section>}
    {activeSection === 'payments' && <section style={theme.card}><h2 style={theme.title}>الدفعات</h2>{payments.length ? payments.map((p) => <div key={p.id} style={{ borderBottom:'1px solid #e5d6be', padding:'12px 0' }}><div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}><strong>قسط {p.installment_no} — {money(p.amount)} ج</strong><span style={theme.muted}>{p.due_date}</span></div>{canFinance && <select value={p.status || 'Pending'} onChange={(e) => updatePaymentStatus(p.id, e.target.value)} style={{ ...theme.input, width:'auto', marginTop:8 }}>{['Pending','Paid','Overdue','Cancelled'].map((v)=><option key={v}>{v}</option>)}</select>}</div>) : <div style={theme.muted}>لا توجد دفعات مرتبطة بصفقات العميل.</div>}</section>}
    {activeSection === 'activities' && <section style={theme.card}><h2 style={theme.title}>سجل النشاط والملاحظات</h2>{recordRows(activities, 'لا يوجد نشاط مسجل.')}</section>}
  </div></main>;
}

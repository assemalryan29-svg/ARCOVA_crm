import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { can, PERMISSIONS } from '../lib/permissions';

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

async function crmMutation(method, body) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('انتهت الجلسة.');
  const response = await fetch('/api/crm/mutate', {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'فشلت العملية.');
  return result;
}

const tabs = [
  { key: 'deals', label: 'الصفقات' },
  { key: 'reservations', label: 'الحجوزات' },
  { key: 'calls', label: 'المكالمات' },
  { key: 'appointments', label: 'المواعيد' },
  { key: 'finance', label: 'المالية' }
];

const panel = {
  background: '#3f321f',
  padding: '0.8rem',
  borderRadius: '8px',
  border: '1px solid #d9c5a4'
};

const input = {
  padding: '0.45rem',
  background: '#fffaf0',
  color: '#3f321f',
  border: '1px solid #d9c5a4',
  borderRadius: '5px',
  fontSize: '0.78rem',
  minWidth: 0
};

function googleCalendarUrl(appointment) {
  const start = appointment.scheduled_at ? new Date(appointment.scheduled_at) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'ARCOVA - ' + (appointment.leads?.name || 'موعد عميل'),
    dates: fmt(start) + '/' + fmt(end),
    details: [appointment.type, appointment.notes].filter(Boolean).join(' · ')
  });
  return 'https://calendar.google.com/calendar/render?' + params.toString();
}

export default function OperationsPanel({ currentUser, userRole, leads = [], units = [] }) {
  const [active, setActive] = useState('deals');
  const [deals, setDeals] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [calls, setCalls] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dealForm, setDealForm] = useState({
    reservation_id: '',
    deal_value: '',
    down_payment: '',
    installment_months: '',
    payment_frequency: 'monthly',
    first_due_date: '',
    commission: '',
    notes: '',
    generate_schedule: true
  });

  const canFinanceView = can(userRole, PERMISSIONS.FINANCE_VIEW);
  const canFinanceManage = can(userRole, PERMISSIONS.FINANCE_MANAGE);
  const canDeals = can(userRole, PERMISSIONS.DEALS_MANAGE);
  const canReservations = can(userRole, PERMISSIONS.RESERVATIONS_MANAGE);
  const canCalls = can(userRole, PERMISSIONS.CALLS_MANAGE);
  const canAppointments = can(userRole, PERMISSIONS.APPOINTMENTS_MANAGE);

  const load = async () => {
    const results = await Promise.all([
      supabase
        .from('deals')
        .select('*, leads(name), units(title,unit_number)')
        .order('created_at', { ascending: false }),
      supabase
        .from('reservations')
        .select('*, leads(name), units(title,unit_number,status)')
        .order('created_at', { ascending: false }),
      supabase
        .from('calls')
        .select('*, leads(name)')
        .order('call_at', { ascending: false }),
      supabase
        .from('appointments')
        .select('*, leads(name)')
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('deal_payments')
        .select('*, deals(lead_id,sales_person,deal_value,leads(name))')
        .order('due_date', { ascending: true })
    ]);

    setDeals(results[0].data || []);
    setReservations(results[1].data || []);
    setCalls(results[2].data || []);
    setAppointments(results[3].data || []);
    setPayments(results[4].data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (event, table, payload, message) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await crmMutation('POST', { table, data: payload });
      if (!result?.success) throw new Error(message);
      event.currentTarget.reset();
      await load();
    } catch (error) {
      alert(message + ': ' + error.message);
    } finally {
      setBusy(false);
    }
  };

  const reserveUnit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await rpc('reserve_unit_atomic', {
        p_lead_id: form.get('lead_id'),
        p_unit_id: form.get('unit_id'),
        p_reservation_amount: Number(form.get('reservation_amount') || 0),
        p_contract_value: form.get('contract_value') ? Number(form.get('contract_value')) : null,
        p_expires_at: form.get('expires_at') ? new Date(form.get('expires_at')).toISOString() : null,
        p_notes: form.get('notes') || null
      });
      event.currentTarget.reset();
      await load();
      alert('تم حجز الوحدة وتغيير حالتها إلى Reserved.');
    } catch (error) {
      alert('فشل تسجيل الحجز: ' + error.message);
    } finally {
      setBusy(false);
    }
  };

  const cancelReservation = async (reservationId) => {
    if (!canReservations) return;
    setBusy(true);
    try {
      await rpc('release_reservation_atomic', {
        p_reservation_id: reservationId,
        p_new_status: 'Cancelled'
      });
      await load();
    } catch (error) {
      alert('فشل إلغاء الحجز: ' + error.message);
    } finally {
      setBusy(false);
    }
  };

  const convertReservationToDeal = async (event) => {
    event.preventDefault();
    if (!canDeals) return;
    setBusy(true);
    try {
      const deal = await rpc('confirm_reservation_as_deal', {
        p_reservation_id: dealForm.reservation_id,
        p_deal_value: Number(dealForm.deal_value || 0),
        p_down_payment: Number(dealForm.down_payment || 0),
        p_installment_months: dealForm.installment_months ? Number(dealForm.installment_months) : null,
        p_payment_frequency: dealForm.payment_frequency,
        p_contract_date: new Date().toISOString().slice(0, 10),
        p_commission: Number(dealForm.commission || 0),
        p_notes: dealForm.notes || null
      });

      if (dealForm.generate_schedule) {
        if (!dealForm.installment_months) {
          throw new Error('أدخل مدة التقسيط لإنشاء جدول الأقساط.');
        }
        await rpc('generate_deal_payment_schedule', {
          p_deal_id: deal.id,
          p_first_due_date: dealForm.first_due_date || new Date().toISOString().slice(0, 10)
        });
      }

      setDealForm({
        reservation_id: '',
        deal_value: '',
        down_payment: '',
        installment_months: '',
        payment_frequency: 'monthly',
        first_due_date: '',
        commission: '',
        notes: '',
        generate_schedule: true
      });
      await load();
      alert('تم تحويل الحجز إلى صفقة بنجاح.');
    } catch (error) {
      alert('فشل تحويل الحجز إلى صفقة: ' + error.message);
    } finally {
      setBusy(false);
    }
  };

  const generateSchedule = async (dealId) => {
    setBusy(true);
    try {
      await rpc('generate_deal_payment_schedule', {
        p_deal_id: dealId,
        p_first_due_date: new Date().toISOString().slice(0, 10)
      });
      await load();
      alert('تم إنشاء جدول الأقساط.');
    } catch (error) {
      alert('فشل إنشاء جدول الأقساط: ' + error.message);
    } finally {
      setBusy(false);
    }
  };

  const financeSummary = useMemo(() => {
    const total = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const paid = payments.filter((payment) => payment.status === 'Paid').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const overdue = payments
      .filter((payment) => payment.status === 'Overdue' || (payment.status === 'Pending' && payment.due_date && new Date(payment.due_date).getTime() < Date.now()))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const pending = payments
      .filter((payment) => !['Paid', 'Cancelled'].includes(payment.status))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return {
      total,
      paid,
      overdue,
      pending,
      collectionRate: total > 0 ? (paid / total) * 100 : 0
    };
  }, [payments]);

  const recordPayment = async (paymentId) => {
    if (!canFinanceManage) return;
    const notes = window.prompt('ملاحظات التحصيل (اختياري):', '') || null;
    setBusy(true);
    try {
      await rpc('record_deal_payment', {
        p_payment_id: paymentId,
        p_paid_at: new Date().toISOString(),
        p_notes: notes
      });
      await load();
    } catch (error) {
      alert('فشل تسجيل التحصيل: ' + error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
        {tabs
          .filter((tab) => tab.key !== 'finance' || canFinanceView)
          .map((tab) => (
            <button
              key={tab.key}
              type='button'
              onClick={() => setActive(tab.key)}
              style={{
                padding: '0.5rem 0.8rem',
                background: active === tab.key ? '#b08a4a' : '#3f321f',
                color: active === tab.key ? '#fffaf0' : '#b08a4a',
                border: '1px solid #b08a4a',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
      </div>

      {active === 'deals' && (
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          {canDeals && (
            <form
              onSubmit={convertReservationToDeal}
              style={{
                ...panel,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
                gap: '0.45rem'
              }}
            >
              <select
                name='reservation_id'
                required
                value={dealForm.reservation_id}
                onChange={(e) => {
                  const reservation = reservations.find((r) => r.id === e.target.value);
                  setDealForm({
                    ...dealForm,
                    reservation_id: e.target.value,
                    deal_value: reservation?.contract_value || '',
                    down_payment: '',
                  });
                }}
                style={input}
              >
                <option value=''>اختر حجزاً لتحويله</option>
                {reservations
                  .filter((r) => ['Pending', 'Confirmed'].includes(r.status))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.leads?.name || '—'} · {r.units?.unit_number || r.units?.title || '—'} · {r.status}
                    </option>
                  ))}
              </select>
              <input name='deal_value' type='number' min='0' required placeholder='قيمة الصفقة' value={dealForm.deal_value} onChange={(e) => setDealForm({ ...dealForm, deal_value: e.target.value })} style={input} />
              <input name='down_payment' type='number' min='0' placeholder='المقدم' value={dealForm.down_payment} onChange={(e) => setDealForm({ ...dealForm, down_payment: e.target.value })} style={input} />
              <input name='installment_months' type='number' min='1' placeholder='مدة التقسيط بالشهور' value={dealForm.installment_months} onChange={(e) => setDealForm({ ...dealForm, installment_months: e.target.value })} style={input} />
              <select name='payment_frequency' value={dealForm.payment_frequency} onChange={(e) => setDealForm({ ...dealForm, payment_frequency: e.target.value })} style={input}>
                <option value='monthly'>شهري</option>
                <option value='quarterly'>ربع سنوي</option>
                <option value='yearly'>سنوي</option>
              </select>
              <input name='first_due_date' type='date' value={dealForm.first_due_date} onChange={(e) => setDealForm({ ...dealForm, first_due_date: e.target.value })} style={input} />
              <input name='commission' type='number' min='0' placeholder='العمولة' value={dealForm.commission} onChange={(e) => setDealForm({ ...dealForm, commission: e.target.value })} style={input} />
              <input name='notes' placeholder='ملاحظات' value={dealForm.notes} onChange={(e) => setDealForm({ ...dealForm, notes: e.target.value })} style={input} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fffaf0', fontSize: '0.75rem' }}>
                <input type='checkbox' checked={dealForm.generate_schedule} onChange={(e) => setDealForm({ ...dealForm, generate_schedule: e.target.checked })} />
                إنشاء جدول أقساط تلقائياً
              </label>
              <button disabled={busy} type='submit' style={{ background: '#b08a4a', color: '#fffaf0', border: 0, borderRadius: 5, fontWeight: 700, padding: '0.5rem' }}>
                تحويل الحجز إلى صفقة
              </button>
            </form>
          )}

          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {deals.map((deal) => (
              <div key={deal.id} style={{ ...panel, fontSize: '0.78rem' }}>
                <strong>{deal.leads?.name || '—'}</strong>
                {' · '}
                {Number(deal.deal_value || 0).toLocaleString()} ج
                {' · '}
                {deal.status}
                {' · '}
                {deal.units?.unit_number || deal.units?.title || 'بدون وحدة'}
                {canDeals && deal.installment_months && !payments.some((p) => p.deal_id === deal.id) && (
                  <button type='button' disabled={busy} onClick={() => generateSchedule(deal.id)} style={{ marginRight: 8, background: '#d9c5a4', border: 0, borderRadius: 5, padding: '0.3rem 0.5rem' }}>
                    إنشاء جدول أقساط
                  </button>
                )}
              </div>
            ))}
            {!deals.length && <div style={{ color: '#9a7b4b' }}>لا توجد صفقات.</div>}
          </div>
        </div>
      )}

      {active === 'reservations' && (
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          {canReservations && (
            <form
              onSubmit={reserveUnit}
              style={{ ...panel, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '0.45rem' }}
            >
              <select name='lead_id' required style={input}>
                <option value=''>العميل</option>
                {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
              </select>
              <select name='unit_id' required style={input}>
                <option value=''>الوحدة المتاحة</option>
                {units
                  .filter((unit) => !unit.status || String(unit.status).toLowerCase() === 'available')
                  .map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unit_number || unit.title} · {unit.price ? Number(unit.price).toLocaleString() + ' ج' : '—'}
                    </option>
                  ))}
              </select>
              <input name='reservation_amount' type='number' min='0' required placeholder='مبلغ الحجز' style={input} />
              <input name='contract_value' type='number' min='0' placeholder='القيمة التعاقدية' style={input} />
              <input name='expires_at' type='datetime-local' placeholder='انتهاء الحجز' style={input} />
              <input name='notes' placeholder='ملاحظات' style={input} />
              <button disabled={busy} type='submit' style={{ background: '#b08a4a', color: '#fffaf0', border: 0, borderRadius: 5, fontWeight: 700 }}>
                تسجيل حجز ذري
              </button>
            </form>
          )}

          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {reservations.map((reservation) => (
              <div key={reservation.id} style={{ ...panel, fontSize: '0.78rem' }}>
                <strong>{reservation.leads?.name || '—'}</strong>
                {' · '}
                {reservation.units?.unit_number || reservation.units?.title || '—'}
                {' · '}
                {Number(reservation.reservation_amount || 0).toLocaleString()} ج
                {' · '}
                {reservation.status}
                {canReservations && ['Pending', 'Confirmed', 'Active'].includes(reservation.status) && (
                  <button
                    type='button'
                    disabled={busy}
                    onClick={() => cancelReservation(reservation.id)}
                    style={{ marginRight: 8, background: '#f59e0b', color: '#fffaf0', border: 0, borderRadius: 5, padding: '0.3rem 0.5rem' }}
                  >
                    إلغاء وفك الوحدة
                  </button>
                )}
              </div>
            ))}
            {!reservations.length && <div style={{ color: '#9a7b4b' }}>لا توجد حجوزات.</div>}
          </div>
        </div>
      )}

      {active === 'calls' && (
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          {canCalls && (
            <form
              onSubmit={(e) => {
                const f = new FormData(e.currentTarget);
                return submit(
                  e,
                  'calls',
                  {
                    lead_id: f.get('lead_id'),
                    assigned_to: currentUser.id,
                    call_at: f.get('call_at') ? new Date(f.get('call_at')).toISOString() : new Date().toISOString(),
                    duration_seconds: Number(f.get('duration_seconds') || 0),
                    outcome: f.get('outcome') || null,
                    notes: f.get('notes') || null
                  },
                  'فشل تسجيل المكالمة'
                );
              }}
              style={{ ...panel, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '0.45rem' }}
            >
              <select name='lead_id' required style={input}><option value=''>العميل</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select>
              <input name='call_at' type='datetime-local' style={input} />
              <input name='duration_seconds' type='number' placeholder='المدة بالثواني' style={input} />
              <input name='outcome' placeholder='نتيجة المكالمة' style={input} />
              <input name='notes' placeholder='ملاحظات' style={input} />
              <button disabled={busy} type='submit' style={{ background: '#b08a4a', border: 0, borderRadius: 5, fontWeight: 700 }}>تسجيل المكالمة</button>
            </form>
          )}
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {calls.map((call) => <div key={call.id} style={{ ...panel, fontSize: '0.78rem' }}>{call.leads?.name || '—'} · {call.outcome || 'بدون نتيجة'} · {call.notes || ''}</div>)}
          </div>
        </div>
      )}

      {active === 'appointments' && (
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          {canAppointments && (
            <form
              onSubmit={(e) => {
                const f = new FormData(e.currentTarget);
                return submit(
                  e,
                  'appointments',
                  {
                    lead_id: f.get('lead_id'),
                    assigned_to: currentUser.id,
                    scheduled_at: new Date(f.get('scheduled_at')).toISOString(),
                    type: f.get('type') || 'Meeting',
                    status: 'Planned',
                    notes: f.get('notes') || null
                  },
                  'فشل إنشاء الموعد'
                );
              }}
              style={{ ...panel, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '0.45rem' }}
            >
              <select name='lead_id' required style={input}><option value=''>العميل</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select>
              <input name='scheduled_at' type='datetime-local' required style={input} />
              <input name='type' placeholder='نوع الموعد' style={input} />
              <input name='notes' placeholder='ملاحظات' style={input} />
              <button disabled={busy} type='submit' style={{ background: '#b08a4a', border: 0, borderRadius: 5, fontWeight: 700 }}>حفظ الموعد</button>
            </form>
          )}
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {appointments.map((appointment) => {
              const calendarUrl = googleCalendarUrl(appointment);
              return (
                <div key={appointment.id} style={{ ...panel, fontSize: '0.78rem' }}>
                  <div>{appointment.leads?.name || '—'} · {new Date(appointment.scheduled_at).toLocaleString('ar-EG')} · {appointment.status}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                    {calendarUrl && (
                      <a
                        href={calendarUrl}
                        target='_blank'
                        rel='noreferrer'
                        style={{ background: '#fffaf0', color: '#765522', border: '1px solid #d9c5a4', borderRadius: 5, padding: '0.3rem 0.5rem', textDecoration: 'none', fontWeight: 700 }}
                      >
                        إضافة إلى Google Calendar
                      </a>
                    )}
                    {appointment.leads?.phone && (
                      <a
                        href={'tel:' + String(appointment.leads.phone).replace(/[^0-9+]/g, '')}
                        style={{ background: '#eaf6ef', color: '#176b4d', borderRadius: 5, padding: '0.3rem 0.5rem', textDecoration: 'none', fontWeight: 700 }}
                      >
                        اتصال
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {active === 'finance' && canFinanceView && (
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          <div style={{ ...panel, color: '#fffaf0', fontSize: '0.78rem' }}>
            التحصيل الآن يتم عبر دالة قاعدة البيانات المسؤولة عن الصلاحيات والتسجيل audit، وليس بإدخال دفعة مباشرة من الواجهة.
          </div>
          <div style={{ display: 'grid', gap: '0.8rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: '0.55rem' }}>
            {[
              ['إجمالي جدول الأقساط', financeSummary.total],
              ['المحصل', financeSummary.paid],
              ['المستحق', financeSummary.pending],
              ['المتأخر', financeSummary.overdue]
            ].map(([label, value]) => (
              <div key={label} style={{ ...panel, padding: '0.7rem' }}>
                <div style={{ color: '#9a7b4b', fontSize: '.68rem' }}>{label}</div>
                <strong style={{ display: 'block', color: label === 'المتأخر' ? '#f59e0b' : '#b08a4a', fontSize: '1.1rem', marginTop: 4 }}>
                  {Number(value || 0).toLocaleString()} ج
                </strong>
              </div>
            ))}
          </div>

          <div style={{ ...panel, color: '#fffaf0', fontSize: '.8rem' }}>
            نسبة التحصيل: <strong style={{ color: '#34d399' }}>{financeSummary.collectionRate.toFixed(1)}%</strong>
            <span style={{ color: '#9a7b4b', marginRight: 8 }}>محصل من إجمالي جدول الدفعات الظاهر ضمن صلاحيات الحساب</span>
          </div>

          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {payments.map((payment) => (
              <div key={payment.id} style={{ ...panel, fontSize: '0.78rem' }}>
                <strong>{payment.deals?.leads?.name || payment.deals?.lead_id || '—'}</strong>
                {' · '}
                قسط {payment.installment_no}
                {' · '}
                {Number(payment.amount || 0).toLocaleString()} ج
                {' · '}
                {payment.status}
                {' · '}
                {payment.due_date}
                {canFinanceManage && payment.status !== 'Paid' && (
                  <button
                    type='button'
                    disabled={busy}
                    onClick={() => recordPayment(payment.id)}
                    style={{ marginRight: 8, background: '#34d399', color: '#3f321f', border: 0, borderRadius: 5, padding: '0.3rem 0.5rem', fontWeight: 700 }}
                  >
                    تحصيل
                  </button>
                )}
              </div>
            ))}
            {!payments.length && <div style={{ color: '#9a7b4b' }}>لا توجد دفعات.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

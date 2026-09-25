import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { can, PERMISSIONS } from '../lib/permissions';

const Card = ({ title, value, note }) => (
  <div style={{ background: '#3f321f', border: '1px solid #d9c5a4', borderRadius: 8, padding: '1rem' }}>
    <div style={{ color: '#806f56', fontSize: '0.72rem' }}>{title}</div>
    <div style={{ color: '#b08a4a', fontSize: '1.35rem', fontWeight: 700, marginTop: '0.25rem' }}>{value}</div>
    {note && <div style={{ color: '#9a7b4b', fontSize: '0.65rem', marginTop: 3 }}>{note}</div>}
  </div>
);

export default function ReportsPanel({ leads = [], tasks = [], userRole = 'sales' }) {
  const [deals, setDeals] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [calls, setCalls] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [units, setUnits] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [stageSummary, setStageSummary] = useState([]);
  const [salesPerformance, setSalesPerformance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.all([
      supabase.from('deals').select('deal_value,status,created_at,sales_person,commission'),
      supabase.from('reservations').select('reservation_amount,status,created_at,sales_person'),
      supabase.from('deal_payments').select('amount,status,due_date,paid_at'),
      supabase.from('followups').select('status,followup_date'),
      supabase.from('calls').select('call_at,outcome'),
      supabase.from('appointments').select('scheduled_at,status'),
      supabase.from('projects').select('id,name'),
      supabase.from('units').select('id,status,price'),
      supabase.from('opportunities').select('id,stage,status,estimated_value,probability,expected_close_date,assigned_to,project_id,updated_at').order('updated_at', { ascending: false }),
      supabase.from('crm_pipeline_stage_summary').select('*').order('stage'),
      supabase.from('crm_sales_performance').select('*').order('won_value', { ascending: false })
    ]).then(([d,r,p,f,c,a,pr,u,o,s,sp]) => {
      if (!active) return;
      setDeals(d.data || []);
      setReservations(r.data || []);
      setPayments(p.data || []);
      setFollowups(f.data || []);
      setCalls(c.data || []);
      setAppointments(a.data || []);
      setProjects(pr.data || []);
      setUnits(u.data || []);
      setOpportunities(o.data || []);
      setStageSummary(s.data || []);
      setSalesPerformance(sp.data || []);
      setLoading(false);
    }).catch(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, []);

  const now = Date.now();

  const wonValue = useMemo(
    () => deals.filter((d) => d.status === 'Won').reduce((sum, d) => sum + Number(d.deal_value || 0), 0),
    [deals]
  );

  const reservedValue = useMemo(
    () => reservations.filter((r) => r.status !== 'Cancelled').reduce((sum, r) => sum + Number(r.reservation_amount || 0), 0),
    [reservations]
  );

  const pendingPayments = useMemo(
    () => payments.filter((p) => p.status !== 'Paid' && p.status !== 'Cancelled').reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [payments]
  );

  const overduePaymentsValue = useMemo(
    () => payments
      .filter((p) => p.status === 'Overdue' || (p.status === 'Pending' && p.due_date && new Date(p.due_date).getTime() < now))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [payments, now]
  );

  const overduePaymentsCount = useMemo(
    () => payments.filter((p) => p.status === 'Overdue' || (p.status === 'Pending' && p.due_date && new Date(p.due_date).getTime() < now)).length,
    [payments, now]
  );

  const pendingFollowups = useMemo(() => followups.filter((f) => f.status === 'Pending').length, [followups]);

  const overdueFollowups = useMemo(
    () => followups.filter((f) => f.status === 'Pending' && f.followup_date && new Date(f.followup_date).getTime() < now).length,
    [followups, now]
  );

  const upcomingAppointments = useMemo(
    () => appointments.filter((a) => a.status === 'Planned' && a.scheduled_at && new Date(a.scheduled_at).getTime() >= now).length,
    [appointments, now]
  );

  const weightedPipeline = useMemo(
    () => opportunities
      .filter((o) => o.status === 'Open')
      .reduce((sum, o) => sum + Number(o.estimated_value || 0) * Number(o.probability || 0) / 100, 0),
    [opportunities]
  );

  const openPipelineValue = useMemo(
    () => opportunities
      .filter((o) => o.status === 'Open')
      .reduce((sum, o) => sum + Number(o.estimated_value || 0), 0),
    [opportunities]
  );

  const sources = useMemo(
    () => leads.reduce((map, lead) => {
      const key = lead.lead_source || 'Unknown';
      map[key] = (map[key] || 0) + 1;
      return map;
    }, {}),
    [leads]
  );

  const pipelineLeadStatus = useMemo(
    () => leads.reduce((map, lead) => {
      const key = lead.status || 'Unknown';
      map[key] = (map[key] || 0) + 1;
      return map;
    }, {}),
    [leads]
  );

  const downloadCsv = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Leads', leads.length],
      ['Opportunities', opportunities.length],
      ['Open Pipeline Value', openPipelineValue],
      ['Weighted Pipeline Value', weightedPipeline],
      ['Pending Followups', pendingFollowups],
      ['Overdue Followups', overdueFollowups],
      ['Calls', calls.length],
      ['Appointments', appointments.length],
      ['Upcoming Appointments', upcomingAppointments],
      ['Projects', projects.length],
      ['Units', units.length],
      ['Deals', deals.length],
      ['Won Deals Value', wonValue],
      ['Reservations Value', reservedValue],
      ['Pending Payments', pendingPayments],
      ['Overdue Payments Count', overduePaymentsCount],
      ['Overdue Payments Value', overduePaymentsValue],
      ...Object.entries(pipelineLeadStatus).map(([key, value]) => ['Lead Status: ' + key, value]),
      ...Object.entries(sources).map(([key, value]) => ['Lead Source: ' + key, value]),
      ...stageSummary.map((row) => ['Opportunity Stage: ' + row.stage, row.opportunities])
    ];

    const csv = '\uFEFF' + rows
      .map((row) => row.map((value) => '"' + String(value).replace(/"/g, '""') + '"').join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ARCOVA_Report.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ color: '#806f56' }}>جاري تحميل التقارير...</div>;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '0.7rem' }}>
        <Card title='العملاء' value={leads.length} />
        <Card title='الفرص' value={opportunities.length} />
        <Card title='قيمة الـPipeline' value={openPipelineValue.toLocaleString() + ' ج'} />
        <Card title='Weighted Pipeline' value={weightedPipeline.toLocaleString() + ' ج'} note='القيمة × نسبة الاحتمال' />
        <Card title='الصفقات الرابحة' value={wonValue.toLocaleString() + ' ج'} />
        <Card title='الحجوزات' value={reservedValue.toLocaleString() + ' ج'} />
        <Card title='دفعات مستحقة' value={pendingPayments.toLocaleString() + ' ج'} />
        <Card title='دفعات متأخرة' value={overduePaymentsValue.toLocaleString() + ' ج'} note={overduePaymentsCount + ' دفعة'} />
        <Card title='متابعات معلقة' value={pendingFollowups} />
        <Card title='متابعات متأخرة' value={overdueFollowups} />
        <Card title='مواعيد قادمة' value={upcomingAppointments} />
        <Card title='الوحدات' value={units.length} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '1rem' }}>
        <div style={{ background: '#3f321f', border: '1px solid #d9c5a4', borderRadius: 8, padding: '1rem' }}>
          <h4 style={{ color: '#b08a4a', marginTop: 0 }}>Opportunity Pipeline</h4>
          {stageSummary.length ? stageSummary.map((row) => (
            <div key={row.stage + row.status} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '.35rem 0', borderBottom: '1px solid #d9c5a4', fontSize: '.75rem' }}>
              <span>{row.stage} · {row.status}</span>
              <strong>{row.opportunities} · {Number(row.pipeline_value || 0).toLocaleString()} ج</strong>
            </div>
          )) : <div style={{ color: '#9a7b4b', fontSize: '.75rem' }}>لا توجد فرص بعد.</div>}
        </div>

        <div style={{ background: '#3f321f', border: '1px solid #d9c5a4', borderRadius: 8, padding: '1rem' }}>
          <h4 style={{ color: '#b08a4a', marginTop: 0 }}>حالة الـLeads</h4>
          {Object.entries(pipelineLeadStatus).map(([key, value]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '.35rem 0', borderBottom: '1px solid #d9c5a4', fontSize: '.75rem' }}>
              <span>{key}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        {salesPerformance.length > 0 && (
          <div style={{ background: '#3f321f', border: '1px solid #d9c5a4', borderRadius: 8, padding: '1rem' }}>
            <h4 style={{ color: '#b08a4a', marginTop: 0 }}>أداء المبيعات</h4>
            {salesPerformance.map((row) => (
              <div key={row.sales_person} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '.35rem 0', borderBottom: '1px solid #d9c5a4', fontSize: '.72rem' }}>
                <span>{row.full_name || row.email || row.sales_person}</span>
                <strong>{Number(row.won_value || 0).toLocaleString()} ج · {row.won_deals || 0} Won</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: '#3f321f', border: '1px solid #d9c5a4', borderRadius: 8, padding: '1rem' }}>
        <h4 style={{ color: '#b08a4a', marginTop: 0 }}>مصادر العملاء</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 6 }}>
          {Object.entries(sources).map(([key, value]) => (
            <div key={key} style={{ background: '#fffaf0', color: '#3f321f', borderRadius: 6, padding: '.5rem .65rem', fontSize: '.72rem' }}>
              {key}: <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>

      {can(userRole, PERMISSIONS.REPORTS_EXPORT) && (
        <button
          type='button'
          onClick={downloadCsv}
          style={{ justifySelf: 'start', padding: '.55rem .9rem', background: '#b08a4a', color: '#fffaf0', border: 0, borderRadius: 5, fontWeight: 700 }}
        >
          تصدير التقرير CSV
        </button>
      )}
    </div>
  );
}

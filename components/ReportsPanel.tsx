import React, { useMemo } from 'react';
import { can, PERMISSIONS } from '../lib/permissions';
import { buildCrmMetrics, FORECAST_STAGE_WEIGHTS } from '../lib/crmMetrics';

export default function ReportsPanel({
  leads = [],
  tasks = [],
  deals = [],
  reservations = [],
  payments = [],
  followups = [],
  calls = [],
  appointments = [],
  projects = [],
  units = [],
  userRole = 'sales'
}) {
  const metrics = useMemo(() => buildCrmMetrics({
    leads,
    deals,
    reservations,
    payments,
    followups,
    calls,
    appointments,
    projects,
    units
  }), [leads, deals, reservations, payments, followups, calls, appointments, projects, units]);

  const downloadCsv = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Active Leads', metrics.totalLeads],
      ['Archived Leads', metrics.archivedLeadsCount],
      ['Interested Leads', metrics.interestedCount],
      ['Closed Won Leads', metrics.closedWonLeadCount],
      ['Conversion Rate %', metrics.conversionRate.toFixed(1)],
      ['Active Lead Budget', metrics.activeLeadBudget],
      ['Weighted Pipeline Forecast', metrics.weightedPipelineForecast],
      ['Followups', followups.length],
      ['Pending Followups', metrics.pendingFollowups],
      ['Overdue Followups', metrics.overdueFollowups],
      ['Calls', calls.length],
      ['Upcoming Appointments', metrics.upcomingAppointments],
      ['Projects', projects.length],
      ['Units', units.length],
      ['Deals', deals.length],
      ['Won Deal Value', metrics.wonDealValue],
      ['Active Reservation Value', metrics.reservedValue],
      ['Pending Payments', metrics.pendingPayments],
      ['Overdue Payments', metrics.overduePayments],
      ...Object.entries(metrics.pipeline).map(([key, value]) => ['Pipeline: ' + key, value]),
      ...Object.entries(metrics.sources).map(([key, value]) => ['Lead Source: ' + key, value]),
      ...Object.entries(metrics.temperatures).map(([key, value]) => ['Temperature: ' + key, value])
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

  const Card = ({ title, value, hint }) => (
    <div style={{ background:'#3f321f', border:'1px solid #d9c5a4', borderRadius:8, padding:'1rem' }}>
      <div style={{ color:'#806f56', fontSize:'.72rem' }}>{title}</div>
      <div style={{ color:'#b08a4a', fontSize:'1.3rem', fontWeight:700, marginTop:'.25rem' }}>{value}</div>
      {hint && <div style={{ color:'#9a7b4b', fontSize:'.68rem', marginTop:'.3rem' }}>{hint}</div>}
    </div>
  );

  return (
    <div style={{ display:'grid', gap:'1rem' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'.7rem' }}>
        <Card title='العملاء الفعّالون' value={metrics.totalLeads} hint={'منهم ' + metrics.archivedLeadsCount + ' مؤرشف'} />
        <Card title='مهتم جداً' value={metrics.interestedCount} />
        <Card title='نسبة التحويل' value={metrics.conversionRate.toFixed(1) + '%'} />
        <Card title='قيمة الصفقات الرابحة' value={metrics.wonDealValue.toLocaleString() + ' ج'} />
        <Card title='قيمة الحجوزات النشطة' value={metrics.reservedValue.toLocaleString() + ' ج'} />
        <Card title='دفعات مستحقة' value={metrics.pendingPayments.toLocaleString() + ' ج'} />
        <Card title='دفعات متأخرة' value={metrics.overduePayments} />
        <Card
          title='Forecast مرجّح'
          value={metrics.weightedPipelineForecast.toLocaleString() + ' ج'}
          hint='Budget × احتمال المرحلة'
        />
      </div>

      <div style={{ background:'#fffaf0', border:'1px solid #d9c5a4', borderRadius:10, padding:'1rem' }}>
        <h4 style={{ color:'#765522', marginTop:0, marginBottom:'.6rem' }}>Forecasting</h4>
        <div style={{ color:'#806f56', fontSize:'.78rem', lineHeight:1.7 }}>
          التوقع هنا ليس صفقة مؤكدة؛ هو قيمة مرجّحة من ميزانيات العملاء النشطين حسب المرحلة الحالية.
          الأوزان الافتراضية: {Object.entries(FORECAST_STAGE_WEIGHTS).map(([stage, weight]) => stage + ' ' + Math.round(weight * 100) + '%').join(' · ')}.
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:'1rem' }}>
        <div style={{ background:'#3f321f', border:'1px solid #d9c5a4', borderRadius:8, padding:'1rem' }}>
          <h4 style={{ color:'#b08a4a', marginTop:0 }}>Pipeline</h4>
          {Object.entries(metrics.pipeline).map(([key, value]) => (
            <div key={key} style={{ display:'flex', justifyContent:'space-between', padding:'.3rem 0', borderBottom:'1px solid #d9c5a4', fontSize:'.78rem' }}>
              <span>{key}</span><strong>{value}</strong>
            </div>
          ))}
          {!Object.keys(metrics.pipeline).length && <div style={{ color:'#9a7b4b', fontSize:'.78rem' }}>لا توجد بيانات.</div>}
        </div>
        <div style={{ background:'#3f321f', border:'1px solid #d9c5a4', borderRadius:8, padding:'1rem' }}>
          <h4 style={{ color:'#b08a4a', marginTop:0 }}>مصادر العملاء</h4>
          {Object.entries(metrics.sources).map(([key, value]) => (
            <div key={key} style={{ display:'flex', justifyContent:'space-between', padding:'.3rem 0', borderBottom:'1px solid #d9c5a4', fontSize:'.78rem' }}>
              <span>{key}</span><strong>{value}</strong>
            </div>
          ))}
          {!Object.keys(metrics.sources).length && <div style={{ color:'#9a7b4b', fontSize:'.78rem' }}>لا توجد بيانات.</div>}
        </div>
        <div style={{ background:'#3f321f', border:'1px solid #d9c5a4', borderRadius:8, padding:'1rem' }}>
          <h4 style={{ color:'#b08a4a', marginTop:0 }}>درجات الحرارة</h4>
          {Object.entries(metrics.temperatures).map(([key, value]) => (
            <div key={key} style={{ display:'flex', justifyContent:'space-between', padding:'.3rem 0', borderBottom:'1px solid #d9c5a4', fontSize:'.78rem' }}>
              <span>{key}</span><strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'.7rem' }}>
        <Card title='المتابعات المعلقة' value={metrics.pendingFollowups} />
        <Card title='المتابعات المتأخرة' value={metrics.overdueFollowups} />
        <Card title='المكالمات' value={calls.length} />
        <Card title='المواعيد القادمة' value={metrics.upcomingAppointments} />
        <Card title='المشاريع' value={projects.length} />
        <Card title='الوحدات' value={units.length} />
      </div>

      {can(userRole, PERMISSIONS.REPORTS_EXPORT) && (
        <button
          type='button'
          onClick={downloadCsv}
          style={{ justifySelf:'start', padding:'.55rem .9rem', background:'#b08a4a', color:'#fffaf0', border:0, borderRadius:5, fontWeight:700 }}
        >
          تصدير التقرير CSV
        </button>
      )}
    </div>
  );
}

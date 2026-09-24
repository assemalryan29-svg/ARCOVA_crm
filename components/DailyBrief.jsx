import React from 'react';

const panel = { background: '#fffaf0', border: '1px solid #d9c5a4', borderRadius: 16, padding: 14 };

function dayStart(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function dayEnd(date = new Date()) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export default function DailyBrief({ leads = [], followups = [], tasks = [], onLeadOpen, onOpenReminders }) {
  const start = dayStart();
  const end = dayEnd();
  const today = leads.filter((lead) => {
    const created = lead.created_at ? new Date(lead.created_at) : null;
    return created && created >= start && created <= end;
  }).length;

  const overdueFollowups = followups.filter((item) => item.status === 'Pending' && item.followup_date && new Date(item.followup_date) < start);
  const todayFollowups = followups.filter((item) => item.status === 'Pending' && item.followup_date && new Date(item.followup_date) >= start && new Date(item.followup_date) <= end);
  const dueTasks = tasks.filter((task) => task.status !== 'Completed' && task.due_date && new Date(task.due_date) <= end);
  const unassigned = leads.filter((lead) => !lead.assigned_to).length;

  const metrics = [
    ['عملاء جدد اليوم', today],
    ['متابعات اليوم', todayFollowups.length],
    ['متابعات متأخرة', overdueFollowups.length],
    ['مهام مستحقة', dueTasks.length],
  ];

  return (
    <section style={{ ...panel, marginBottom: 16, boxShadow: '0 8px 24px rgba(118,85,34,.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: '#765522', fontSize: 18 }}>ملخص اليوم</h2>
          <div style={{ color: '#806f56', fontSize: 12, marginTop: 4 }}>الأولوية للعملاء والمتابعات التي تحتاج إجراء الآن</div>
        </div>
        <button type="button" onClick={onOpenReminders} style={{ minHeight: 40, padding: '0 14px', border: '1px solid #b08a4a', borderRadius: 10, background: '#f5efe3', color: '#765522', fontWeight: 800, cursor: 'pointer' }}>
          فتح المتابعات
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 8 }}>
        {metrics.map(([label, value]) => (
          <div key={label} style={{ background: '#f5efe3', borderRadius: 11, padding: 11 }}>
            <div style={{ color: '#806f56', fontSize: 10 }}>{label}</div>
            <strong style={{ display: 'block', marginTop: 4, color: '#b08a4a', fontSize: 20 }}>{value}</strong>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 7, marginTop: 12 }}>
        {overdueFollowups.slice(0, 3).map((item) => (
          <button key={item.id} type="button" onClick={() => item.lead_id && onLeadOpen(item.lead_id)} style={{ textAlign: 'right', width: '100%', padding: 10, border: '1px solid #e2c0aa', borderRadius: 10, background: '#fff7f2', color: '#6d3526', cursor: 'pointer' }}>
            <strong>متابعة متأخرة</strong> — {item.leads?.name || 'عميل'} · {new Date(item.followup_date).toLocaleString('ar-EG')}
          </button>
        ))}
        {unassigned > 0 && (
          <div style={{ padding: 10, border: '1px solid #d9c5a4', borderRadius: 10, background: '#f5efe3', color: '#806f56', fontSize: 12 }}>
            يوجد {unassigned} عميل غير مخصص لمسؤول.
          </div>
        )}
      </div>
    </section>
  );
}

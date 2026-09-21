import React, { useMemo } from 'react';

export default function PipelineBoard({ leads = [], statusOptions = [], onStatusChange, onOpenLead }) {
  const grouped = useMemo(() => {
    const map = {};
    statusOptions.forEach((s) => { map[s.value] = []; });
    leads.forEach((lead) => {
      const key = map[lead.status] ? lead.status : statusOptions[0]?.value;
      if (key) map[key].push(lead);
    });
    return map;
  }, [leads, statusOptions]);

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + Math.max(statusOptions.length, 1) + ', minmax(220px, 1fr))', gap: '0.8rem', minWidth: (Math.max(statusOptions.length, 1) * 220) + 'px' }}>
        {statusOptions.map((status) => (
          <section key={status.value} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const leadId = e.dataTransfer.getData('text/plain'); if (leadId) onStatusChange?.(leadId, status.value); }} style={{ background: '#3f321faf0', border: '1px solid #d9c5a4', borderRadius: '10px', padding: '0.7rem', minHeight: '360px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
              <strong style={{ color: '#b08a4a', fontSize: '0.82rem' }}>{status.label}</strong>
              <span style={{ background: '#3f321fdf8', color: '#806f56', borderRadius: '999px', padding: '0.15rem 0.45rem', fontSize: '0.7rem' }}>{grouped[status.value]?.length || 0}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(grouped[status.value] || []).map((lead) => (
                <article key={lead.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', lead.id)} onClick={() => onOpenLead?.(lead)} style={{ background: '#3f321fdf8', border: '1px solid #d9c5a4', borderRadius: '8px', padding: '0.7rem', cursor: 'grab' }}>
                  <div style={{ fontWeight: '700', color: '#3f321f', fontSize: '0.82rem' }}>{lead.name || 'بدون اسم'}</div>
                  <div style={{ color: '#806f56', fontSize: '0.72rem', marginTop: '0.25rem' }}>{lead.phone || 'بدون هاتف'}</div>
                  <div style={{ color: '#806f56', fontSize: '0.7rem', marginTop: '0.4rem' }}>{lead.preferred_area || lead.lead_source || '—'}</div>
                  <select value={lead.status || statusOptions[0]?.value} onClick={(e) => e.stopPropagation()} onChange={(e) => onStatusChange?.(lead.id, e.target.value)} style={{ width: '100%', marginTop: '0.55rem', padding: '0.35rem', background: '#3f321faf0', color: '#b08a4a', border: '1px solid #d9c5a4', borderRadius: '5px', fontSize: '0.72rem' }}>
                    {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </article>
              ))}
              {!grouped[status.value]?.length && <div style={{ color: '#9a7b4b', fontSize: '0.72rem', textAlign: 'center', padding: '2rem 0' }}>اسحب عميل هنا</div>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
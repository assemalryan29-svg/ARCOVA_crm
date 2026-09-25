import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { can, PERMISSIONS } from '../lib/permissions';

const box = { background: '#3f321f', border: '1px solid #d9c5a4', borderRadius: 9, padding: '0.8rem' };

export default function AutomationPanel({ userRole = 'sales' }) {
  const [rules, setRules] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const canView = can(userRole, PERMISSIONS.AUTOMATION_VIEW);
  const canManage = can(userRole, PERMISSIONS.AUTOMATION_MANAGE);

  const load = async () => {
    if (!canView) { setLoading(false); return; }
    const [rulesResult, runsResult] = await Promise.all([
      supabase.from('automation_rules').select('*').order('created_at'),
      supabase.from('automation_runs').select('*, automation_rules(name_ar,rule_key)').order('executed_at', { ascending: false }).limit(40)
    ]);
    setRules(rulesResult.data || []);
    setRuns(runsResult.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [canView]);

  const toggle = async (rule) => {
    if (!canManage) return;
    const { error } = await supabase
      .from('automation_rules')
      .update({ is_active: !rule.is_active, updated_at: new Date().toISOString() })
      .eq('id', rule.id);
    if (error) {
      alert('فشل تحديث قاعدة الأتمتة: ' + error.message);
      return;
    }
    await load();
  };

  if (!canView) {
    return <div style={{ ...box, color: '#806f56' }}>ليس لديك صلاحية عرض الأتمتة.</div>;
  }

  if (loading) return <div style={{ color: '#806f56' }}>جاري تحميل الأتمتة...</div>;

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <div style={{ ...box }}>
        <div style={{ color: '#b08a4a', fontWeight: 800, fontSize: '1rem' }}>Automation Engine</div>
        <div style={{ color: '#806f56', fontSize: '0.72rem', marginTop: 4 }}>
          قواعد تعمل تلقائياً على الـLeads والـOpportunities مع سجل تنفيذ ومنع للتكرار.
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.55rem' }}>
        {rules.map((rule) => (
          <div key={rule.id} style={{ ...box, display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.7rem', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#fffaf0', fontWeight: 700, fontSize: '0.82rem' }}>{rule.name_ar}</div>
              <div style={{ color: '#9a7b4b', fontSize: '0.68rem', marginTop: 3 }}>{rule.description || rule.rule_key}</div>
              <div style={{ color: '#806f56', fontSize: '0.65rem', marginTop: 4 }}>
                {rule.trigger_event} · {rule.action_type}
              </div>
            </div>
            <button
              type='button'
              disabled={!canManage}
              onClick={() => toggle(rule)}
              style={{
                minWidth: 86,
                padding: '0.45rem 0.7rem',
                border: 0,
                borderRadius: 6,
                background: rule.is_active ? '#34d399' : '#806f56',
                color: '#3f321f',
                fontWeight: 800,
                opacity: canManage ? 1 : 0.55
              }}
            >
              {rule.is_active ? 'مفعلة' : 'متوقفة'}
            </button>
          </div>
        ))}
        {!rules.length && <div style={{ color: '#9a7b4b' }}>لا توجد قواعد أتمتة.</div>}
      </div>

      <div style={{ ...box }}>
        <div style={{ color: '#b08a4a', fontWeight: 700, marginBottom: 8 }}>آخر عمليات التشغيل</div>
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          {runs.map((run) => (
            <div key={run.id} style={{ background: '#fffaf0', color: '#3f321f', borderRadius: 6, padding: '0.5rem', fontSize: '0.68rem' }}>
              <strong>{run.automation_rules?.name_ar || run.rule_id}</strong>
              {' · '}
              {run.entity_type}
              {' · '}
              {run.status}
              {' · '}
              {new Date(run.executed_at).toLocaleString('ar-EG')}
            </div>
          ))}
          {!runs.length && <div style={{ color: '#9a7b4b', fontSize: '0.72rem' }}>لم يتم تنفيذ قواعد بعد.</div>}
        </div>
      </div>
    </div>
  );
}

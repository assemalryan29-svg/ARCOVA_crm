import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { can, PERMISSIONS } from '../lib/permissions';
import SavedViewsBar from './SavedViewsBar';

const STAGES = [
  { value: 'New', label: '📥 جديد' },
  { value: 'Qualified', label: '✅ مؤهل' },
  { value: 'Site Visit', label: '🏢 معاينة' },
  { value: 'Negotiation', label: '🤝 تفاوض' },
  { value: 'Reserved', label: '🔒 محجوز' },
  { value: 'Won', label: '💰 تم التعاقد' },
  { value: 'Lost', label: '❌ خسرنا الفرصة' }
];

const card = { background: '#3f321f', border: '1px solid #d9c5a4', borderRadius: 10, padding: '0.7rem' };
const input = { width: '100%', padding: '0.5rem', background: '#fffaf0', color: '#3f321f', border: '1px solid #d9c5a4', borderRadius: 6, fontSize: '0.78rem' };

export default function OpportunityPipeline({ leads = [], projects = [], userRole = 'sales' }) {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    lead_id: '', project_id: '', estimated_value: '', probability: 20, expected_close_date: '', notes: ''
  });
  const [pipelineQuery, setPipelineQuery] = useState('');
  const [pipelineStage, setPipelineStage] = useState('');
  const [pipelineProject, setPipelineProject] = useState('');

  const allowed = can(userRole, PERMISSIONS.PIPELINE_MANAGE);

  const load = async () => {
    const { data, error } = await supabase
      .from('opportunities')
      .select('*, leads(name,phone), projects(name), units(unit_number,title,price)')
      .order('updated_at', { ascending: false });
    if (!error) setOpportunities(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filteredOpportunities = useMemo(() => {
    const needle = pipelineQuery.trim().toLowerCase();
    return opportunities.filter((o) => {
      if (pipelineStage && o.stage !== pipelineStage) return false;
      if (pipelineProject && o.project_id !== pipelineProject) return false;
      if (!needle) return true;
      const hay = [o.leads?.name, o.leads?.phone, o.projects?.name, o.units?.unit_number, o.units?.title]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [opportunities, pipelineQuery, pipelineStage, pipelineProject]);

  const grouped = useMemo(() => {
    const result = {};
    STAGES.forEach((s) => { result[s.value] = []; });
    filteredOpportunities.forEach((o) => {
      if (!result[o.stage]) result[o.stage] = [];
      result[o.stage].push(o);
    });
    return result;
  }, [filteredOpportunities]);

  const savedFilters = {
    query: pipelineQuery,
    stage: pipelineStage,
    project: pipelineProject
  };

  const applySavedFilters = (filters = {}) => {
    setPipelineQuery(filters.query || '');
    setPipelineStage(filters.stage || '');
    setPipelineProject(filters.project || '');
  };

  const createOpportunity = async (e) => {
    e.preventDefault();
    if (!allowed || !form.lead_id) return;
    setBusy(true);
    const { error } = await supabase.rpc('create_opportunity', {
      p_lead_id: form.lead_id,
      p_project_id: form.project_id || null,
      p_assigned_to: null,
      p_estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      p_probability: Number(form.probability || 20),
      p_expected_close_date: form.expected_close_date || null,
      p_stage: 'Qualified',
      p_notes: form.notes || null
    });
    setBusy(false);
    if (error) {
      alert('فشل إنشاء الفرصة: ' + error.message);
      return;
    }
    setForm({ lead_id: '', project_id: '', estimated_value: '', probability: 20, expected_close_date: '', notes: '' });
    setShowCreate(false);
    await load();
  };

  const moveStage = async (opportunity, stage) => {
    if (!allowed || stage === opportunity.stage) return;
    const isLost = stage === 'Lost';
    const lostReason = isLost ? window.prompt('سبب خسارة الفرصة (اختياري):', '') : null;
    setBusy(true);
    const { error } = await supabase.rpc('advance_opportunity_stage', {
      p_opportunity_id: opportunity.id,
      p_stage: stage,
      p_status: stage === 'Won' ? 'Won' : stage === 'Lost' ? 'Lost' : 'Open',
      p_notes: 'Stage changed from Pipeline',
      p_lost_reason: lostReason || null
    });
    setBusy(false);
    if (error) {
      alert('فشل نقل الفرصة: ' + error.message);
      return;
    }
    await load();
  };

  if (loading) return <div style={{ color: '#806f56' }}>جاري تحميل الـPipeline...</div>;

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#b08a4a', fontWeight: 700, fontSize: '1rem' }}>Opportunity Pipeline</div>
          <div style={{ color: '#806f56', fontSize: '0.72rem', marginTop: 4 }}>دورة البيع الفعلية من العميل إلى التفاوض والتعاقد.</div>
        </div>
        {allowed && (
          <button type='button' onClick={() => setShowCreate((v) => !v)} style={{ padding: '0.55rem 0.9rem', background: '#b08a4a', color: '#fffaf0', border: 0, borderRadius: 6, fontWeight: 700 }}>
            + فرصة جديدة
          </button>
        )}
      </div>

      {showCreate && allowed && (
        <form onSubmit={createOpportunity} style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '0.55rem' }}>
          <select required value={form.lead_id} onChange={(e) => setForm({ ...form, lead_id: e.target.value })} style={input}>
            <option value=''>اختر العميل</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.phone}</option>)}
          </select>
          <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} style={input}>
            <option value=''>المشروع (اختياري)</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type='number' min='0' placeholder='القيمة المتوقعة' value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} style={input} />
          <input type='number' min='0' max='100' placeholder='Probability %' value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} style={input} />
          <input type='date' value={form.expected_close_date} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} style={input} />
          <input placeholder='ملاحظات' value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={input} />
          <button disabled={busy} type='submit' style={{ background: '#34d399', border: 0, borderRadius: 6, fontWeight: 700 }}>حفظ الفرصة</button>
        </form>
      )}

      <div style={{ display: 'grid', gap: 8, background: '#fffaf0', border: '1px solid #d9c5a4', borderRadius: 9, padding: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 7 }}>
          <input
            value={pipelineQuery}
            onChange={(e) => setPipelineQuery(e.target.value)}
            placeholder='🔎 عميل / هاتف / مشروع / وحدة'
            style={input}
          />
          <select value={pipelineStage} onChange={(e) => setPipelineStage(e.target.value)} style={input}>
            <option value=''>كل المراحل</option>
            {STAGES.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
          </select>
          <select value={pipelineProject} onChange={(e) => setPipelineProject(e.target.value)} style={input}>
            <option value=''>كل المشاريع</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </div>
        <SavedViewsBar
          userRole={userRole}
          module='pipeline'
          filters={savedFilters}
          onLoad={applySavedFilters}
        />
        <div style={{ color: '#806f56', fontSize: '.68rem' }}>
          المعروض: {filteredOpportunities.length} من {opportunities.length} فرصة
        </div>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGES.length},minmax(220px,1fr))`, gap: '0.7rem', minWidth: 1540 }}>
          {STAGES.map((stage) => (
            <section key={stage.value} style={{ ...card, minHeight: 380, background: '#2f2619' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <strong style={{ color: '#b08a4a', fontSize: '0.8rem' }}>{stage.label}</strong>
                <span style={{ background: '#fffaf0', color: '#806f56', borderRadius: 999, padding: '0.15rem 0.45rem', fontSize: '0.68rem' }}>{grouped[stage.value]?.length || 0}</span>
              </div>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {(grouped[stage.value] || []).map((o) => (
                  <article key={o.id} style={{ background: '#fffaf0', color: '#3f321f', border: '1px solid #d9c5a4', borderRadius: 8, padding: '0.6rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{o.leads?.name || 'بدون اسم'}</div>
                    <div style={{ color: '#806f56', fontSize: '0.68rem', marginTop: 3 }}>{o.leads?.phone || 'بدون هاتف'}</div>
                    <div style={{ color: '#806f56', fontSize: '0.68rem', marginTop: 5 }}>{o.projects?.name || 'بدون مشروع'}</div>
                    <div style={{ marginTop: 6, fontSize: '0.72rem', fontWeight: 700 }}>
                      {Number(o.estimated_value || 0).toLocaleString()} ج · {Number(o.probability || 0)}%
                    </div>
                    {allowed && (
                      <select value={o.stage} onChange={(e) => moveStage(o, e.target.value)} style={{ ...input, marginTop: 6, background: '#3f321f', color: '#b08a4a' }}>
                        {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    )}
                  </article>
                ))}
                {!grouped[stage.value]?.length && <div style={{ color: '#9a7b4b', textAlign: 'center', fontSize: '0.7rem', padding: '2rem 0' }}>لا توجد فرص</div>}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

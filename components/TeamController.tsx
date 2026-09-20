import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

const fallbackRoles = [
  { key: 'admin', name_ar: 'مدير النظام' },
  { key: 'ceo', name_ar: 'الرئيس التنفيذي' },
  { key: 'manager', name_ar: 'مدير المبيعات' },
  { key: 'team_leader', name_ar: 'قائد فريق' },
  { key: 'sales', name_ar: 'Sales' },
  { key: 'finance', name_ar: 'المالية' },
  { key: 'marketing', name_ar: 'التسويق' }
];

export default function TeamController({ userRole = 'sales', onSaved }) {
  const canControl = ['admin', 'ceo'].includes(userRole);
  const canManageStructure = ['admin', 'ceo', 'manager'].includes(userRole);
  const [profiles, setProfiles] = useState([]);
  const [roles, setRoles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamManager, setNewTeamManager] = useState('');
  const [newTeamLeader, setNewTeamLeader] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [p, ur, r, t] = await Promise.all([
      supabase.from('profiles').select('id,email,full_name,role,active,team_leader_id,manager_id,team_id').order('email'),
      supabase.from('user_roles').select('id,email,role,active'),
      supabase.from('app_roles').select('key,name_ar,name_en').order('name_ar'),
      supabase.from('teams').select('id,name,manager_id,leader_id,active').order('name')
    ]);

    const roleById = new Map((ur.data || []).map((row) => [row.id, row]));
    const mergedProfiles = (p.data || []).map((profile) => {
      const sourceRole = roleById.get(profile.id);
      return sourceRole
        ? { ...profile, role: sourceRole.role, active: sourceRole.active !== false }
        : profile;
    });

    setProfiles(mergedProfiles);
    setRoles(r.data || []);
    setTeams(t.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const managers = useMemo(() => profiles.filter((p) => ['admin','ceo','manager'].includes(String(p.role || '').toLowerCase())), [profiles]);
  const leaders = useMemo(() => profiles.filter((p) => String(p.role || '').toLowerCase() === 'team_leader'), [profiles]);

  const getDraft = (p) => drafts[p.id] || { role: p.role || 'sales', manager_id: p.manager_id || '', team_leader_id: p.team_leader_id || '', team_id: p.team_id || '', active: p.active !== false };
  const updateDraft = (id, patch) => {
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;
    setDrafts((prev) => ({ ...prev, [id]: { ...getDraft(profile), ...patch } }));
  };

  const saveEmployee = async (profile) => {
    if (!canControl) return;
    const d = getDraft(profile);
    const roleUpdate = await supabase.from('user_roles').update({ role: d.role, active: d.active }).eq('id', profile.id);
    if (roleUpdate.error) { alert('فشل تحديث الدور: ' + roleUpdate.error.message); return; }
    const profileUpdate = await supabase.from('profiles').update({ role: d.role, manager_id: d.manager_id || null, team_leader_id: d.team_leader_id || null, team_id: d.team_id || null, active: d.active }).eq('id', profile.id);
    if (profileUpdate.error) { alert('تم تحديث الدور لكن فشل الهيكل: ' + profileUpdate.error.message); return; }
    alert('تم حفظ الدور والهيكل.');
    await load();
    onSaved?.();
  };

  const createTeam = async (event) => {
    event.preventDefault();
    if (!canManageStructure || !newTeamName.trim()) return;
    const result = await supabase.from('teams').insert([{ name: newTeamName.trim(), manager_id: newTeamManager || null, leader_id: newTeamLeader || null }]);
    if (result.error) { alert('فشل إنشاء الفريق: ' + result.error.message); return; }
    setNewTeamName(''); setNewTeamManager(''); setNewTeamLeader(''); await load();
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ background: '#131822', border: '1px solid #1f2937', borderRadius: '10px', padding: '1rem' }}>
        <h3 style={{ color: '#d4af37', marginTop: 0 }}>هيكل الشركة والتحكم في الأدوار</h3>
        <p style={{ color: '#9ca3af', fontSize: '0.78rem', marginTop: 0 }}>الأدوار والصلاحيات محفوظة في قاعدة البيانات، والتعيين يتم من المتحكم الإداري.</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', fontSize: '0.77rem' }}>
            <thead><tr style={{ color: '#9ca3af', textAlign: 'right' }}><th style={{ padding: '0.6rem' }}>الموظف</th><th>الدور</th><th>المدير</th><th>قائد الفريق</th><th>الفريق</th><th>نشط</th><th></th></tr></thead>
            <tbody>
              {profiles.map((p) => {
                const d = getDraft(p);
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid #1f2937' }}>
                    <td style={{ padding: '0.6rem' }}>{p.full_name || p.email}</td>
                    <td><select disabled={!canControl} value={d.role} onChange={(e) => updateDraft(p.id, { role: e.target.value })} style={{ padding: '0.35rem', background: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px' }}>{(roles.length ? roles : fallbackRoles).map((r) => <option key={r.key} value={r.key}>{r.name_ar || r.key}</option>)}</select></td>
                    <td><select disabled={!canControl} value={d.manager_id} onChange={(e) => updateDraft(p.id, { manager_id: e.target.value })} style={{ padding: '0.35rem', background: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px' }}><option value=''>بدون مدير</option>{managers.filter((m) => m.id !== p.id).map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}</select></td>
                    <td><select disabled={!canControl} value={d.team_leader_id} onChange={(e) => updateDraft(p.id, { team_leader_id: e.target.value })} style={{ padding: '0.35rem', background: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px' }}><option value=''>بدون قائد</option>{leaders.filter((m) => m.id !== p.id).map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}</select></td>
                    <td><select disabled={!canControl} value={d.team_id} onChange={(e) => updateDraft(p.id, { team_id: e.target.value })} style={{ padding: '0.35rem', background: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px' }}><option value=''>بدون فريق</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></td>
                    <td><input disabled={!canControl} type='checkbox' checked={d.active} onChange={(e) => updateDraft(p.id, { active: e.target.checked })} /></td>
                    <td><button type='button' disabled={!canControl} onClick={() => saveEmployee(p)} style={{ padding: '0.35rem 0.6rem', background: canControl ? '#d4af37' : '#374151', border: 0, borderRadius: '4px', color: '#0c0f17', fontWeight: 700 }}>حفظ</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {canManageStructure && <form onSubmit={createTeam} style={{ background: '#131822', border: '1px solid #1f2937', borderRadius: '10px', padding: '1rem' }}>
        <h3 style={{ color: '#d4af37', marginTop: 0 }}>إنشاء فريق جديد</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0.6rem' }}>
          <input required value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder='اسم الفريق' style={{ padding: '0.5rem', background: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '5px' }} />
          <select value={newTeamManager} onChange={(e) => setNewTeamManager(e.target.value)} style={{ padding: '0.5rem', background: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '5px' }}><option value=''>المدير</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}</select>
          <select value={newTeamLeader} onChange={(e) => setNewTeamLeader(e.target.value)} style={{ padding: '0.5rem', background: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '5px' }}><option value=''>قائد الفريق</option>{leaders.map((l) => <option key={l.id} value={l.id}>{l.full_name || l.email}</option>)}</select>
          <button type='submit' style={{ padding: '0.55rem', background: '#d4af37', border: 0, borderRadius: '5px', fontWeight: 700 }}>إضافة الفريق</button>
        </div>
      </form>}
      {loading && <div style={{ color: '#9ca3af', fontSize: '0.78rem' }}>جاري تحميل الهيكل...</div>}
    </div>
  );
}
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

const ROLE_OPTIONS = [
  ['admin', 'مدير النظام'],
  ['ceo', 'الرئيس التنفيذي'],
  ['manager', 'مدير المبيعات'],
  ['team_leader', 'قائد فريق'],
  ['sales', 'Sales'],
  ['finance', 'المالية'],
  ['marketing', 'Marketing'],
  ['operations', 'العمليات'],
  ['support', 'الدعم']
];

const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');

export default function TeamController({ userRole = 'sales', onSaved }) {
  const role = normalize(userRole);
  const canControlRoles = role === 'admin' || role === 'ceo';
  const canManageStructure = canControlRoles || role === 'manager';

  const [profiles, setProfiles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [teamName, setTeamName] = useState('');
  const [teamManager, setTeamManager] = useState('');
  const [teamLeader, setTeamLeader] = useState('');

  const load = async () => {
    setLoading(true);
    setMessage('');

    const [profilesResult, rolesResult, teamsResult] = await Promise.all([
      supabase.from('profiles').select('id,email,full_name,role,active,team_leader_id,manager_id,team_id').order('email'),
      supabase.from('user_roles').select('id,role,active'),
      supabase.from('teams').select('id,name,manager_id,leader_id,active').order('name')
    ]);

    if (profilesResult.error || rolesResult.error || teamsResult.error) {
      setMessage('تعذر تحميل بيانات الموظفين أو الصلاحيات.');
    }

    const roleById = new Map((rolesResult.data || []).map((item) => [item.id, item]));
    const merged = (profilesResult.data || []).map((profile) => {
      const source = roleById.get(profile.id);
      return {
        ...profile,
        role: normalize(source?.role || profile.role || 'sales'),
        active: source?.active !== false && profile.active !== false
      };
    });

    setProfiles(merged);
    setTeams(teamsResult.data || []);
    setDrafts({});
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const managers = useMemo(
    () => profiles.filter((p) => ['admin', 'ceo', 'manager'].includes(normalize(p.role))),
    [profiles]
  );

  const leaders = useMemo(
    () => profiles.filter((p) => normalize(p.role) === 'team_leader'),
    [profiles]
  );

  const getDraft = (profile) => drafts[profile.id] || {
    role: normalize(profile.role) || 'sales',
    manager_id: profile.manager_id || '',
    team_leader_id: profile.team_leader_id || '',
    team_id: profile.team_id || '',
    active: profile.active !== false
  };

  const changeDraft = (id, patch) => {
    const profile = profiles.find((item) => item.id === id);
    if (!profile) return;
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...getDraft(profile), ...patch }
    }));
  };

  const saveEmployee = async (profile) => {
    if (!canControlRoles) {
      setMessage('تعديل أدوار الموظفين متاح للـ Admin أو CEO فقط.');
      return;
    }

    const draft = getDraft(profile);
    const nextRole = normalize(draft.role);
    setMessage('جاري حفظ التعديلات...');

    const roleResult = await supabase
      .from('user_roles')
      .update({ role: nextRole, active: draft.active })
      .eq('id', profile.id);

    if (roleResult.error) {
      setMessage('فشل تحديث الدور: ' + roleResult.error.message);
      return;
    }

    const profileResult = await supabase
      .from('profiles')
      .update({
        role: nextRole,
        manager_id: draft.manager_id || null,
        team_leader_id: draft.team_leader_id || null,
        team_id: draft.team_id || null,
        active: draft.active
      })
      .eq('id', profile.id);

    if (profileResult.error) {
      setMessage('تم تحديث الدور لكن فشل تحديث بيانات الهيكل: ' + profileResult.error.message);
      return;
    }

    setMessage('تم حفظ صلاحيات الموظف بنجاح.');
    await load();
    onSaved?.();
  };

  const createTeam = async (event) => {
    event.preventDefault();
    if (!canManageStructure || !teamName.trim()) return;

    const result = await supabase.from('teams').insert([{
      name: teamName.trim(),
      manager_id: teamManager || null,
      leader_id: teamLeader || null
    }]);

    if (result.error) {
      setMessage('فشل إنشاء الفريق: ' + result.error.message);
      return;
    }

    setTeamName('');
    setTeamManager('');
    setTeamLeader('');
    setMessage('تم إنشاء الفريق بنجاح.');
    await load();
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section style={cardStyle}>
        <h3 style={titleStyle}>فريق العمل والصلاحيات</h3>
        <p style={mutedStyle}>اختَر الموظف، غيّر الدور، ثم اضغط حفظ. التغيير يُسجل في قاعدة البيانات وليس في الواجهة فقط.</p>

        {!canControlRoles && (
          <div style={warningStyle}>
            حسابك الحالي يمكنه مشاهدة الهيكل فقط. تعديل الأدوار متاح للـ Admin أو CEO.
          </div>
        )}

        {message && <div style={{ ...mutedStyle, color: '#b08a4a', marginBottom: 12 }}>{message}</div>}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#806f56', textAlign: 'right' }}>
                <th style={cellStyle}>الموظف</th>
                <th style={cellStyle}>الدور</th>
                <th style={cellStyle}>المدير</th>
                <th style={cellStyle}>قائد الفريق</th>
                <th style={cellStyle}>الفريق</th>
                <th style={cellStyle}>نشط</th>
                <th style={cellStyle}>حفظ</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => {
                const draft = getDraft(profile);
                return (
                  <tr key={profile.id} style={{ borderTop: '1px solid #d9c5a4' }}>
                    <td style={cellStyle}>
                      <div style={{ color: '#3f321f', fontWeight: 700 }}>{profile.full_name || 'بدون اسم'}</div>
                      <div style={{ color: '#806f56', fontSize: 11 }}>{profile.email}</div>
                    </td>
                    <td style={cellStyle}>
                      <select
                        disabled={!canControlRoles}
                        value={draft.role}
                        onChange={(e) => changeDraft(profile.id, { role: e.target.value })}
                        style={selectStyle}
                      >
                        {ROLE_OPTIONS.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td style={cellStyle}>
                      <select
                        disabled={!canControlRoles}
                        value={draft.manager_id}
                        onChange={(e) => changeDraft(profile.id, { manager_id: e.target.value })}
                        style={selectStyle}
                      >
                        <option value="">بدون مدير</option>
                        {managers.filter((m) => m.id !== profile.id).map((m) => (
                          <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                        ))}
                      </select>
                    </td>
                    <td style={cellStyle}>
                      <select
                        disabled={!canControlRoles}
                        value={draft.team_leader_id}
                        onChange={(e) => changeDraft(profile.id, { team_leader_id: e.target.value })}
                        style={selectStyle}
                      >
                        <option value="">بدون قائد</option>
                        {leaders.filter((m) => m.id !== profile.id).map((m) => (
                          <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                        ))}
                      </select>
                    </td>
                    <td style={cellStyle}>
                      <select
                        disabled={!canControlRoles}
                        value={draft.team_id}
                        onChange={(e) => changeDraft(profile.id, { team_id: e.target.value })}
                        style={selectStyle}
                      >
                        <option value="">بدون فريق</option>
                        {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                      </select>
                    </td>
                    <td style={cellStyle}>
                      <input
                        disabled={!canControlRoles}
                        type="checkbox"
                        checked={draft.active}
                        onChange={(e) => changeDraft(profile.id, { active: e.target.checked })}
                      />
                    </td>
                    <td style={cellStyle}>
                      <button
                        type="button"
                        disabled={!canControlRoles}
                        onClick={() => saveEmployee(profile)}
                        style={{
                          background: canControlRoles ? '#b08a4a' : '#d9c5a4',
                          color: '#3f321fdf8',
                          border: 0,
                          borderRadius: 10,
                          padding: '9px 14px',
                          fontWeight: 800,
                          cursor: canControlRoles ? 'pointer' : 'not-allowed'
                        }}
                      >
                        حفظ
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {loading && <div style={mutedStyle}>جاري تحميل بيانات الفريق...</div>}
      </section>

      {canManageStructure && (
        <form onSubmit={createTeam} style={cardStyle}>
          <h3 style={titleStyle}>إنشاء فريق جديد</h3>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
            <input required value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="اسم الفريق" style={inputStyle} />
            <select value={teamManager} onChange={(e) => setTeamManager(e.target.value)} style={selectStyle}>
              <option value="">المدير</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
            </select>
            <select value={teamLeader} onChange={(e) => setTeamLeader(e.target.value)} style={selectStyle}>
              <option value="">قائد الفريق</option>
              {leaders.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
            </select>
            <button type="submit" style={{ background: '#b08a4a', color: '#3f321fdf8', border: 0, borderRadius: 10, fontWeight: 800 }}>
              إضافة الفريق
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const cardStyle = { background: '#3f321faf0', border: '1px solid #d9c5a4', borderRadius: 14, padding: 16 };
const titleStyle = { color: '#b08a4a', marginTop: 0 };
const mutedStyle = { color: '#806f56', fontSize: 13, margin: '8px 0' };
const warningStyle = { color: '#b08a4a', background: '#f1e5d1', border: '1px solid #d9c5a4', borderRadius: 10, padding: 10, marginBottom: 12 };
const cellStyle = { padding: '10px 8px', verticalAlign: 'middle' };
const selectStyle = { padding: '8px 9px', background: '#3f321fdf8', color: '#3f321f', border: '1px solid #d9c5a4', borderRadius: 9, minWidth: 130 };
const inputStyle = { padding: 10, background: '#3f321fdf8', color: '#3f321f', border: '1px solid #d9c5a4', borderRadius: 9 };

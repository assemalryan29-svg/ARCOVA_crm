import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { can, PERMISSIONS } from '../lib/permissions';

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

const emptyDraft = (profile) => ({
  role: normalize(profile.role) || 'sales',
  manager_id: profile.manager_id || '',
  team_leader_id: profile.team_leader_id || '',
  team_id: profile.team_id || '',
  active: profile.active !== false
});

export default function TeamController({ userRole = 'sales', onSaved }) {
  const role = normalize(userRole);
  const canControlRoles = can(role, PERMISSIONS.USERS_MANAGE);
  const canManageStructure = can(role, PERMISSIONS.TEAMS_MANAGE);

  const [profiles, setProfiles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamManager, setTeamManager] = useState('');
  const [teamLeader, setTeamLeader] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const [profilesResult, rolesResult, teamsResult] = await Promise.all([
      supabase.from('profiles').select('id,email,full_name,role,active,team_leader_id,manager_id,team_id').order('email'),
      supabase.from('user_roles').select('id,role,active'),
      supabase.from('teams').select('id,name,manager_id,leader_id,active').eq('active', true).order('name')
    ]);

    const firstError = profilesResult.error || rolesResult.error || teamsResult.error;
    if (firstError) setError(firstError.message || 'تعذر تحميل بيانات فريق العمل.');

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

  const getDraft = (profile) => drafts[profile.id] || emptyDraft(profile);

  const changeDraft = (id, patch) => {
    const profile = profiles.find((item) => item.id === id);
    if (!profile) return;
    setDrafts((prev) => ({ ...prev, [id]: { ...getDraft(profile), ...patch } }));
  };

  const saveEmployee = async (profile) => {
    if (!canControlRoles) {
      setError('تعديل أدوار الموظفين متاح للـ Admin أو CEO فقط.');
      return;
    }

    const draft = getDraft(profile);
    const nextRole = normalize(draft.role);
    setSavingId(profile.id);
    setMessage('');
    setError('');

    try {
      const profileResult = await supabase
        .from('profiles')
        .update({
          role: nextRole,
          manager_id: draft.manager_id || null,
          team_leader_id: draft.team_leader_id || null,
          team_id: draft.team_id || null,
          active: Boolean(draft.active)
        })
        .eq('id', profile.id)
        .select('id')
        .maybeSingle();

      if (profileResult.error) throw new Error('فشل تحديث بيانات الموظف: ' + profileResult.error.message);
      if (!profileResult.data) throw new Error('لم يتم حفظ بيانات الموظف. تحقق من صلاحيات قاعدة البيانات RLS.');

      const roleResult = await supabase
        .from('user_roles')
        .update({ role: nextRole, active: Boolean(draft.active) })
        .eq('id', profile.id)
        .select('id')
        .maybeSingle();

      if (roleResult.error) throw new Error('تم تحديث الموظف لكن فشل تحديث جدول الصلاحيات: ' + roleResult.error.message);
      if (!roleResult.data) throw new Error('لم يتم تحديث جدول الصلاحيات. تأكد أن سجل الموظف موجود في user_roles.');

      setMessage('تم حفظ بيانات الموظف والصلاحيات بنجاح.');
      await load();
      onSaved?.();
    } catch (saveError) {
      setError(saveError.message || 'حدث خطأ أثناء الحفظ.');
    } finally {
      setSavingId('');
    }
  };

  const createTeam = async (event) => {
    event.preventDefault();
    if (!canManageStructure || !teamName.trim()) return;
    setMessage('');
    setError('');

    const result = await supabase.from('teams').insert([{
      name: teamName.trim(),
      manager_id: teamManager || null,
      leader_id: teamLeader || null,
      active: true
    }]).select('id').maybeSingle();

    if (result.error) {
      setError('فشل إنشاء الفريق: ' + result.error.message);
      return;
    }

    setTeamName('');
    setTeamManager('');
    setTeamLeader('');
    setMessage('تم إنشاء الفريق بنجاح.');
    await load();
  };

  return (
    <div className="team-controller" dir="rtl">
      <style jsx>{`
        .team-controller { display: grid; gap: 16px; width: 100%; min-width: 0; }
        .card { background: #fffaf0; border: 1px solid #d9c5a4; border-radius: 14px; padding: 16px; min-width: 0; }
        .title { color: #765522; margin: 0 0 8px; font-size: 20px; }
        .muted { color: #806f56; font-size: 13px; margin: 6px 0 14px; line-height: 1.7; }
        .notice { padding: 11px 12px; border-radius: 10px; margin: 10px 0; line-height: 1.7; font-size: 13px; }
        .error { background: #fff0ed; border: 1px solid #e5b4aa; color: #9f2d20; }
        .success { background: #edf8ed; border: 1px solid #b5d8b8; color: #276738; }
        .table-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid #e4d5bd; border-radius: 10px; }
        table { width: 100%; min-width: 850px; border-collapse: collapse; font-size: 13px; }
        th, td { padding: 10px 8px; text-align: right; vertical-align: middle; border-bottom: 1px solid #e4d5bd; }
        th { color: #806f56; background: #f1e5d1; white-space: nowrap; }
        tr:last-child td { border-bottom: 0; }
        .employee-name { color: #3f321f; font-weight: 800; white-space: nowrap; }
        .employee-email { color: #806f56; font-size: 11px; margin-top: 4px; direction: ltr; text-align: right; }
        select, input { box-sizing: border-box; width: 100%; min-width: 0; padding: 10px 9px; border: 1px solid #d9c5a4; border-radius: 9px; background: #fdf8ee; color: #3f321f; font-size: 13px; }
        select { min-width: 135px; }
        .save-button, .create-button { border: 0; border-radius: 9px; padding: 10px 14px; background: #b08a4a; color: #fffaf0; font-weight: 800; cursor: pointer; white-space: nowrap; }
        .save-button:disabled, .create-button:disabled { opacity: .55; cursor: not-allowed; }
        .team-form { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; align-items: center; }
        @media (max-width: 720px) {
          .card { padding: 12px; }
          .title { font-size: 18px; }
          .team-form { grid-template-columns: 1fr; }
          .team-form input, .team-form select, .team-form button { min-height: 44px; }
          .muted { font-size: 12px; }
        }
      `}</style>

      <section className="card">
        <h3 className="title">فريق العمل والصلاحيات</h3>
        <p className="muted">غيّر الدور أو المدير أو الفريق ثم اضغط حفظ. يتم التحقق من نجاح التحديث في جدول الموظفين وجدول الصلاحيات مع عرض رسالة الخطأ بشكل واضح.</p>

        {!canControlRoles && <div className="notice error">حسابك الحالي يمكنه مشاهدة الهيكل فقط. تعديل الأدوار متاح للـ Admin أو CEO.</div>}
        {error && <div className="notice error">{error}</div>}
        {message && <div className="notice success">{message}</div>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الموظف</th>
                <th>الدور</th>
                <th>المدير</th>
                <th>قائد الفريق</th>
                <th>الفريق</th>
                <th>نشط</th>
                <th>حفظ</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => {
                const draft = getDraft(profile);
                const saving = savingId === profile.id;
                return (
                  <tr key={profile.id}>
                    <td>
                      <div className="employee-name">{profile.full_name || 'بدون اسم'}</div>
                      <div className="employee-email">{profile.email}</div>
                    </td>
                    <td>
                      <select disabled={!canControlRoles || saving} value={draft.role} onChange={(e) => changeDraft(profile.id, { role: e.target.value })}>
                        {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </td>
                    <td>
                      <select disabled={!canControlRoles || saving} value={draft.manager_id} onChange={(e) => changeDraft(profile.id, { manager_id: e.target.value })}>
                        <option value="">بدون مدير</option>
                        {managers.filter((m) => m.id !== profile.id).map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
                      </select>
                    </td>
                    <td>
                      <select disabled={!canControlRoles || saving} value={draft.team_leader_id} onChange={(e) => changeDraft(profile.id, { team_leader_id: e.target.value })}>
                        <option value="">بدون قائد</option>
                        {leaders.filter((m) => m.id !== profile.id).map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
                      </select>
                    </td>
                    <td>
                      <select disabled={!canControlRoles || saving} value={draft.team_id} onChange={(e) => changeDraft(profile.id, { team_id: e.target.value })}>
                        <option value="">بدون فريق</option>
                        {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <input disabled={!canControlRoles || saving} type="checkbox" checked={draft.active} onChange={(e) => changeDraft(profile.id, { active: e.target.checked })} style={{ width: 18, height: 18 }} />
                    </td>
                    <td>
                      <button type="button" className="save-button" disabled={!canControlRoles || saving} onClick={() => saveEmployee(profile)}>{saving ? 'جاري...' : 'حفظ'}</button>
                    </td>
                  </tr>
                );
              })}
              {!profiles.length && !loading && <tr><td colSpan="7">لا توجد بيانات موظفين.</td></tr>}
            </tbody>
          </table>
        </div>
        {loading && <p className="muted">جاري تحميل بيانات الفريق...</p>}
      </section>

      {canManageStructure && (
        <form onSubmit={createTeam} className="card">
          <h3 className="title">إنشاء فريق جديد</h3>
          <div className="team-form">
            <input required value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="اسم الفريق" />
            <select value={teamManager} onChange={(e) => setTeamManager(e.target.value)}><option value="">المدير</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}</select>
            <select value={teamLeader} onChange={(e) => setTeamLeader(e.target.value)}><option value="">قائد الفريق</option>{leaders.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}</select>
            <button type="submit" className="create-button">إضافة الفريق</button>
          </div>
        </form>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { can, normalizeRole, PERMISSIONS } from '../../lib/permissions';

const roles = [
  ['sales', 'Sales'], ['team_leader', 'قائد فريق'], ['manager', 'مدير المبيعات'],
  ['finance', 'المالية'], ['ceo', 'الرئيس التنفيذي'], ['admin', 'مدير النظام'],
  ['marketing', 'Marketing'], ['operations', 'العمليات'], ['support', 'الدعم']
];

export default function NewEmployeePage() {
  const [session, setSession] = useState(null);
  const [allowed, setAllowed] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', role: 'sales',
    manager_id: '', team_leader_id: '', team_id: ''
  });
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = '/';
        return;
      }

      setSession(data.session);
      const roleResult = await supabase
        .from('user_roles')
        .select('role,active')
        .eq('id', data.session.user.id)
        .single();

      const role = normalizeRole(roleResult.data?.role);
      const mayManage = Boolean(roleResult.data?.active) && can(role, PERMISSIONS.USERS_MANAGE);
      setAllowed(mayManage);

      if (!mayManage) {
        setBusy(false);
        return;
      }

      const [profilesResult, teamsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id,full_name,email,role,active')
          .eq('active', true)
          .order('full_name'),
        supabase
          .from('teams')
          .select('id,name,active')
          .eq('active', true)
          .order('name')
      ]);

      if (profilesResult.error || teamsResult.error) {
        setError(profilesResult.error?.message || teamsResult.error?.message || 'تعذر تحميل الهيكل الإداري.');
      }

      setProfiles(profilesResult.data || []);
      setTeams(teamsResult.data || []);
      setBusy(false);
    })();
  }, []);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!allowed || !session) return;
    if (form.full_name.trim().length < 2) return setError('اكتب اسم الموظف بالكامل.');
    if (form.password.length < 8) return setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل.');

    setBusy(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(form)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'تعذر إنشاء الموظف.');

      setMessage(`تم إنشاء الموظف ${result.user.full_name} بنجاح.`);
      setForm({
        full_name: '', email: '', password: '', role: 'sales',
        manager_id: '', team_leader_id: '', team_id: ''
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!session || (busy && !session)) return <div style={page}>جاري التحميل...</div>;

  if (!allowed) {
    return (
      <main dir="rtl" style={page}>
        <div style={shell}>
          <section style={card}>
            <h1 style={title}>إضافة موظف</h1>
            <div style={errorStyle}>لا تملك صلاحية إدارة المستخدمين.</div>
            <button style={secondary} onClick={() => window.location.href = '/dashboard'}>العودة للرئيسية</button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <div style={shell}>
        <header style={header}>
          <div>
            <div style={eyebrow}>ARCOVA CRM</div>
            <h1 style={title}>إضافة موظف جديد</h1>
            <p style={muted}>إنشاء حساب وربطه بالدور والهيكل الإداري بشكل آمن.</p>
          </div>
          <button style={secondary} onClick={() => window.location.href = '/dashboard#team'}>العودة لفريق العمل</button>
        </header>

        <form onSubmit={submit} style={card}>
          <div style={grid}>
            <label style={field}>الاسم بالكامل
              <input style={inputBase} required value={form.full_name} onChange={(e) => update('full_name', e.target.value)} placeholder="اسم الموظف" />
            </label>

            <label style={field}>البريد الإلكتروني
              <input style={inputBase} required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="employee@company.com" />
            </label>

            <label style={field}>كلمة المرور المؤقتة
              <input style={inputBase} required minLength={8} type="password" value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="8 أحرف على الأقل" autoComplete="new-password" />
            </label>

            <label style={field}>الدور
              <select style={inputBase} value={form.role} onChange={(e) => update('role', e.target.value)}>
                {roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <label style={field}>المدير
              <select style={inputBase} value={form.manager_id} onChange={(e) => update('manager_id', e.target.value)}>
                <option value="">بدون مدير</option>
                {profiles.filter((p) => ['admin', 'ceo', 'manager'].includes(String(p.role).toLowerCase())).map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                ))}
              </select>
            </label>

            <label style={field}>قائد الفريق
              <select style={inputBase} value={form.team_leader_id} onChange={(e) => update('team_leader_id', e.target.value)}>
                <option value="">بدون قائد</option>
                {profiles.filter((p) => String(p.role).toLowerCase() === 'team_leader').map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                ))}
              </select>
            </label>

            <label style={field}>الفريق
              <select style={inputBase} value={form.team_id} onChange={(e) => update('team_id', e.target.value)}>
                <option value="">بدون فريق</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          </div>

          {error && <div style={errorStyle}>{error}</div>}
          {message && <div style={success}>{message}</div>}

          <button disabled={busy} type="submit" style={{ ...primary, opacity: busy ? .65 : 1 }}>
            {busy ? 'جاري الإنشاء...' : 'إنشاء الموظف'}
          </button>
        </form>
      </div>
    </main>
  );
}

const page = { minHeight: '100vh', background: '#f5efe3', color: '#3f321f', padding: 20, fontFamily: 'Arial, sans-serif' };
const shell = { maxWidth: 980, margin: '0 auto' };
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 };
const eyebrow = { color: '#765522', letterSpacing: 3, fontWeight: 800, fontSize: 12 };
const title = { margin: '8px 0', color: '#765522', fontSize: 30 };
const muted = { color: '#806f56', margin: 0 };
const card = { background: '#fffaf0', border: '1px solid #d9c5a4', borderRadius: 18, padding: 20, boxShadow: '0 12px 30px rgba(118,85,34,.08)' };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 };
const field = { display: 'grid', gap: 7, fontWeight: 700, fontSize: 14 };
const inputBase = { width: '100%', minWidth: 0, padding: 12, border: '1px solid #d9c5a4', borderRadius: 10, background: '#fdf8ee', color: '#3f321f', boxSizing: 'border-box' };
const primary = { marginTop: 18, padding: '13px 22px', background: '#b08a4a', color: '#fffaf0', border: 0, borderRadius: 10, fontWeight: 800, cursor: 'pointer' };
const secondary = { padding: '11px 15px', background: '#fffaf0', color: '#765522', border: '1px solid #b08a4a', borderRadius: 10, fontWeight: 700, cursor: 'pointer' };
const errorStyle = { marginTop: 14, marginBottom: 14, padding: 12, background: '#fff0ed', color: '#9f2d20', borderRadius: 10 };
const success = { marginTop: 14, padding: 12, background: '#edf8ed', color: '#276738', borderRadius: 10 };

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { can, normalizeRole, PERMISSIONS } from '../lib/permissions';

export default function FoldersPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('sales');
  const [folders, setFolders] = useState([]);
  const [leads, setLeads] = useState([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canCreateFolder = can(role, PERMISSIONS.LEADS_CREATE);
  const canMoveLead = can(role, PERMISSIONS.LEADS_UPDATE);

  const load = async () => {
    setError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/';
      return;
    }

    setUser(session.user);
    const [roleResult, foldersResult, leadsResult] = await Promise.all([
      supabase.from('user_roles').select('role').eq('id', session.user.id).single(),
      supabase.from('lead_folders').select('id,name').eq('active', true).order('name'),
      supabase.from('leads').select('id,name,phone,folder').order('created_at', { ascending: false }),
    ]);

    setRole(normalizeRole(roleResult.data?.role));
    if (foldersResult.error || leadsResult.error) {
      setError(foldersResult.error?.message || leadsResult.error?.message || 'تعذر تحميل البيانات');
    }
    setFolders(foldersResult.data || []);
    setLeads(leadsResult.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesFolder = selected === '__none__' ? !lead.folder : selected ? lead.folder === selected : true;
      const matchesSearch = !query || (lead.name || '').toLowerCase().includes(query) || (lead.phone || '').includes(search.trim());
      return lead.status !== 'Archived' && matchesFolder && matchesSearch;
    });
  }, [leads, selected, search]);

  const create = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    const folderName = name.trim();
    if (!folderName || !user || !canCreateFolder) return;

    const { error: insertError } = await supabase
      .from('lead_folders')
      .insert([{ name: folderName, created_by: user.id, active: true }]);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setName('');
    setMessage('تم إنشاء المجلد بنجاح');
    await load();
  };

  const move = async (id, folder) => {
    if (!canMoveLead) return;
    setMessage('');
    setError('');
    const { error: updateError } = await supabase.from('leads').update({ folder: folder || null }).eq('id', id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setLeads((current) => current.map((lead) => lead.id === id ? { ...lead, folder: folder || null } : lead));
    setMessage('تم تحديث مجلد العميل');
  };

  if (loading) return <div style={page}>جاري التحميل...</div>;

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <header style={head}>
          <div>
            <div style={eyebrow}>ARCOVA CRM</div>
            <h1 style={title}>مجلدات العملاء</h1>
            <p style={subtitle}>تنظيم العملاء ونقلهم بين المجلدات مع احترام صلاحيات الحساب.</p>
          </div>
          <button onClick={() => window.location.assign('/dashboard#leads')} style={secondary}>العودة للعملاء</button>
        </header>

        {(error || message) && <div style={notice(error ? '#9f2d20' : '#276738')}>{error || message}</div>}

        {canCreateFolder && (
          <section style={card}>
            <h2 style={heading}>إنشاء مجلد</h2>
            <form onSubmit={create} style={formRow}>
              <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="اسم المجلد" style={{ ...input, flex: '1 1 220px' }} />
              <button type="submit" style={primary}>+ إنشاء</button>
            </form>
          </section>
        )}

        <section style={card}>
          <h2 style={heading}>المجلدات</h2>
          <div style={formRow}>
            <button onClick={() => setSelected('')} style={!selected ? primary : secondary}>كل العملاء</button>
            <button onClick={() => setSelected('__none__')} style={selected === '__none__' ? primary : secondary}>بدون مجلد</button>
            {folders.map((folder) => (
              <button key={folder.id} onClick={() => setSelected(folder.name)} style={selected === folder.name ? primary : secondary}>{folder.name}</button>
            ))}
          </div>

          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث باسم العميل أو الهاتف" style={{ ...input, width: '100%', margin: '14px 0' }} />

          <div style={tableWrap}>
            <table style={table}>
              <thead><tr><th style={cell}>العميل</th><th style={cell}>الهاتف</th><th style={cell}>المجلد</th><th style={cell}>نقل</th></tr></thead>
              <tbody>
                {visible.map((lead) => (
                  <tr key={lead.id}>
                    <td style={cell}>{lead.name || '-'}</td>
                    <td style={cell}>{lead.phone || '-'}</td>
                    <td style={cell}>{lead.folder || 'بدون مجلد'}</td>
                    <td style={cell}>
                      <select disabled={!canMoveLead} value={lead.folder || ''} onChange={(event) => move(lead.id, event.target.value)} style={{ ...input, width: '100%' }}>
                        <option value="">بدون مجلد</option>
                        {folders.map((folder) => <option key={folder.id} value={folder.name}>{folder.name}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
                {!visible.length && <tr><td style={emptyCell} colSpan={4}>لا توجد نتائج مطابقة</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

const page = { minHeight: '100vh', background: '#f5efe3', color: '#3f321f', padding: 'clamp(12px,3vw,24px)', fontFamily: 'Arial,sans-serif' };
const container = { maxWidth: 1100, width: '100%', margin: 'auto' };
const card = { background: '#fffaf0', border: '1px solid #d9c5a4', borderRadius: 16, padding: 'clamp(12px,3vw,18px)', marginBottom: 16, boxShadow: '0 10px 28px rgba(118,85,34,.07)' };
const head = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 };
const eyebrow = { color: '#9a7b4b', letterSpacing: 2, fontWeight: 800, fontSize: 12 };
const title = { color: '#765522', margin: '5px 0', fontSize: 'clamp(22px,5vw,32px)' };
const subtitle = { color: '#806f56', marginBottom: 0 };
const formRow = { display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' };
const heading = { color: '#765522', fontSize: 18, marginTop: 0 };
const input = { minWidth: 0, padding: '11px 12px', background: '#fffdf8', color: '#3f321f', border: '1px solid #d9c5a4', borderRadius: 10, boxSizing: 'border-box' };
const primary = { background: '#b08a4a', color: '#fffaf0', border: '1px solid #b08a4a', borderRadius: 10, padding: '11px 16px', fontWeight: 700, cursor: 'pointer' };
const secondary = { background: '#fffaf0', color: '#765522', border: '1px solid #b08a4a', borderRadius: 10, padding: '11px 16px', fontWeight: 700, cursor: 'pointer' };
const notice = (color) => ({ color, background: '#fffaf0', border: `1px solid ${color}`, borderRadius: 10, padding: 12, marginBottom: 16, overflowWrap: 'anywhere' });
const tableWrap = { width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' };
const table = { width: '100%', minWidth: 520, borderCollapse: 'collapse' };
const cell = { padding: 12, textAlign: 'right', borderBottom: '1px solid #e5d6be', whiteSpace: 'normal', overflowWrap: 'anywhere' };
const emptyCell = { ...cell, textAlign: 'center', color: '#806f56' };

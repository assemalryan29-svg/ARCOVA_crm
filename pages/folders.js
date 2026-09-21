import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function FoldersPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [folders, setFolders] = useState([]);
  const [leads, setLeads] = useState([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = '/';
      return;
    }

    setUser(session.user);

    const [foldersResult, leadsResult] = await Promise.all([
      supabase
        .from('lead_folders')
        .select('id,name')
        .eq('active', true)
        .order('name'),
      supabase
        .from('leads')
        .select('id,name,phone,folder')
        .order('created_at', { ascending: false }),
    ]);

    if (foldersResult.error || leadsResult.error) {
      setError(
        foldersResult.error?.message ||
          leadsResult.error?.message ||
          'تعذر تحميل البيانات'
      );
    }

    setFolders(foldersResult.data || []);
    setLeads(leadsResult.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const matchesFolder =
        selected === '__none__'
          ? !lead.folder
          : selected
            ? lead.folder === selected
            : true;

      const matchesSearch =
        !query ||
        (lead.name || '').toLowerCase().includes(query) ||
        (lead.phone || '').includes(search.trim());

      return matchesFolder && matchesSearch;
    });
  }, [leads, selected, search]);

  const create = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    const folderName = name.trim();
    if (!folderName || !user) return;

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
    setMessage('');
    setError('');

    const { error: updateError } = await supabase
      .from('leads')
      .update({ folder: folder || null })
      .eq('id', id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setLeads((current) =>
      current.map((lead) =>
        lead.id === id ? { ...lead, folder: folder || null } : lead
      )
    );
    setMessage('تم تحديث مجلد العميل');
  };

  if (loading) return <div style={page}>جاري التحميل...</div>;

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <header style={head}>
          <div>
            <h1 style={title}>📁 مجلدات العملاء</h1>
            <p style={subtitle}>تنظيم العملاء ونقلهم بين المجلدات.</p>
          </div>
          <button
            onClick={() => window.location.assign('/dashboard#leads')}
            style={button('#111827', '#fbbf24')}
          >
            العودة للعملاء
          </button>
        </header>

        {(error || message) && (
          <div style={notice(error ? '#fecaca' : '#fbbf24')}>
            {error || message}
          </div>
        )}

        <section style={card}>
          <h2 style={heading}>إنشاء مجلد</h2>
          <form onSubmit={create} style={formRow}>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="اسم المجلد"
              style={{ ...input, flex: '1 1 180px', minWidth: 0 }}
            />
            <button type="submit" style={button('#fbbf24', '#0c0f17')}>
              + إنشاء
            </button>
          </form>
        </section>

        <section style={card}>
          <h2 style={heading}>المجلدات</h2>
          <div style={formRow}>
            <button
              onClick={() => setSelected('')}
              style={button(!selected ? '#fbbf24' : '#111827', '#fbbf24')}
            >
              كل العملاء
            </button>
            <button
              onClick={() => setSelected('__none__')}
              style={button(selected === '__none__' ? '#fbbf24' : '#111827', '#fbbf24')}
            >
              بدون مجلد
            </button>
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setSelected(folder.name)}
                style={button(
                  selected === folder.name ? '#fbbf24' : '#111827',
                  '#fbbf24'
                )}
              >
                {folder.name}
              </button>
            ))}
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="بحث باسم العميل أو الهاتف"
            style={{ ...input, width: '100%', minWidth: 0, margin: '14px 0' }}
          />

          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={cell}>العميل</th>
                  <th style={cell}>الهاتف</th>
                  <th style={cell}>المجلد</th>
                  <th style={cell}>نقل</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lead) => (
                  <tr key={lead.id}>
                    <td style={cell}>{lead.name || '-'}</td>
                    <td style={cell}>{lead.phone || '-'}</td>
                    <td style={cell}>{lead.folder || 'بدون مجلد'}</td>
                    <td style={cell}>
                      <select
                        value={lead.folder || ''}
                        onChange={(event) => move(lead.id, event.target.value)}
                        style={{ ...input, minWidth: 0, width: '100%' }}
                      >
                        <option value="">بدون مجلد</option>
                        {folders.map((folder) => (
                          <option key={folder.id} value={folder.name}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {!visible.length && (
                  <tr>
                    <td style={emptyCell} colSpan={4}>
                      لا توجد نتائج مطابقة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

const page = {
  minHeight: '100vh',
  background: '#0c0f17',
  color: '#f3f4f6',
  padding: 'clamp(12px, 3vw, 24px)',
  fontFamily: 'Arial, sans-serif',
  boxSizing: 'border-box',
};

const container = { maxWidth: 1100, width: '100%', margin: 'auto' };
const card = {
  background: '#131822',
  border: '1px solid #273244',
  borderRadius: 16,
  padding: 'clamp(12px, 3vw, 18px)',
  marginBottom: 16,
  boxSizing: 'border-box',
};
const head = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  marginBottom: 20,
};
const title = { color: '#fbbf24', margin: 0, fontSize: 'clamp(22px, 5vw, 32px)' };
const subtitle = { color: '#94a3b8', marginBottom: 0 };
const formRow = { display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' };
const heading = { color: '#fbbf24', fontSize: 18, marginTop: 0 };
const input = {
  background: '#0c0f17',
  color: '#fff',
  border: '1px solid #475569',
  borderRadius: 10,
  padding: '11px 12px',
  boxSizing: 'border-box',
};
const button = (background, color) => ({
  background,
  color,
  border: '1px solid #fbbf24',
  borderRadius: 10,
  padding: '11px 16px',
  fontWeight: 700,
  cursor: 'pointer',
  maxWidth: '100%',
});
const notice = (color) => ({
  color,
  border: `1px solid ${color}`,
  borderRadius: 10,
  padding: 12,
  marginBottom: 16,
  overflowWrap: 'anywhere',
});
const tableWrap = {
  width: '100%',
  maxWidth: '100%',
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
};
const table = { width: '100%', minWidth: 520, borderCollapse: 'collapse' };
const cell = {
  padding: 12,
  textAlign: 'right',
  borderBottom: '1px solid #273244',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
};
const emptyCell = { ...cell, textAlign: 'center', color: '#94a3b8' };

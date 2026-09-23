import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ar-EG');
}

export default function DuplicateLeadsPanel() {
  const [groups, setGroups] = useState([]);
  const [primaryByGroup, setPrimaryByGroup] = useState({});
  const [loading, setLoading] = useState(true);
  const [workingKey, setWorkingKey] = useState('');
  const [error, setError] = useState('');

  const loadGroups = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('انتهت الجلسة. سجل الدخول مرة أخرى.');
        return;
      }

      const response = await fetch('/api/leads/duplicates', {
        headers: { Authorization: 'Bearer ' + session.access_token }
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error || 'تعذر تحميل العملاء المكررين.');
        return;
      }

      const nextGroups = result.groups || [];
      setGroups(nextGroups);
      setPrimaryByGroup((prev) => {
        const next = { ...prev };
        for (const group of nextGroups) {
          const key = `${group.identity_type}:${group.identity_key}`;
          const ids = (group.leads || []).map((lead) => lead.id);
          if (!ids.includes(next[key])) next[key] = ids[0] || '';
        }
        return next;
      });
    } catch (err) {
      setError('تعذر الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleMerge = async (group) => {
    const leads = group.leads || [];
    if (leads.length < 2) return;

    const key = `${group.identity_type}:${group.identity_key}`;
    const primaryId = primaryByGroup[key] || leads[0]?.id;
    const primary = leads.find((lead) => lead.id === primaryId) || leads[0];
    const duplicates = leads.filter((lead) => lead.id !== primary.id);
    if (!primary || !duplicates.length) return;

    const duplicateNames = duplicates.map((lead) => lead.name || 'بدون اسم').join('، ');
    const confirmed = window.confirm(
      `سيتم الاحتفاظ بالعميل "${primary.name || 'بدون اسم'}" كسجل أساسي ودمج ${duplicates.length} سجل معه، ثم حذف السجلات المكررة نهائيًا بعد نقل كل الأنشطة المرتبطة.\n\nالمكررات: ${duplicateNames}\n\nهل تؤكد العملية؟`
    );
    if (!confirmed) return;

    setWorkingKey(key);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('انتهت الجلسة. سجل الدخول مرة أخرى.');
        return;
      }

      const response = await fetch('/api/leads/duplicates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token
        },
        body: JSON.stringify({
          primary_id: primary.id,
          duplicate_ids: duplicates.map((lead) => lead.id),
          confirm: true
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || 'فشل دمج العملاء.');
        return;
      }

      await loadGroups();
    } catch (err) {
      setError('تعذر الاتصال بالخادم.');
    } finally {
      setWorkingKey('');
    }
  };

  if (loading) {
    return <div style={{ padding: '1rem', color: '#806f56' }}>جاري تحميل مجموعات التكرار...</div>;
  }

  return (
    <section style={{ backgroundColor: '#fffaf0', border: '1px solid #d9c5a4', borderRadius: 10, padding: '1.2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, color: '#b08a4a', fontFamily: 'serif' }}>مراجعة العملاء المكررين</h3>
          <div style={{ marginTop: 6, color: '#806f56', fontSize: 12 }}>
            الدمج يدوي فقط: اختر السجل الأساسي، وانقل الأنشطة، ثم احذف المكرر داخل معاملة ذرية مع Audit Log.
          </div>
        </div>
        <button type="button" onClick={loadGroups} style={{ padding: '0.5rem 0.8rem', backgroundColor: '#d9c5a4', color: '#3f321f', border: '1px solid #b08a4a', borderRadius: 6, cursor: 'pointer' }}>
          تحديث
        </button>
      </div>

      {error && (
        <div role="alert" style={{ marginBottom: 12, padding: 10, borderRadius: 8, backgroundColor: '#fff1ee', color: '#a7352b' }}>
          {error}
        </div>
      )}

      {!groups.length && !error && (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#806f56' }}>
          لا توجد مجموعات تكرار مسجلة حاليًا.
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {groups.map((group) => {
          const leads = group.leads || [];
          const key = `${group.identity_type}:${group.identity_key}`;
          const selectedPrimaryId = primaryByGroup[key] || leads[0]?.id;
          const primary = leads.find((lead) => lead.id === selectedPrimaryId) || leads[0];
          const busy = workingKey === key;

          return (
            <div key={key} style={{ border: '1px solid #d9c5a4', borderRadius: 8, padding: 12, backgroundColor: '#f5efe3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ color: '#3f321f', fontWeight: 800 }}>
                  {group.identity_type === 'phone' ? 'تكرار رقم الهاتف' : 'تكرار البريد الإلكتروني'}: {group.identity_key}
                </div>
                <span style={{ color: '#806f56', fontSize: 12 }}>
                  {group.duplicate_count} سجلات · آخر ظهور {formatDate(group.last_seen_at)}
                </span>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {leads.map((lead) => {
                  const isPrimary = (primaryByGroup[key] || leads[0]?.id) === lead.id;
                  return (
                    <div key={lead.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: 10, backgroundColor: '#fffaf0', border: isPrimary ? '2px solid #b08a4a' : '1px solid #d9c5a4', borderRadius: 8 }}>
                      <div style={{ minWidth: 220 }}>
                        <div style={{ fontWeight: 800, color: '#3f321f' }}>{lead.name || 'بدون اسم'}</div>
                        <div style={{ fontSize: 12, color: '#806f56', marginTop: 3 }}>{lead.phone || '-'} · {lead.email || '-'}</div>
                        <div style={{ fontSize: 11, color: '#806f56', marginTop: 3 }}>{lead.status || '-'} · {formatDate(lead.created_at)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isPrimary ? (
                          <span style={{ padding: '0.35rem 0.55rem', borderRadius: 5, backgroundColor: '#d9c5a4', color: '#b08a4a', fontWeight: 800, fontSize: 11 }}>السجل الأساسي</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPrimaryByGroup((prev) => ({ ...prev, [key]: lead.id }))}
                            style={{ padding: '0.35rem 0.55rem', borderRadius: 5, backgroundColor: '#fffaf0', color: '#3f321f', border: '1px solid #b08a4a', cursor: 'pointer', fontSize: 11 }}
                          >
                            اختيار كأساسي
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {leads.length >= 2 && (
                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ color: '#806f56', fontSize: 11 }}>
                  السجل الأساسي المحدد: <strong style={{ color: '#3f321f' }}>{primary?.name || 'بدون اسم'}</strong>
                </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleMerge(group)}
                    style={{ padding: '0.55rem 0.9rem', backgroundColor: busy ? '#cbbd9f' : '#a7352b', color: '#fff', border: 0, borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 800 }}
                  >
                    {busy ? 'جاري الدمج...' : 'دمج السجلات المحددة'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

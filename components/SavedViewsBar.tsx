import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { can, PERMISSIONS } from '../lib/permissions';

async function mutate(method, data, id = null) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('انتهت الجلسة.');
  const response = await fetch('/api/crm/mutate', {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ table: 'saved_views', data, id })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'تعذر تنفيذ العملية.');
  return result;
}

export default function SavedViewsBar({ userRole, module = 'leads', filters = {}, onLoad }) {
  const [views, setViews] = useState([]);
  const [selected, setSelected] = useState('');
  const canManage = can(userRole, PERMISSIONS.VIEWS_MANAGE);
  const canView = can(userRole, PERMISSIONS.VIEWS_VIEW);

  const load = async () => {
    if (!canView) return;
    const { data, error } = await supabase
      .from('saved_views')
      .select('id,name,filters,is_shared,created_at,updated_at')
      .eq('module', module)
      .order('name', { ascending: true });
    if (!error) setViews(data || []);
  };

  useEffect(() => { load(); }, [module, canView]);

  const save = async () => {
    if (!canManage) return;
    const name = window.prompt('اسم العرض المحفوظ:');
    if (!name?.trim()) return;
    try {
      await mutate('POST', {
        module,
        name: name.trim(),
        filters,
        is_shared: false
      });
      await load();
      alert('تم حفظ العرض.');
    } catch (error) {
      alert('فشل حفظ العرض: ' + error.message);
    }
  };

  const remove = async () => {
    if (!selected || !canManage) return;
    const view = views.find((item) => item.id === selected);
    if (!view) return;
    if (!window.confirm('حذف العرض المحفوظ "' + view.name + '"؟')) return;
    try {
      await mutate('DELETE', {}, selected);
      setSelected('');
      await load();
    } catch (error) {
      alert('فشل حذف العرض: ' + error.message);
    }
  };

  if (!canView) return null;

  return (
    <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
      <span style={{ color: '#806f56', fontSize: '.7rem', fontWeight: 700 }}>العروض المحفوظة:</span>
      <select
        value={selected}
        onChange={(event) => {
          const value = event.target.value;
          setSelected(value);
          const view = views.find((item) => item.id === value);
          if (view) onLoad?.(view.filters || {});
        }}
        style={{ minWidth: 190, padding: '.45rem .6rem', background: '#fffaf0', color: '#765522', border: '1px solid #d9c5a4', borderRadius: 7, fontSize: '.75rem' }}
      >
        <option value="">اختر عرضًا...</option>
        {views.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
      </select>
      {canManage && <button type="button" onClick={save} style={{ padding: '.45rem .7rem', background: '#b08a4a', color: '#fffaf0', border: 0, borderRadius: 7, fontWeight: 700, cursor: 'pointer' }}>حفظ العرض الحالي</button>}
      {canManage && selected && <button type="button" onClick={remove} style={{ padding: '.45rem .7rem', background: '#fff7f2', color: '#a7352b', border: '1px solid #e2c0aa', borderRadius: 7, fontWeight: 700, cursor: 'pointer' }}>حذف العرض</button>}
    </div>
  );
}

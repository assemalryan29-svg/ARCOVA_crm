import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getCurrentIdentity } from '../lib/auth';
import Customer360 from '../components/Customer360';

export default function Customer360Page() {
  const [leads, setLeads] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const identity = await getCurrentIdentity();
      if (!identity.user) { window.location.href = '/'; return; }
      const { data } = await supabase.from('leads')
        .select('id,name,phone,email,status,assigned_to')
        .order('created_at', { ascending: false });
      setLeads(data || []);
      const queryId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lead_id') : '';
      if (queryId && data?.some((lead) => lead.id === queryId)) setSelected(queryId);
      setLoading(false);
    })();
  }, []);

  const selectedLead = useMemo(() => leads.find((lead) => lead.id === selected) || null, [leads, selected]);

  if (loading) return <main style={{ padding:'2rem', fontFamily:'Arial', background:'#f5efe3', minHeight:'100vh' }}>جاري التحميل...</main>;

  return (
    <main dir='rtl' style={{ padding:'1rem', fontFamily:'Arial', background:'#f5efe3', minHeight:'100vh', color:'#3f321f' }}>
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        <div style={{ display:'flex', gap:'0.8rem', alignItems:'center', flexWrap:'wrap', marginBottom:'1rem' }}>
          <h1 style={{ margin:0, color:'#765522' }}>Customer 360</h1>
          <select value={selected} onChange={(e)=>setSelected(e.target.value)} style={{ minWidth:280, padding:'0.65rem', border:'1px solid #d9c5a4', borderRadius:8, background:'#fffaf0' }}>
            <option value=''>اختيار العميل</option>
            {leads.map((lead)=><option key={lead.id} value={lead.id}>{lead.name} — {lead.phone}</option>)}
          </select>
        </div>
        {selectedLead ? <Customer360 leadId={selectedLead.id} /> : <div style={{ background:'#fffaf0', border:'1px solid #d9c5a4', borderRadius:10, padding:'2rem' }}>اختر عميلًا لعرض الملف الكامل والتاريخ التشغيلي.</div>}
      </div>
    </main>
  );
}

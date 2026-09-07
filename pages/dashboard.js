import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [properties, setProperties] = useState([]);
  const [activeTab, setActiveTab] = useState('leads');

  useEffect(() => {
    checkUserAndFetchData();
  }, []);

  const checkUserAndFetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/';
        return;
      }

      const { data: leadsData } = await supabase.from('leads').select('*');
      if (leadsData) setLeads(leadsData);

      const { data: propsData } = await supabase.from('properties').select('*');
      if (propsData) setProperties(propsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#fff', direction: 'rtl' }}>
        <p>جاري تحميل لوحة التحكم...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#fff', padding: '2rem', fontFamily: 'sans-serif', direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: '#38bdf8' }}>لوحة تحكم ARCOVA</h1>
        <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          تسجيل الخروج
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setActiveTab('leads')} style={{ padding: '0.5rem 1rem', backgroundColor: activeTab === 'leads' ? '#0284c7' : '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          العملاء ({leads.length})
        </button>
        <button onClick={() => setActiveTab('properties')} style={{ padding: '0.5rem 1rem', backgroundColor: activeTab === 'properties' ? '#0284c7' : '#334155', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          العقارات ({properties.length})
        </button>
      </div>

      <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '8px' }}>
        {activeTab === 'leads' ? (
          <div>
            <h3>قائمة العملاء</h3>
            {leads.length === 0 ? <p style={{ color: '#94a3b8' }}>لا يوجد عملاء حالياً</p> : (
              <ul>
                {leads.map((lead) => (
                  <li key={lead.id} style={{ marginBottom: '0.5rem' }}>{lead.name || lead.email || 'عميل بدون اسم'}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div>
            <h3>قائمة العقارات</h3>
            {properties.length === 0 ? <p style={{ color: '#94a3b8' }}>لا توجد عقارات حالياً</p> : (
              <ul>
                {properties.map((prop) => (
                  <li key={prop.id} style={{ marginBottom: '0.5rem' }}>{prop.title || 'عقار بدون عنوان'}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

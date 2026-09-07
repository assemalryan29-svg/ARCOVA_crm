import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [properties, setProperties] = useState([]);
  const [activeTab, setActiveTab] = useState('leads'); // 'leads' or 'properties'

  useEffect(() => {
    checkUserAndFetchData();
  }, []);

  const checkUserAndFetchData = async () => {
    // 1. التحقق من وجود جلسة دخول نشطة
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/');
      return;
    }

    // 2. جلب العملاء (Leads)
    const { data: leadsData } = await supabase.from('leads').select('*').limit(10);
    if (leadsData) setLeads(leadsData);

    // 3. جلب العقارات (Properties)
    const { data: propsData } = await supabase.from('properties').select('*').limit(10);
    if (propsData) setProperties(propsData);

    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#fff', fontFamily: 'sans-serif' }}>
        <p>جاري تحميل لوحة التحكم...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#fff', fontFamily: 'sans-serif', direction: 'rtl' }}>
      {/* شريط الملاحة العلوى */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', backgroundColor: '#1e293b', borderBottom: '1px solid #334155' }}>
        <h1 style={{ fontSize: '1.25rem', color: '#38bdf8', margin: 0 }}>ARCOVA CRM</h1>
        <button 
          onClick={handleLogout}
          style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          تسجيل الخروج
        </button>
      </header>

      {/* المحتوى الرئيسي */}
      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* أزرار التنقل بين الجداول */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button 
            onClick={() => setActiveTab('leads')}
            style={{ 
              padding: '0.75rem 1.5rem', 
              borderRadius: '6px', 
              border: 'none', 
              backgroundColor: activeTab === 'leads' ? '#0284c7' : '#1e293b', 
              color: '#fff', 
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            إدارة العملاء ({leads.length})
          </button>
          <button 
            onClick={() => setActiveTab('properties')}
            style={{ 
              padding: '0.75rem 1.5rem', 
              borderRadius: '6px', 
              border: 'none', 
              backgroundColor: activeTab === 'properties' ? '#0284c7' : '#1e293b', 
              color: '#fff', 
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            إدارة العقارات ({properties.length})
          </button>
        </div>

        {/* عرض جدول العملاء */}
        {activeTab === 'leads' && (
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '1.5rem', overflowX: 'auto' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#38bdf8' }}>قائمة العملاء</h2>
            {leads.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>لا يوجد عملاء حالياً في قاعدة البيانات.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                    <th style={{ padding: '0.75rem' }}>الاسم</th>
                    <th style={{ padding: '0.75rem' }}>الهاتف</th>
                    <th style={{ padding: '0.75rem' }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '0.75rem' }}>{lead.name || lead.full_name || 'بدون اسم'}</td>
                      <td style={{ padding: '0.75rem' }}>{lead.phone || '-'}</td>
                      <td style={{ padding: '0.75rem' }}>{lead.status || 'جديد'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* عرض جدول العقارات */}
        {activeTab === 'properties' && (
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '1.5rem', overflowX: 'auto' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#38bdf8' }}>قائمة العقارات</h2>
            {properties.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>لا توجد عقارات حالياً في قاعدة البيانات.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                    <th style={{ padding: '0.75rem' }}>العنوان / الوحدة</th>
                    <th style={{ padding: '0.75rem' }}>السعر</th>
                    <th style={{ padding: '0.75rem' }}>النوع</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map((prop) => (
                    <tr key={prop.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '0.75rem' }}>{prop.title || prop.name || 'عقار'}</td>
                      <td style={{ padding: '0.75rem' }}>{prop.price ? `${prop.price} ج.م` : '-'}</td>
                      <td style={{ padding: '0.75rem' }}>{prop.type || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

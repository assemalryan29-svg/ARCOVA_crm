import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('sales');
  const [teamMembers, setTeamMembers] = useState([]);
  
  const [leads, setLeads] = useState([]);
  const [leadLogs, setLeadLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('list');
  
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  const [newNote, setNewNote] = useState('');
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'sales' });
  const [newLeadData, setNewLeadData] = useState({ name: '', phone: '', email: '', lead_source: 'Manual' });
  const [searchQuery, setSearchQuery] = useState('');
  const [followUpInput, setFollowUpInput] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [latestNotification, setLatestNotification] = useState(null);

  const statusOptions = [
    { value: 'New Lead', label: '📥 عميل جديد' },
    { value: 'Contacted', label: '📞 تم الاتصال' },
    { value: 'Interested', label: '🔥 مهتم جداً' },
    { value: 'Meeting Set', label: '📅 تم تحديد موعد' },
    { value: 'Closed Won', label: '💰 تم التعاقد' },
    { value: 'Lost', label: '❌ غير مهتم' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/'; return; }
      
      setCurrentUser(session.user);

      const { data: roleData } = await supabase.from('user_roles').select('role').eq('id', session.user.id).single();
      let role = roleData?.role || 'sales';
      if (session.user.email === 'assemryan0@gmail.com') {
        role = 'admin';
      }
      setUserRole(role);

      const { data: usersData } = await supabase.from('user_roles').select('*');
      if (usersData) setTeamMembers(usersData);

      let leadsQuery = supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (role !== 'admin') {
        leadsQuery = leadsQuery.eq('assigned_to', session.user.id);
      }
      const { data: leadsData } = await leadsQuery;
      if (leadsData) setLeads(leadsData || []);
    } catch (err) {
      console.log('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadLogs = async (leadId) => {
    const { data } = await supabase.from('lead_logs').select('*').eq('lead_id', leadId).order('created_at', { ascending: false });
    if (data) setLeadLogs(data);
  };

  const handleOpenLeadDetails = (lead) => {
    setSelectedLead(lead);
    setFollowUpInput(lead.next_follow_up ? new Date(lead.next_follow_up).toISOString().slice(0, 16) : '');
    fetchLeadLogs(lead.id);
  };

  // إضافة عميل يدوياً مع معالجة الأخطاء تماماً
  const handleCreateManualLead = async (e) => {
    e.preventDefault();
    if (!newLeadData.name || !newLeadData.phone) {
      alert('الرجاء إدخال اسم ورقم هاتف العميل');
      return;
    }

    try {
      const { error } = await supabase.from('leads').insert([{
        name: newLeadData.name,
        phone: newLeadData.phone,
        email: newLeadData.email || '',
        lead_source: newLeadData.lead_source,
        status: 'New Lead',
        assigned_to: userRole === 'admin' ? null : currentUser.id
      }]);

      if (error) {
        alert('خطأ في الإضافة: ' + error.message);
      } else {
        alert('تم إضافة العميل بنجاح لمنظومة ARCOVA!');
        setShowAddLeadModal(false);
        setNewLeadData({ name: '', phone: '', email: '', lead_source: 'Manual' });
        fetchData();
      }
    } catch (err) {
      alert('تعذر الاتصال بالخادم، تأكد من اتصال الإنترنت.');
    }
  };

  const handleUpdateLeadStatus = async (leadId, newStatus) => {
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
    if (!error) {
      setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      await supabase.from('lead_logs').insert([{
        lead_id: leadId,
        user_email: currentUser.email,
        action_type: 'Status Change',
        content: `تم تغيير حالة الوحدة/العميل إلى: ${newStatus}`
      }]);
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead({ ...selectedLead, status: newStatus });
        fetchLeadLogs(leadId);
      }
    }
  };

  const handleSaveFollowUp = async (leadId, dateValue) => {
    const { error } = await supabase.from('leads').update({ next_follow_up: dateValue || null }).eq('id', leadId);
    if (!error) {
      setLeads(leads.map(l => l.id === leadId ? { ...l, next_follow_up: dateValue } : l));
      await supabase.from('lead_logs').insert([{
        lead_id: leadId,
        user_email: currentUser.email,
        action_type: 'Follow-up Set',
        content: `تم جدولة ميعاد المتابعة: ${dateValue ? new Date(dateValue).toLocaleString('ar-EG') : 'لا يوجد'}`
      }]);
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead({ ...selectedLead, next_follow_up: dateValue });
        fetchLeadLogs(leadId);
      }
      alert('تم تحديث جدول المتابعات بنجاح');
    }
  };

  const handleAddLogNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    const { error } = await supabase.from('lead_logs').insert([{
      lead_id: selectedLead.id,
      user_email: currentUser.email,
      action_type: 'Note',
      content: newNote
    }]);
    if (!error) {
      setNewNote('');
      fetchLeadLogs(selectedLead.id);
    }
  };

  const handleAssignLead = async (leadId, assigneeId) => {
    const target = teamMembers.find(m => m.id === assigneeId);
    const { error } = await supabase.from('leads').update({ assigned_to: assigneeId || null }).eq('id', leadId);
    if (!error) {
      setLeads(leads.map(l => l.id === leadId ? { ...l, assigned_to: assigneeId } : l));
      await supabase.from('lead_logs').insert([{
        lead_id: leadId,
        user_email: currentUser.email,
        action_type: 'Assign',
        content: `تم إسناد العميل إلى الوسيط/المسؤول: ${target ? target.email : 'غير مخصص'}`
      }]);
      if (selectedLead) fetchLeadLogs(leadId);
    }
  };

  // إضافة موظف مع تخطي مشاكل الـ Fetch المتصفح
  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.auth.signUp({ 
        email: newUser.email, 
        password: newUser.password 
      });

      if (error) {
        alert('ملاحظة التسجيل: ' + error.message);
        return;
      }

      if (data?.user) {
        await supabase.from('user_roles').insert([{ 
          id: data.user.id, 
          email: newUser.email, 
          role: newUser.role 
        }]);
        alert('تم إضافة الموظف بنجاح إلى منظومة ARCOVA!');
        setShowUserModal(false);
        setNewUser({ email: '', password: '', role: 'sales' });
        fetchData();
      }
    } catch (err) {
      alert('خطأ في الاتصال بالشبكة (Failed to fetch). يرجى التأكد من إعدادات مشروع Supabase.');
    }
  };

  const handleExportToExcel = () => {
    if (leads.length === 0) { alert('لا توجد بيانات'); return; }
    const headers = ['Name', 'Phone', 'Email', 'Source', 'Status', 'Next Follow Up'];
    const rows = leads.map(l => [`"${l.name || ''}"`, `"${l.phone || ''}"`, `"${l.email || ''}"`, `"${l.lead_source || ''}"`, `"${l.status || ''}"`, `"${l.next_follow_up || ''}"`]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ARCOVA_Clients.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLeads = leads.filter(l => 
    (l.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (l.phone || '').includes(searchQuery)
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const dueFollowUps = leads.filter(l => {
    if (!l.next_follow_up) return false;
    return new Date(l.next_follow_up).toISOString().slice(0, 10) <= todayStr;
  });

  if (loading) return <div style={{ color: '#d4af37', textAlign: 'center', padding: '5rem', backgroundColor: '#0c0f17', minHeight: '100vh', fontFamily: 'serif' }}>جاري تحميل منظومة ARCOVA العقارية...</div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0c0f17', color: '#f3f4f6', fontFamily: 'sans-serif', direction: 'rtl' }}>
      
      {/* Header الفاخر لهوية ARCOVA */}
      <header style={{ backgroundColor: '#131822', padding: '1rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #d4af37' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <div style={{ width: '42px', height: '52px', border: '2px solid #d4af37', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0c0f17' }}>
            <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '0.9rem', lineHeight: 1 }}>A</span>
            <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '0.9rem', lineHeight: 1 }}>V</span>
          </div>
          <div>
            <h1 style={{ margin: 0, color: '#d4af37', fontSize: '1.4rem', letterSpacing: '2px', fontFamily: 'serif' }}>ARCOVA</h1>
            <span style={{ color: '#9ca3af', fontSize: '0.7rem', letterSpacing: '4px' }}>REAL ESTATE CRM</span>
          </div>
          <span style={{ backgroundColor: userRole === 'admin' ? '#991b1b' : '#075985', color: '#fff', padding: '0.2rem 0.8rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid rgba(212,175,55,0.3)' }}>
            {userRole === 'admin' ? '🛡️ Admin Directorate' : '👤 Sales Agent'}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{currentUser?.email}</span>
          {userRole === 'admin' && (
            <button onClick={() => setShowUserModal(true)} style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', color: '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ إضافة موظف</button>
          )}
          <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')} style={{ padding: '0.5rem 1rem', backgroundColor: '#374151', color: '#f3f4f6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>تسجيل خروج</button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div style={{ backgroundColor: '#131822', padding: '0.6rem 2.5rem', display: 'flex', gap: '0.8rem', borderBottom: '1px solid #1f2937', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('list')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'list' ? '#d4af37' : 'transparent', color: activeTab === 'list' ? '#0c0f17' : '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📑 إدارة العملاء ({leads.length})</button>
          <button onClick={() => setActiveTab('reminders')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'reminders' ? '#d4af37' : 'transparent', color: activeTab === 'reminders' ? '#0c0f17' : '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>⏰ المتابعات والمهام ({dueFollowUps.length})</button>
          {userRole === 'admin' && <button onClick={() => setActiveTab('import')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'import' ? '#d4af37' : 'transparent', color: activeTab === 'import' ? '#0c0f17' : '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📥 استيراد Excel</button>}
          {userRole === 'admin' && <button onClick={() => setActiveTab('team')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'team' ? '#d4af37' : 'transparent', color: activeTab === 'team' ? '#0c0f17' : '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>👥 فريق العمل ({teamMembers.length})</button>}
        </div>

        <button onClick={() => setShowAddLeadModal(true)} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
          + تسجيل عميل جديد
        </button>
      </div>

      <main style={{ padding: '2rem' }}>
        {activeTab === 'list' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <input type="text" placeholder="🔍 بحث باسم العميل أو رقم الهاتف..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', maxWidth: '400px', padding: '0.7rem', backgroundColor: '#131822', border: '1px solid #374151', color: '#fff', borderRadius: '4px' }} />
              <button onClick={handleExportToExcel} style={{ padding: '0.7rem 1.2rem', backgroundColor: '#1f2937', color: '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📊 تصدير قاعدة العملاء</button>
            </div>

            <div style={{ backgroundColor: '#131822', borderRadius: '6px', overflow: 'hidden', border: '1px solid #1f2937' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0c0f17', color: '#d4af37', borderBottom: '1px solid #1f2937' }}>
                    <th style={{ padding: '1rem' }}>العميل ورقم الهاتف</th>
                    <th style={{ padding: '1rem' }}>مصدر العميل</th>
                    <th style={{ padding: '1rem' }}>الحالة العقارية</th>
                    <th style={{ padding: '1rem' }}>الموعد القادم</th>
                    <th style={{ padding: '1rem' }}>المسؤول</th>
                    <th style={{ padding: '1rem' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: '1px solid #1f2937' }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 'bold', color: '#f3f4f6' }}>{lead.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{lead.phone}</div>
                      </td>
                      <td style={{ padding: '1rem', color: '#9ca3af' }}>{lead.lead_source}</td>
                      <td style={{ padding: '1rem' }}>
                        <select value={lead.status || 'New Lead'} onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)} style={{ padding: '0.4rem', backgroundColor: '#0c0f17', color: '#d4af37', border: '1px solid #374151', borderRadius: '4px', fontWeight: 'bold' }}>
                          {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '1rem', color: lead.next_follow_up ? '#34d399' : '#6b7280', fontSize: '0.85rem' }}>
                        {lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : 'غير محدد'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {userRole === 'admin' ? (
                          <select value={lead.assigned_to || ''} onChange={(e) => handleAssignLead(lead.id, e.target.value)} style={{ padding: '0.4rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.85rem' }}>
                            <option value="">غير مخصص</option>
                            {teamMembers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
                          </select>
                        ) : (
                          <span style={{ color: '#34d399', fontSize: '0.85rem' }}>مخصص لك</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <button onClick={() => handleOpenLeadDetails(lead)} style={{ padding: '0.4rem 0.9rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>إدارة السجل</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reminders' && (
          <div style={{ backgroundColor: '#131822', padding: '1.5rem', borderRadius: '6px', border: '1px solid #1f2937' }}>
            <h3 style={{ color: '#d4af37', fontFamily: 'serif' }}>⏰ المتابعات والمهام المستحقة اليوم ({dueFollowUps.length})</h3>
            {dueFollowUps.length === 0 ? (
              <p style={{ color: '#34d399', marginTop: '1rem' }}>ممتاز! جميع المتابعات العقارية منظمة ولا توجد مهام متأخرة.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
                {dueFollowUps.map(lead => (
                  <div key={lead.id} style={{ backgroundColor: '#0c0f17', padding: '1rem', borderRadius: '4px', borderRight: '4px solid #d4af37', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{lead.name} - 📞 {lead.phone}</div>
                      <div style={{ color: '#f87171', fontSize: '0.85rem' }}>موعد المهمة: {new Date(lead.next_follow_up).toLocaleString('ar-EG')}</div>
                    </div>
                    <button onClick={() => handleOpenLeadDetails(lead)} style={{ padding: '0.4rem 1rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>متابعة فورية</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'import' && userRole === 'admin' && (
          <div style={{ backgroundColor: '#131822', padding: '2rem', borderRadius: '6px', maxWidth: '600px', border: '1px solid #1f2937' }}>
            <h3 style={{ color: '#d4af37', fontFamily: 'serif' }}>📥 استيراد قاعدة العملاء (Excel CSV)</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if(!csvFile) return alert('اختر ملفاً أولاً');
              setImporting(true);
              const reader = new FileReader();
              reader.onload = async (event) => {
                const lines = event.target.result.split('\n');
                for (let i = 1; i < lines.length; i++) {
                  const row = lines[i].split(',');
                  if (row.length >= 2 && row[1]) {
                    await supabase.from('leads').insert([{ name: row[0]?.replace(/"/g, '').trim() || 'عميل', phone: row[1]?.replace(/"/g, '').trim(), email: row[2]?.replace(/"/g, '').trim() || '', lead_source: 'Excel', status: 'New Lead' }]);
                  }
                }
                alert('تم الاستيراد بنجاح!');
                setImporting(false);
                fetchData();
              };
              reader.readAsText(csvFile);
            }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files[0])} style={{ padding: '0.8rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151' }} />
              <button type="submit" disabled={importing} style={{ padding: '0.8rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{importing ? 'جاري الرفع...' : 'بدء الاستيراد'}</button>
            </form>
          </div>
        )}

        {activeTab === 'team' && userRole === 'admin' && (
          <div style={{ backgroundColor: '#131822', padding: '1.5rem', borderRadius: '6px', border: '1px solid #1f2937' }}>
            <h3 style={{ color: '#d4af37', fontFamily: 'serif' }}>👥 طاقم عمل المبيعات والإدارة</h3>
            <ul style={{ marginTop: '1rem', paddingRight: '1rem' }}>
              {teamMembers.map(m => <li key={m.id} style={{ margin: '0.5rem 0', color: '#d1d5db' }}>{m.email} - <span style={{ color: '#d4af37' }}>({m.role})</span></li>)}
            </ul>
          </div>
        )}
      </main>

      {/* Modal: إضافة موظف */}
      {showUserModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#131822', padding: '2rem', borderRadius: '6px', width: '380px', border: '1px solid #d4af37' }}>
            <h3 style={{ color: '#d4af37', fontFamily: 'serif', marginTop: 0 }}>إضافة موظف جديد</h3>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
              <input type="email" placeholder="البريد الإلكتروني" required value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} style={{ padding: '0.7rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px' }} />
              <input type="password" placeholder="كلمة المرور (6 خانات فأكثر)" required value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} style={{ padding: '0.7rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px' }} />
              <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} style={{ padding: '0.7rem', backgroundColor: '#0c0f17', color: '#d4af37', border: '1px solid #374151', borderRadius: '4px' }}>
                <option value="sales">Sales Agent</option>
                <option value="admin">Admin Directorate</option>
              </select>
              <button type="submit" style={{ padding: '0.7rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>حفظ الموظف</button>
              <button type="button" onClick={() => setShowUserModal(false)} style={{ padding: '0.6rem', backgroundColor: '#374151', color: '#fff', border: 'none', borderRadius: '4px' }}>إلغاء</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: إضافة عميل يدوياً */}
      {showAddLeadModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#131822', padding: '2rem', borderRadius: '6px', width: '420px', border: '1px solid #d4af37' }}>
            <h3 style={{ color: '#d4af37', fontFamily: 'serif', marginTop: 0 }}>تسجيل عميل عقاري جديد</h3>
            <form onSubmit={handleCreateManualLead} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
              <input type="text" placeholder="اسم العميل *" required value={newLeadData.name} onChange={(e) => setNewLeadData({...newLeadData, name: e.target.value})} style={{ padding: '0.7rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px' }} />
              <input type="text" placeholder="رقم الهاتف *" required value={newLeadData.phone} onChange={(e) => setNewLeadData({...newLeadData, phone: e.target.value})} style={{ padding: '0.7rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px' }} />
              <input type="email" placeholder="البريد الإلكتروني (اختياري)" value={newLeadData.email} onChange={(e) => setNewLeadData({...newLeadData, email: e.target.value})} style={{ padding: '0.7rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px' }} />
              <input type="text" placeholder="المصدر (مثال: Property Finder, Facebook)" value={newLeadData.lead_source} onChange={(e) => setNewLeadData({...newLeadData, lead_source: e.target.value})} style={{ padding: '0.7rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px' }} />
              
              <button type="submit" style={{ padding: '0.7rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>حفظ العميل في المنظومة</button>
              <button type="button" onClick={() => setShowAddLeadModal(false)} style={{ padding: '0.6rem', backgroundColor: '#374151', color: '#fff', border: 'none', borderRadius: '4px' }}>إلغاء</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: تفاصيل العميل وإدارة المهام */}
      {selectedLead && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#131822', padding: '2rem', borderRadius: '6px', width: '620px', maxHeight: '85vh', overflowY: 'auto', border: '1px solid #d4af37' }}>
            <h2 style={{ color: '#d4af37', fontFamily: 'serif', marginTop: 0 }}>ملف العميل: {selectedLead.name}</h2>
            <p style={{ color: '#9ca3af', margin: '0.5rem 0', fontSize: '0.9rem' }}>📞 {selectedLead.phone} | المصدر: {selectedLead.lead_source}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', backgroundColor: '#0c0f17', padding: '1rem', borderRadius: '4px', margin: '1rem 0', border: '1px solid #1f2937' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#d4af37' }}>الحالة العقارية:</span>
                <select value={selectedLead.status || 'New Lead'} onChange={(e) => handleUpdateLeadStatus(selectedLead.id, e.target.value)} style={{ padding: '0.4rem', backgroundColor: '#131822', color: '#d4af37', border: '1px solid #374151', borderRadius: '4px' }}>
                  {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ color: '#d4af37' }}>موعد المتابعة / المهمة:</span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input type="datetime-local" value={followUpInput} onChange={(e) => setFollowUpInput(e.target.value)} style={{ padding: '0.4rem', backgroundColor: '#131822', color: '#fff', border: '1px solid #374151', borderRadius: '4px' }} />
                  <button onClick={() => handleSaveFollowUp(selectedLead.id, followUpInput)} style={{ padding: '0.4rem 0.9rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>حفظ الموعد</button>
                </div>
              </div>
            </div>

            <hr style={{ borderColor: '#1f2937', margin: '1rem 0' }} />
            
            <h3 style={{ color: '#d4af37', fontFamily: 'serif' }}>سجل الملاحظات والمتابعات (Timeline):</h3>
            <form onSubmit={handleAddLogNote} style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
              <input placeholder="أضف ملاحظة أو تفاصيل زيارة الوحدة..." value={newNote} onChange={(e) => setNewNote(e.target.value)} style={{ flex: 1, padding: '0.6rem', backgroundColor: '#0c0f17', border: '1px solid #374151', color: '#fff', borderRadius: '4px' }} />
              <button type="submit" style={{ padding: '0.6rem 1.2rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>إضافة</button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {leadLogs.map(log => (
                <div key={log.id} style={{ backgroundColor: '#0c0f17', padding: '0.8rem', borderRadius: '4px', borderRight: '3px solid #d4af37', border: '1px solid #1f2937' }}>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{log.user_email} - {new Date(log.created_at).toLocaleString('ar-EG')}</div>
                  <div style={{ marginTop: '0.3rem', color: '#f3f4f6' }}>{log.content}</div>
                </div>
              ))}
            </div>

            <button onClick={() => setSelectedLead(null)} style={{ marginTop: '1.5rem', padding: '0.5rem 1rem', backgroundColor: '#374151', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>إغلاق النافذة</button>
          </div>
        </div>
      )}

    </div>
  );
}


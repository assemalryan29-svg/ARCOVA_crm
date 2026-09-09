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
  const [selectedLead, setSelectedLead] = useState(null);

  const [newNote, setNewNote] = useState('');
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'sales' });
  const [searchQuery, setSearchQuery] = useState('');
  const [followUpInput, setFollowUpInput] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);

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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }
    
    setCurrentUser(session.user);

    const { data: roleData } = await supabase.from('user_roles').select('role').eq('id', session.user.id).single();
    const role = roleData?.role || 'sales';
    setUserRole(role);

    const { data: usersData } = await supabase.from('user_roles').select('*');
    if (usersData) setTeamMembers(usersData);

    let leadsQuery = supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (role !== 'admin') {
      leadsQuery = leadsQuery.eq('assigned_to', session.user.id);
    }
    const { data: leadsData } = await leadsQuery;
    if (leadsData) setLeads(leadsData || []);

    setLoading(false);
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

  const handleUpdateLeadStatus = async (leadId, newStatus) => {
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
    if (!error) {
      setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      await supabase.from('lead_logs').insert([{
        lead_id: leadId,
        user_email: currentUser.email,
        action_type: 'Status Change',
        content: `تم تغيير حالة العميل إلى: ${newStatus}`
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
        content: `تم تحديد موعد متابعة جديد: ${dateValue ? new Date(dateValue).toLocaleString('ar-EG') : 'لا يوجد'}`
      }]);
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead({ ...selectedLead, next_follow_up: dateValue });
        fetchLeadLogs(leadId);
      }
      alert('تم تحديث موعد المتابعة بنجاح');
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
        content: `تم تحويل العميل إلى: ${target ? target.email : 'غير مخصص'}`
      }]);
      if (selectedLead) fetchLeadLogs(leadId);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signUp({ email: newUser.email, password: newUser.password });
    if (error) {
      alert('خطأ: ' + error.message);
    } else if (data.user) {
      await supabase.from('user_roles').insert([{ id: data.user.id, email: newUser.email, role: newUser.role }]);
      alert('تم إنشاء حساب الموظف بنجاح');
      setShowUserModal(false);
      setNewUser({ email: '', password: '', role: 'sales' });
      fetchData();
    }
  };

  const handleExportToExcel = () => {
    if (leads.length === 0) {
      alert('لا توجد بيانات عملاء لتصديرها');
      return;
    }

    const headers = ['Name', 'Phone', 'Email', 'Source', 'Status', 'Next Follow Up'];
    const rows = leads.map(l => [
      `"${l.name || ''}"`,
      `"${l.phone || ''}"`,
      `"${l.email || ''}"`,
      `"${l.lead_source || ''}"`,
      `"${l.status || ''}"`,
      `"${l.next_follow_up ? new Date(l.next_follow_up).toLocaleString('ar-EG') : ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Arcova_Leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCsv = async (e) => {
    e.preventDefault();
    if (!csvFile) {
      alert('الرجاء اختيار ملف CSV أولاً');
      return;
    }

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n');
        const rows = lines.map(line => line.split(','));

        let insertedCount = 0;
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length >= 2 && row[1]) {
            const name = row[0]?.replace(/"/g, '')?.trim() || 'عميل مستورد';
            const phone = row[1]?.replace(/"/g, '')?.trim();
            const email = row[2]?.replace(/"/g, '')?.trim() || '';
            const lead_source = row[3]?.replace(/"/g, '')?.trim() || 'Excel Import';

            if (phone) {
              await supabase.from('leads').insert([{
                name,
                phone,
                email,
                lead_source,
                status: 'New Lead'
              }]);
              insertedCount++;
            }
          }
        }

        alert(`تم استيراد ${insertedCount} عميل بنجاح!`);
        setCsvFile(null);
        setImporting(false);
        setActiveTab('list');
        fetchData();
      } catch (err) {
        alert('حدث خطأ أثناء قراءة الملف: ' + err.message);
        setImporting(false);
      }
    };
    reader.readAsText(csvFile);
  };

  const filteredLeads = leads.filter(l => 
    (l.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (l.phone || '').includes(searchQuery)
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const dueFollowUps = leads.filter(l => {
    if (!l.next_follow_up) return false;
    const followDate = new Date(l.next_follow_up).toISOString().slice(0, 10);
    return followDate <= todayStr;
  });

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '5rem', backgroundColor: '#0f172a', minHeight: '100vh' }}>جاري التحميل...</div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'sans-serif', direction: 'rtl' }}>
      
      {/* Header */}
      <header style={{ backgroundColor: '#1e293b', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0, color: '#38bdf8' }}>ARCOVA CRM</h2>
          <span style={{ backgroundColor: userRole === 'admin' ? '#ef4444' : '#0284c7', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
            {userRole === 'admin' ? '🛡️ Admin' : '👤 Sales'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{currentUser?.email}</span>
          {userRole === 'admin' && (
            <button onClick={() => setShowUserModal(true)} style={{ padding: '0.5rem 1rem', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>+ إضافة موظف</button>
          )}
          <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')} style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>خروج</button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ backgroundColor: '#1e293b', padding: '0.5rem 2rem', display: 'flex', gap: '0.5rem', borderBottom: '1px solid #334155', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('list')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'list' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📑 العملاء ({leads.length})</button>
        <button onClick={() => setActiveTab('reminders')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'reminders' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>⏰ التذكيرات ({dueFollowUps.length})</button>
        {userRole === 'admin' && (
          <button onClick={() => setActiveTab('import')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'import' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📥 استيراد Excel</button>
        )}
        {userRole === 'admin' && (
          <button onClick={() => setActiveTab('team')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'team' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>👥 فريق العمل ({teamMembers.length})</button>
        )}
      </div>

      {/* Main Container */}
      <main style={{ padding: '1.5rem' }}>
        
        {/* Leads List Tab */}
        {activeTab === 'list' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <input type="text" placeholder="🔍 بحث باسم العميل أو الهاتف..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', maxWidth: '400px', padding: '0.6rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
              
              <button onClick={handleExportToExcel} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                📊 تصدير العملاء لملف Excel
              </button>
            </div>

            <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>
                    <th style={{ padding: '1rem' }}>الاسم والهاتف</th>
                    <th style={{ padding: '1rem' }}>المصدر</th>
                    <th style={{ padding: '1rem' }}>الحالة</th>
                    <th style={{ padding: '1rem' }}>موعد المتابعة</th>
                    <th style={{ padding: '1rem' }}>المسؤول</th>
                    <th style={{ padding: '1rem' }}>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 'bold' }}>{lead.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{lead.phone}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>{lead.lead_source}</td>
                      <td style={{ padding: '1rem' }}>
                        <select 
                          value={lead.status || 'New Lead'} 
                          onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)}
                          style={{ padding: '0.4rem', backgroundColor: '#0f172a', color: '#38bdf8', border: '1px solid #334155', borderRadius: '4px', fontWeight: 'bold' }}
                        >
                          {statusOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem', color: lead.next_follow_up ? '#34d399' : '#94a3b8' }}>
                        {lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : 'غير محدد'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {userRole === 'admin' ? (
                          <select value={lead.assigned_to || ''} onChange={(e) => handleAssignLead(lead.id, e.target.value)} style={{ padding: '0.4rem', backgroundColor: '#0f172a', color: lead.assigned_to ? '#34d399' : '#f87171', border: '1px solid #334155', borderRadius: '4px' }}>
                            <option value="">غير مخصص</option>
                            {teamMembers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
                          </select>
                        ) : (
                          <span style={{ color: '#34d399' }}>مخصص لك</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <button onClick={() => handleOpenLeadDetails(lead)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>التفاصيل والمتابعة</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reminders Tab */}
        {activeTab === 'reminders' && (
          <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '8px' }}>
            <h3>⏰ التذكيرات والمتابعات المستحقة ({dueFollowUps.length})</h3>
            {dueFollowUps.length === 0 ? (
              <p style={{ color: '#34d399', marginTop: '1rem' }}>رائع! ليس لديك أي متابعات متأخرة اليوم.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
                {dueFollowUps.map(lead => (
                  <div key={lead.id} style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '6px', borderRight: '4px solid #ef4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{lead.name} - 📞 {lead.phone}</div>
                      <div style={{ color: '#f87171', fontSize: '0.85rem', marginTop: '0.3rem' }}>
                        موعد المتابعة: {new Date(lead.next_follow_up).toLocaleString('ar-EG')}
                      </div>
                    </div>
                    <button onClick={() => handleOpenLeadDetails(lead)} style={{ padding: '0.5rem 1rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>متابعة العميل</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CSV Import Tab */}
        {activeTab === 'import' && userRole === 'admin' && (
          <div style={{ backgroundColor: '#1e293b', padding: '2rem', borderRadius: '8px', maxWidth: '600px' }}>
            <h3>📥 استيراد بيانات العملاء (CSV)</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0.8rem 0 1.5rem 0' }}>
              قم برفع ملف CSV بحيث يكون الترتيب في الأعمدة كالتالي: <br/>
              <code>الاسم (Name), الهاتف (Phone), البريد (Email), المصدر (Source)</code>
            </p>
            
            <form onSubmit={handleImportCsv} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input 
                type="file" 
                accept=".csv" 
                onChange={(e) => setCsvFile(e.target.files[0])}
                style={{ padding: '0.8rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#fff' }} 
              />
              <button 
                type="submit" 
                disabled={importing}
                style={{ padding: '0.8rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {importing ? 'جاري الاستيراد...' : 'رفع واستيراد العملاء'}
              </button>
            </form>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && userRole === 'admin' && (
          <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '8px' }}>
            <h3>👥 قائمة الموظفين</h3>
            <ul>
              {teamMembers.map(m => (
                <li key={m.id} style={{ marginBottom: '0.5rem' }}>{m.email} - ({m.role})</li>
              ))}
            </ul>
          </div>
        )}
      </main>

      {/* New User Modal */}
      {showUserModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1e293b', padding: '2rem', borderRadius: '8px', width: '350px' }}>
            <h3>إضافة موظف جديد</h3>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
              <input type="email" placeholder="البريد الإلكتروني" required value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }} />
              <input type="password" placeholder="كلمة المرور" required value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }} />
              <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0f172a', color: '#fff' }}>
                <option value="sales">Sales</option>
                <option value="admin">Admin</option>
              </select>
              <button type="submit" style={{ padding: '0.6rem', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>حفظ</button>
              <button type="button" onClick={() => setShowUserModal(false)} style={{ padding: '0.6rem', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px' }}>إلغاء</button>
            </form>
          </div>
        </div>
      )}

      {/* Lead Details Modal */}
      {selectedLead && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1e293b', padding: '2rem', borderRadius: '8px', width: '600px', maxHeight: '85vh', overflowY: 'auto' }}>
            <h2>تفاصيل العميل: {selectedLead.name}</h2>
            <p style={{ color: '#94a3b8', margin: '0.5rem 0' }}>📞 الهاتف: {selectedLead.phone} | المصدر: {selectedLead.lead_source}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', backgroundColor: '#0f172a', padding: '1rem', borderRadius: '6px', margin: '1rem 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>حالة العميل:</span>
                <select 
                  value={selectedLead.status || 'New Lead'} 
                  onChange={(e) => handleUpdateLeadStatus(selectedLead.id, e.target.value)}
                  style={{ padding: '0.4rem', backgroundColor: '#1e293b', color: '#38bdf8', border: '1px solid #334155', borderRadius: '4px', fontWeight: 'bold' }}
                >
                  {statusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span>موعد التذكير القادم:</span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input 
                    type="datetime-local" 
                    value={followUpInput} 
                    onChange={(e) => setFollowUpInput(e.target.value)}
                    style={{ padding: '0.4rem', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '4px' }}
                  />
                  <button onClick={() => handleSaveFollowUp(selectedLead.id, followUpInput)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>حفظ</button>
                </div>
              </div>
            </div>

            <hr style={{ borderColor: '#334155', margin: '1rem 0' }} />
            
            <h3>الملاحظات وسجل التواصل (Timeline):</h3>
            <form onSubmit={handleAddLogNote} style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
              <input placeholder="أضف ملاحظة جديدة..." value={newNote} onChange={(e) => setNewNote(e.target.value)} style={{ flex: 1, padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '4px' }} />
              <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>إضافة</button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {leadLogs.map(log => (
                <div key={log.id} style={{ backgroundColor: '#0f172a', padding: '0.6rem', borderRadius: '4px', borderRight: '3px solid #38bdf8' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{log.user_email} - {new Date(log.created_at).toLocaleString('ar-EG')}</div>
                  <div style={{ marginTop: '0.3rem' }}>{log.content}</div>
                </div>
              ))}
            </div>

            <button onClick={() => setSelectedLead(null)} style={{ marginTop: '1.5rem', padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>إغلاق</button>
          </div>
        </div>
      )}

    </div>
  );
}

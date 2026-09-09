import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('sales');
  const [teamMembers, setTeamMembers] = useState([]);
  
  const [leads, setLeads] = useState([]);
  const [units, setUnits] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [leadLogs, setLeadLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('list');
  
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  const [newNote, setNewNote] = useState('');
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'sales' });
  const [searchQuery, setSearchQuery] = useState('');

  const initialFormState = {
    name: '', phone: '', whatsapp: '', email: '', budget: '',
    lead_source: 'Facebook', status: 'New Lead', temperature: 'Cold', notes: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }
    
    setCurrentUser(session.user);

    const { data: roleData } = await supabase.from('user_roles').select('role').eq('id', session.user.id).single();
    const role = roleData?.role || 'admin';
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
    fetchLeadLogs(lead.id);
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

  const filteredLeads = leads.filter(l => 
    (l.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (l.phone || '').includes(searchQuery)
  );

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
      <div style={{ backgroundColor: '#1e293b', padding: '0.5rem 2rem', display: 'flex', gap: '0.5rem', borderBottom: '1px solid #334155' }}>
        <button onClick={() => setActiveTab('list')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'list' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📑 العملاء ({leads.length})</button>
        {userRole === 'admin' && (
          <button onClick={() => setActiveTab('team')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'team' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>👥 فريق العمل ({teamMembers.length})</button>
        )}
      </div>

      {/* Main Container */}
      <main style={{ padding: '1.5rem' }}>
        {activeTab === 'list' && (
          <div>
            <input type="text" placeholder="🔍 بحث باسم العميل أو الهاتف..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', maxWidth: '400px', padding: '0.6rem', marginBottom: '1rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />

            <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>
                    <th style={{ padding: '1rem' }}>الاسم</th>
                    <th style={{ padding: '1rem' }}>الهاتف</th>
                    <th style={{ padding: '1rem' }}>المصدر</th>
                    <th style={{ padding: '1rem' }}>المسؤول</th>
                    <th style={{ padding: '1rem' }}>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '1rem', fontWeight: 'bold' }}>{lead.name}</td>
                      <td style={{ padding: '1rem' }}>{lead.phone}</td>
                      <td style={{ padding: '1rem' }}>{lead.lead_source}</td>
                      <td style={{ padding: '1rem' }}>
                        {userRole === 'admin' ? (
                          <select value={lead.assigned_to || ''} onChange={(e) => handleAssignLead(lead.id, e.target.value)} style={{ padding: '0.4rem', backgroundColor: '#0f172a', color: lead.assigned_to ? '#34d399' : '#f87171', border: '1px solid #334155', borderRadius: '4px' }}>
                            <option value="">غير مخصص</option>
                            {teamMembers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
                          </select>
                        ) : (
                          <span>مخصص لك</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <button onClick={() => handleOpenLeadDetails(lead)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>تفاصيل وسجل العميل</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '2rem', borderRadius: '8px', width: '350px' }}>
            <h3>إضافة موظف جديد</h3>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
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

      {/* Lead Details & Log Timeline Modal */}
      {selectedLead && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '2rem', borderRadius: '8px', width: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2>سجل العميل: {selectedLead.name}</h2>
            <p>📞 الهاتف: {selectedLead.phone}</p>
            
            <hr style={{ borderColor: '#334155', margin: '1rem 0' }} />
            
            <h3>الملاحظات وسجل التواصل:</h3>
            <form onSubmit={handleAddLogNote} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input placeholder="أضف ملاحظة جديدة..." value={newNote} onChange={(e) => setNewNote(e.target.value)} style={{ flex: 1, padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }} />
              <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px' }}>إضافة</button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {leadLogs.map(log => (
                <div key={log.id} style={{ backgroundColor: '#0f172a', padding: '0.6rem', borderRadius: '4px', borderRight: '3px solid #38bdf8' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{log.user_email} - {new Date(log.created_at).toLocaleString('ar-EG')}</div>
                  <div>{log.content}</div>
                </div>
              ))}
            </div>

            <button onClick={() => setSelectedLead(null)} style={{ marginTop: '1rem', padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>إغلاق</button>
          </div>
        </div>
      )}

    </div>
  );
}

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
  
  const [activeTab, setActiveTab] = useState('leads'); 
  const [showUserModal, setShowUserModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  const [newNote, setNewNote] = useState('');
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'sales' });
  const [newUnit, setNewUnit] = useState({ title: '', type: 'شقة', price: '', status: 'Available' });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
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

      const { data: unitsData } = await supabase.from('units').select('*');
      if (unitsData) setUnits(unitsData);

      const { data: tasksData } = await supabase.from('tasks').select('*').eq('user_id', session.user.id).eq('is_completed', false);
      if (tasksData) setTasks(tasksData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadLogs = async (leadId) => {
    const { data } = await supabase.from('lead_logs').select('*').eq('lead_id', leadId).order('created_at', { ascending: false });
    if (data) setLeadLogs(data);
  };

  const handleUpdateStatus = async (leadId, newStatus) => {
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
    if (!error) {
      setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      await supabase.from('lead_logs').insert([{
        lead_id: leadId,
        user_email: currentUser.email,
        action_type: 'Status Change',
        content: `تم تغيير حالة العميل إلى: ${newStatus}`
      }]);
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

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signUp({ email: newUser.email, password: newUser.password });
    if (error) {
      alert('خطأ في التسجيل: ' + error.message);
    } else if (data.user) {
      const { error: roleError } = await supabase.from('user_roles').insert([{ id: data.user.id, email: newUser.email, role: newUser.role }]);
      if (roleError) {
        alert('تم إنشاء الحساب ولكن حدث خطأ في حفظ الصلاحيات: ' + roleError.message);
      } else {
        alert('تم إنشاء الموظف بنجاح');
        setShowUserModal(false);
        setNewUser({ email: '', password: '', role: 'sales' });
        fetchData();
      }
    }
  };

  const handleCreateUnit = async (e) => {
    e.preventDefault();
    if (!newUnit.title || !newUnit.price) {
      alert('يرجى إدخال اسم الوحدة والسعر');
      return;
    }
    const { error } = await supabase.from('units').insert([newUnit]);
    if (error) {
      alert('خطأ أثناء إضافة الوحدة: ' + error.message);
    } else {
      alert('تم إضافة الوحدة بنجاح');
      setShowUnitModal(false);
      setNewUnit({ title: '', type: 'شقة', price: '', status: 'Available' });
      fetchData();
    }
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Phone', 'Email', 'Source', 'Status'];
    const rows = leads.map(l => [l.name, l.phone, l.email, l.lead_source, l.status]);
    let csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'arcova_leads.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split('\n');
      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const [name, phone, email, lead_source, status] = line.split(',');
        if (phone) {
          await supabase.from('leads').insert([{
            name: name || 'عميل إكسيل',
            phone: phone,
            email: email || '',
            lead_source: lead_source || 'Excel Import',
            status: status || 'New Lead'
          }]);
          count++;
        }
      }
      alert(`تم استيراد ${count} عميل بنجاح!`);
      fetchData();
    };
    reader.readAsText(file);
  };

  const filteredLeads = leads.filter(l => 
    (l.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (l.phone || '').includes(searchQuery)
  );

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', color: '#38bdf8', fontSize: '1.2rem', fontFamily: 'sans-serif' }}>
      جاري تحميل لوحة التحكم...
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', direction: 'rtl' }}>
      
      {/* Top Navbar */}
      <header style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#38bdf8', fontWeight: '800', letterSpacing: '-0.5px' }}>ARCOVA CRM</h1>
          <span style={{ backgroundColor: userRole === 'admin' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(2, 132, 199, 0.15)', color: userRole === 'admin' ? '#f87171' : '#38bdf8', border: `1px solid ${userRole === 'admin' ? '#ef4444' : '#0284c7'}`, padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' }}>
            {userRole === 'admin' ? '🛡️ مدير النظام (Admin)' : '👤 مسؤول مبيعات (Sales)'}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8', backgroundColor: '#0f172a', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #334155' }}>{currentUser?.email}</span>
          
          {userRole === 'admin' && (
            <>
              <button onClick={() => setShowUserModal(true)} style={{ padding: '0.5rem 1rem', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', boxShadow: '0 4px 6px -1px rgba(139, 92, 246,.2)' }}>+ إضافة موظف</button>
              <button onClick={() => setShowUnitModal(true)} style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', boxShadow: '0 4px 6px -1px rgba(16, 185, 129,.2)' }}>+ إضافة وحدة</button>
            </>
          )}
          
          <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')} style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', color: '#f87171', border: '1px solid #7f1d1d', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>تسجيل خروج</button>
        </div>
      </header>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem', padding: '1.5rem 2rem 0' }}>
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '1.2rem', borderRadius: '12px', borderRight: '4px solid #38bdf8' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '500' }}>إجمالي العملاء (Leads)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', marginTop: '0.4rem' }}>{leads.length}</div>
        </div>
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '1.2rem', borderRadius: '12px', borderRight: '4px solid #10b981' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '500' }}>المهام المعلقة</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', marginTop: '0.4rem' }}>{tasks.length}</div>
        </div>
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '1.2rem', borderRadius: '12px', borderRight: '4px solid #8b5cf6' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '500' }}>الوحدات المتاحة</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', marginTop: '0.4rem' }}>{units.filter(u => u.status === 'Available').length}</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '0.4rem', display: 'flex', gap: '0.5rem', margin: '1.5rem 2rem 0', borderRadius: '10px', width: 'fit-content' }}>
        <button onClick={() => setActiveTab('leads')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'leads' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: 'all 0.2s' }}>📑 العملاء</button>
        <button onClick={() => setActiveTab('units')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'units' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: 'all 0.2s' }}>🏢 الوحدات العقارية</button>
        <button onClick={() => setActiveTab('tasks')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'tasks' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: 'all 0.2s' }}>📌 المهام ({tasks.length})</button>
        {userRole === 'admin' && (
          <button onClick={() => setActiveTab('team')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'team' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: 'all 0.2s' }}>👥 فريق العمل</button>
        )}
      </div>

      {/* Content Area */}
      <main style={{ padding: '1.5rem 2rem 2rem' }}>
        
        {/* LEADS TAB */}
        {activeTab === 'leads' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
              <input type="text" placeholder="🔍 بحث باسم العميل أو رقم الهاتف..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', maxWidth: '380px', padding: '0.7rem 1rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }} />
              
              {userRole === 'admin' && (
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                  <button onClick={exportToCSV} style={{ padding: '0.6rem 1rem', backgroundColor: '#334155', color: '#fff', border: '1px solid #475569', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>📥 تصدير Excel</button>
                  <label style={{ padding: '0.6rem 1rem', backgroundColor: '#065f46', color: '#34d399', border: '1px solid #047857', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>
                    📤 استيراد Excel
                    <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                </div>
              )}
            </div>

            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflowX: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: '750px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155', fontSize: '0.85rem' }}>
                    <th style={{ padding: '1rem' }}>الاسم</th>
                    <th style={{ padding: '1rem' }}>الهاتف</th>
                    <th style={{ padding: '1rem' }}>المصدر</th>
                    <th style={{ padding: '1rem' }}>الحالة</th>
                    <th style={{ padding: '1rem' }}>المسؤول</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: '1px solid #334155', fontSize: '0.9rem' }}>
                      <td style={{ padding: '1rem', fontWeight: '600' }}>{lead.name}</td>
                      <td style={{ padding: '1rem', color: '#cbd5e1' }}>{lead.phone}</td>
                      <td style={{ padding: '1rem', color: '#94a3b8' }}>{lead.lead_source}</td>
                      <td style={{ padding: '1rem' }}>
                        <select value={lead.status || 'New Lead'} onChange={(e) => handleUpdateStatus(lead.id, e.target.value)} style={{ padding: '0.4rem 0.6rem', backgroundColor: '#0f172a', color: '#38bdf8', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <option value="New Lead">جديد (New)</option>
                          <option value="Contacted">تم الاتصال</option>
                          <option value="Interested">مهتم</option>
                          <option value="Meeting Set">تم تحديد موعد</option>
                          <option value="Closed Won">تعاقد (Won)</option>
                          <option value="Lost">غير مهتم (Lost)</option>
                        </select>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {userRole === 'admin' ? (
                          <select value={lead.assigned_to || ''} onChange={(e) => handleAssignLead(lead.id, e.target.value)} style={{ padding: '0.4rem 0.6rem', backgroundColor: '#0f172a', color: lead.assigned_to ? '#34d399' : '#f87171', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <option value="">غير مخصص</option>
                            {teamMembers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
                          </select>
                        ) : (
                          <span style={{ color: '#34d399', fontSize: '0.85rem' }}>مخصص لك</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <button onClick={() => { setSelectedLead(lead); fetchLeadLogs(lead.id); }} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem' }}>التفاصيل والسجل</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* UNITS TAB */}
        {activeTab === 'units' && (
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '1.5rem', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: '#f8fafc' }}>🏢 قائمة الوحدات العقارية</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              {units.map(unit => (
                <div key={unit.id} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', padding: '1.2rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.4rem' }}>{unit.title}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.8rem' }}>النوع: {unit.type} | السعر: {Number(unit.price).toLocaleString()} EGP</div>
                  <span style={{ backgroundColor: unit.status === 'Available' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: unit.status === 'Available' ? '#34d399' : '#f87171', border: `1px solid ${unit.status === 'Available' ? '#10b981' : '#ef4444'}`, padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>
                    {unit.status === 'Available' ? 'متاح' : 'محجوز / مباع'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '1.5rem', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: '#f8fafc' }}>📌 المهام المطلوبة</h3>
            {tasks.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>لا توجد مهام معلقة حالياً.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {tasks.map(task => (
                  <div key={task.id} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', padding: '1rem', borderRadius: '8px' }}>
                    <div style={{ fontWeight: '600' }}>{task.title}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TEAM TAB */}
        {activeTab === 'team' && userRole === 'admin' && (
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '1.5rem', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: '#f8fafc' }}>👥 فريق العمل</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {teamMembers.map(m => (
                <div key={m.id} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '600' }}>{m.email}</span>
                  <span style={{ backgroundColor: '#334155', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', color: '#38bdf8' }}>{m.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* MODAL: ADD USER */}
      {showUserModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 1.2rem 0', color: '#f8fafc' }}>إضافة موظف جديد</h3>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>البريد الإلكتروني</label>
                <input type="email" placeholder="example@arcova.com" required value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} style={{ width: '100%', padding: '0.7rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '8px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>كلمة المرور</label>
                <input type="password" placeholder="••••••••" required value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} style={{ width: '100%', padding: '0.7rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '8px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>الصلاحية</label>
                <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} style={{ width: '100%', padding: '0.7rem', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', outline: 'none', cursor: 'pointer' }}>
                  <option value="sales">Sales (مبيعات)</option>
                  <option value="admin">Admin (مشرف)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
                <button type="submit" style={{ flex: 1, padding: '0.7rem', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>حفظ الموظف</button>
                <button type="button" onClick={() => setShowUserModal(false)} style={{ flex: 1, padding: '0.7rem', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD UNIT */}
      {showUnitModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 1.2rem 0', color: '#f8fafc' }}>إضافة وحدة عقارية جديدة</h3>
            <form onSubmit={handleCreateUnit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>اسم الوحدة أو رقمها</label>
                <input type="text" placeholder="مثال: شقة A-102" required value={newUnit.title} onChange={(e) => setNewUnit({...newUnit, title: e.target.value})} style={{ width: '100%', padding: '0.7rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '8px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>النوع</label>
                <select value={newUnit.type} onChange={(e) => setNewUnit({...newUnit, type: e.target.value})} style={{ width: '100%', padding: '0.7rem', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', outline: 'none', cursor: 'pointer' }}>
                  <option value="شقة">شقة</option>
                  <option value="فيلا">فيلا</option>
                  <option value="تجاري">تجاري / محل</option>
                  <option value="مكتب">مكتب إداري</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>السعر (جنيه)</label>
                <input type="number" placeholder="مثال: 2500000" required value={newUnit.price} onChange={(e) => setNewUnit({...newUnit, price: e.target.value})} style={{ width: '100%', padding: '0.7rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '8px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>الحالة</label>
                <select value={newUnit.status} onChange={(e) => setNewUnit({...newUnit, status: e.target.value})} style={{ width: '100%', padding: '0.7rem', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '8px', outline: 'none', cursor: 'pointer' }}>
                  <option value="Available">متاح (Available)</option>
                  <option value="Reserved">محجوز (Reserved)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
                <button type="submit" style={{ flex: 1, padding: '0.7rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>حفظ الوحدة</button>
                <button type="button" onClick={() => setShowUnitModal(false)} style={{ flex: 1, padding: '0.7rem', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LEAD DETAILS & LOGS */}
      {selectedLead && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', color: '#f8fafc' }}>سجل العميل: {selectedLead.name}</h2>
            <div style={{ display: 'flex', gap: '1.5rem', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>
              <span>📞 {selectedLead.phone}</span>
              <span>📧 {selectedLead.email || 'بدون إيميل'}</span>
            </div>
            
            <hr style={{ borderColor: '#334155', margin: '1rem 0' }} />
            
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.8rem' }}>إضافة ملاحظة أو تحديث:</h3>
            <form onSubmit={handleAddLogNote} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input placeholder="اكتب ملاحظة جديدة عن العميل..." value={newNote} onChange={(e) => setNewNote(e.target.value)} style={{ flex: 1, padding: '0.7rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '8px', outline: 'none', fontSize: '0.9rem' }} />
              <button type="submit" style={{ padding: '0.7rem 1.2rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>إضافة</button>
            </form>

            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.8rem' }}>سجل النشاطات (Timeline):</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {leadLogs.map(log => (
                <div key={log.id} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', padding: '0.9rem', borderRadius: '8px', borderRight: '4px solid #38bdf8' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.3rem' }}>{log.user_email} • {new Date(log.created_at).toLocaleString('ar-EG')}</div>
                  <div style={{ fontSize: '0.9rem', color: '#f8fafc' }}>{log.content}</div>
                </div>
              ))}
            </div>

            <button onClick={() => setSelectedLead(null)} style={{ marginTop: '1.5rem', width: '100%', padding: '0.7rem', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>إغلاق النافذة</button>
          </div>
        </div>
      )}

    </div>
  );
}

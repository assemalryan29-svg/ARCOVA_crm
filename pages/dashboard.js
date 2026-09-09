import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import LeadsSection from '../components/LeadsSection';

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
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedLead) {
      fetchLeadLogs(selectedLead.id);
    }
  }, [selectedLead]);

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
    if (!newNote.trim() || !selectedLead) return;
    const { error } = await supabase.from('lead_logs').insert([{
      lead_id: selectedLead.id,
      user_email: currentUser.email,
      action_type: 'Note',
      content: newNote
    }]);
    if (!error) {
      setNewNote('');
      fetchLeadLogs(selectedLead.id);
    } else {
      alert('خطأ في إضافة الملاحظة: ' + error.message);
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
        alert('خطأ في حفظ الصلاحيات: ' + roleError.message);
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

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const { error } = await supabase.from('tasks').insert([{
      user_id: currentUser.id,
      title: newTaskTitle,
      is_completed: false
    }]);
    if (!error) {
      setNewTaskTitle('');
      fetchData();
    } else {
      alert('خطأ في إضافة المهمة: ' + error.message);
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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#1a1816', color: '#d4af37', fontSize: '1.2rem', fontFamily: 'sans-serif' }}>
      جاري تحميل نظام ARCOVA العقاري...
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f2eb', color: '#2c2825', fontFamily: 'system-ui, -apple-system, sans-serif', direction: 'rtl' }}>
      
      {/* Top Navbar */}
      <header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e7e2d5', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '42px', height: '42px', border: '2px solid #c5a059', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'linear-gradient(135deg, #fdfbf7 0%, #f3ece0 100%)', boxShadow: '0 2px 5px rgba(197,160,89,0.2)' }}>
            <span style={{ fontWeight: 'bold', color: '#c5a059', fontSize: '1.1rem' }}>AV</span>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.3rem', color: '#2c2825', fontWeight: '800', letterSpacing: '1px' }}>ARCOVA</h1>
            <span style={{ fontSize: '0.65rem', color: '#c5a059', fontWeight: '700', letterSpacing: '2px' }}>REAL ESTATE CRM</span>
          </div>
          <span style={{ backgroundColor: userRole === 'admin' ? 'rgba(197, 160, 89, 0.15)' : 'rgba(44, 40, 37, 0.08)', color: userRole === 'admin' ? '#997529' : '#2c2825', border: `1px solid ${userRole === 'admin' ? '#c5a059' : '#d1cbd7'}`, padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', marginRight: '1rem' }}>
            {userRole === 'admin' ? '🛡️ مدير النظام' : '👤 مبيعات'}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: '#59524c', backgroundColor: '#faf8f5', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #e7e2d5' }}>{currentUser?.email}</span>
          
          {userRole === 'admin' && (
            <>
              <button onClick={() => setShowUserModal(true)} style={{ padding: '0.5rem 1rem', backgroundColor: '#2c2825', color: '#d4af37', border: '1px solid #c5a059', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>+ إضافة موظف</button>
              <button onClick={() => setShowUnitModal(true)} style={{ padding: '0.5rem 1rem', backgroundColor: '#c5a059', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>+ إضافة وحدة</button>
            </>
          )}
          
          <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')} style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', color: '#a63a3a', border: '1px solid #d9b3b3', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>خروج</button>
        </div>
      </header>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem', padding: '1.5rem 2rem 0' }}>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e7e2d5', padding: '1.2rem', borderRadius: '12px', borderRight: '4px solid #c5a059', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
          <div style={{ color: '#7a7067', fontSize: '0.85rem' }}>إجمالي العملاء</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', marginTop: '0.4rem', color: '#2c2825' }}>{leads.length}</div>
        </div>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e7e2d5', padding: '1.2rem', borderRadius: '12px', borderRight: '4px solid #365345', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
          <div style={{ color: '#7a7067', fontSize: '0.85rem' }}>المهام المعلقة</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', marginTop: '0.4rem', color: '#2c2825' }}>{tasks.length}</div>
        </div>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e7e2d5', padding: '1.2rem', borderRadius: '12px', borderRight: '4px solid #8c6d33', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
          <div style={{ color: '#7a7067', fontSize: '0.85rem' }}>الوحدات المتاحة</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700', marginTop: '0.4rem', color: '#2c2825' }}>{units.filter(u => u.status === 'Available').length}</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e7e2d5', padding: '0.4rem', display: 'flex', gap: '0.5rem', margin: '1.5rem 2rem 0', borderRadius: '10px', width: 'fit-content', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
        <button onClick={() => setActiveTab('leads')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'leads' ? '#c5a059' : 'transparent', color: activeTab === 'leads' ? '#fff' : '#59524c', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>📑 العملاء</button>
        <button onClick={() => setActiveTab('units')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'units' ? '#c5a059' : 'transparent', color: activeTab === 'units' ? '#fff' : '#59524c', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>🏢 الوحدات</button>
        <button onClick={() => setActiveTab('tasks')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'tasks' ? '#c5a059' : 'transparent', color: activeTab === 'tasks' ? '#fff' : '#59524c', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>📌 المهام ({tasks.length})</button>
        {userRole === 'admin' && (
          <button onClick={() => setActiveTab('team')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'team' ? '#c5a059' : 'transparent', color: activeTab === 'team' ? '#fff' : '#59524c', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>👥 فريق العمل</button>
        )}
      </div>

      {/* Content Area */}
      <main style={{ padding: '1.5rem 2rem 2rem' }}>
        
        {activeTab === 'leads' && (
          <LeadsSection 
            filteredLeads={filteredLeads}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            userRole={userRole}
            teamMembers={teamMembers}
            handleUpdateStatus={handleUpdateStatus}
            handleAssignLead={handleAssignLead}
            setSelectedLead={setSelectedLead}
            exportToCSV={exportToCSV}
            handleFileUpload={handleFileUpload}
          />
        )}

        {activeTab === 'units' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e7e2d5', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: '#2c2825' }}>🏢 قائمة الوحدات العقارية</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              {units.map(unit => (
                <div key={unit.id} style={{ backgroundColor: '#faf8f5', border: '1px solid #e7e2d5', padding: '1.2rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.4rem', color: '#2c2825' }}>{unit.title}</div>
                  <div style={{ color: '#7a7067', fontSize: '0.9rem', marginBottom: '0.8rem' }}>النوع: {unit.type} | السعر: {Number(unit.price).toLocaleString()} EGP</div>
                  <span style={{ backgroundColor: unit.status === 'Available' ? 'rgba(54, 83, 69, 0.1)' : 'rgba(166, 58, 58, 0.1)', color: unit.status === 'Available' ? '#365345' : '#a63a3a', border: `1px solid ${unit.status === 'Available' ? '#365345' : '#a63a3a'}`, padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>
                    {unit.status === 'Available' ? 'متاح' : 'محجوز / مباع'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e7e2d5', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: '#2c2825' }}>📌 مهامك المطلوبة</h3>
            
            <form onSubmit={handleCreateTask} style={{ display: 'flex', gap: '0.8rem', marginBottom: '1.5rem' }}>
              <input type="text" placeholder="أضف مهمة جديدة مطلوبة منك..." value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} style={{ flex: 1, padding: '0.7rem', backgroundColor: '#faf8f5', border: '1px solid #e7e2d5', color: '#2c2825', borderRadius: '8px', outline: 'none' }} />
              <button type="submit" style={{ padding: '0.7rem 1.2rem', backgroundColor: '#c5a059', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>+ إضافة مهمة</button>
            </form>

            {tasks.length === 0 ? <p style={{ color: '#7a7067', fontSize: '0.9rem' }}>لا توجد مهام معلقة حالياً.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {tasks.map(task => (
                  <div key={task.id} style={{ backgroundColor: '#faf8f5', border: '1px solid #e7e2d5', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', color: '#2c2825' }}>{task.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'team' && userRole === 'admin' && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e7e2d5', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: '#2c2825' }}>👥 فريق العمل</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {teamMembers.map(m => (
                <div key={m.id} style={{ backgroundColor: '#faf8f5', border: '1px solid #e7e2d5', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '600', color: '#2c2825' }}>{m.email}</span>
                  <span style={{ backgroundColor: '#e7e2d5', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', color: '#2c2825' }}>{m.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* MODALS */}
      {showUserModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(44,40,37,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e7e2d5', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 1.2rem 0', color: '#2c2825' }}>إضافة موظف جديد</h3>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="email" placeholder="البريد الإلكتروني" required value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} style={{ width: '100%', padding: '0.7rem', backgroundColor: '#faf8f5', border: '1px solid #e7e2d5', color: '#2c2825', borderRadius: '8px', outline: 'none' }} />
              <input type="password" placeholder="كلمة المرور" required value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} style={{ width: '100%', padding: '0.7rem', backgroundColor: '#faf8f5', border: '1px solid #e7e2d5', color: '#2c2825', borderRadius: '8px', outline: 'none' }} />
              <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} style={{ width: '100%', padding: '0.7rem', backgroundColor: '#faf8f5', color: '#2c2825', border: '1px solid #e7e2d5', borderRadius: '8px', outline: 'none' }}>
                <option value="sales">Sales (مبيعات)</option>
                <option value="admin">Admin (مشرف)</option>
              </select>
              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
                <button type="submit" style={{ flex: 1, padding: '0.7rem', backgroundColor: '#c5a059', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>حفظ</button>
                <button type="button" onClick={() => setShowUserModal(false)} style={{ flex: 1, padding: '0.7rem', backgroundColor: '#e7e2d5', color: '#2c2825', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUnitModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(44,40,37,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e7e2d5', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 1.2rem 0', color: '#2c2825' }}>إضافة وحدة عقارية جديدة</h3>
            <form onSubmit={handleCreateUnit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" placeholder="اسم الوحدة أو رقمها (مثال: محل 5)" required value={newUnit.title} onChange={(e) => setNewUnit({...newUnit, title: e.target.value})} style={{ width: '100%', padding: '0.7rem', backgroundColor: '#faf8f5', border: '1px solid #e7e2d5', color: '#2c2825', borderRadius: '8px', outline: 'none' }} />
              <select value={newUnit.type} onChange={(e) => setNewUnit({...newUnit, type: e.target.value})} style={{ width: '100%', padding: '0.7rem', backgroundColor: '#faf8f5', color: '#2c2825', border: '1px solid #e7e2d5', borderRadius: '8px', outline: 'none' }}>
                <option value="شقة">شقة</option>
                <option value="فيلا">فيلا</option>
                <option value="تجاري / محل">تجاري / محل</option>
                <option value="مكتب">مكتب إداري</option>
              </select>
              <input type="number" placeholder="السعر (جنيه)" required value={newUnit.price} onChange={(e) => setNewUnit({...newUnit, price: e.target.value})} style={{ width: '100%', padding: '0.7rem', backgroundColor: '#faf8f5', border: '1px solid #e7e2d5', color: '#2c2825', borderRadius: '8px', outline: 'none' }} />
              <select value={newUnit.status} onChange={(e) => setNewUnit({...newUnit, status: e.target.value})} style={{ width: '100%', padding: '0.7rem', backgroundColor: '#faf8f5', color: '#2c2825', border: '1px solid #e7e2d5', borderRadius: '8px', outline: 'none' }}>
                <option value="Available">متاح (Available)</option>
                <option value="Reserved">محجوز (Reserved)</option>
              </select>
              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
                <button type="submit" style={{ flex: 1, padding: '0.7rem', backgroundColor: '#c5a059', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>حفظ</button>
                <button type="button" onClick={() => setShowUnitModal(false)} style={{ flex: 1, padding: '0.7rem', backgroundColor: '#e7e2d5', color: '#2c2825', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedLead && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(44,40,37,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e7e2d5', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', color: '#2c2825' }}>سجل العميل: {selectedLead.name}</h2>
            <div style={{ display: 'flex', gap: '1.5rem', color: '#7a7067', fontSize: '0.9rem', marginBottom: '1rem' }}>
              <span>📞 {selectedLead.phone}</span>
              <span>📧 {selectedLead.email || 'بدون إيميل'}</span>
            </div>
            
            <hr style={{ borderColor: '#e7e2d5', margin: '1rem 0' }} />
            
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.8rem', color: '#2c2825' }}>إضافة ملاحظة جديدة:</h3>
            <form onSubmit={handleAddLogNote} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input placeholder="اكتب ملاحظة جديدة عن العميل..." value={newNote} onChange={(e) => setNewNote(e.target.value)} style={{ flex: 1, padding: '0.7rem', backgroundColor: '#faf8f5', border: '1px solid #e7e2d5', color: '#2c2825', borderRadius: '8px', outline: 'none' }} />
              <button type="submit" style={{ padding: '0.7rem 1.2rem', backgroundColor: '#c5a059', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>إضافة</button>
            </form>

            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.8rem', color: '#2c2825' }}>سجل النشاطات (Timeline):</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {leadLogs.map(log => (
                <div key={log.id} style={{ backgroundColor: '#faf8f5', border: '1px solid #e7e2d5', padding: '0.9rem', borderRadius: '8px', borderRight: '4px solid #c5a059' }}>
                  <div style={{ fontSize: '0.75rem', color: '#7a7067', marginBottom: '0.3rem' }}>{log.user_email} • {new Date(log.created_at).toLocaleString('ar-EG')}</div>
                  <div style={{ fontSize: '0.9rem', color: '#2c2825' }}>{log.content}</div>
                </div>
              ))}
            </div>

            <button onClick={() => setSelectedLead(null)} style={{ marginTop: '1.5rem', width: '100%', padding: '0.7rem', backgroundColor: '#2c2825', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>إغلاق النافذة</button>
          </div>
        </div>
      )}

    </div>
  );
}

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

    setLoading(false);
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
      alert('خطأ: ' + error.message);
    } else if (data.user) {
      await supabase.from('user_roles').insert([{ id: data.user.id, email: newUser.email, role: newUser.role }]);
      alert('تم إنشاء الموظف بنجاح');
      setShowUserModal(false);
      setNewUser({ email: '', password: '', role: 'sales' });
      fetchData();
    }
  };

  const handleCreateUnit = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('units').insert([newUnit]);
    if (!error) {
      alert('تم إضافة الوحدة بنجاح');
      setShowUnitModal(false);
      setNewUnit({ title: '', type: 'شقة', price: '', status: 'Available' });
      fetchData();
    }
  };

  // ميزة تصدير العملاء إلى ملف CSV (يفتحه الإكسيل مباشرة)
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

  // ميزة استيراد ملف CSV ورفع العملاء لقاعدة البيانات
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

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '5rem', backgroundColor: '#0f172a', minHeight: '100vh' }}>جاري التحميل...</div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'sans-serif', direction: 'rtl' }}>
      
      {/* Header */}
      <header style={{ backgroundColor: '#1e293b', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0, color: '#38bdf8' }}>ARCOVA CRM Pro</h2>
          <span style={{ backgroundColor: userRole === 'admin' ? '#ef4444' : '#0284c7', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
            {userRole === 'admin' ? '🛡️ Admin' : '👤 Sales'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{currentUser?.email}</span>
          {userRole === 'admin' && (
            <>
              <button onClick={() => setShowUserModal(true)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>+ موظف</button>
              <button onClick={() => setShowUnitModal(true)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>+ وحدة عقارية</button>
            </>
          )}
          <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>خروج</button>
        </div>
      </header>

      {/* Analytics / Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', padding: '1.5rem 1.5rem 0' }}>
        <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>إجمالي العملاء</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{leads.length}</div>
        </div>
        <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>المهام المعلقة</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{tasks.length}</div>
        </div>
        <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>الوحدات المتاحة</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{units.filter(u => u.status === 'Available').length}</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ backgroundColor: '#1e293b', padding: '0.5rem 1.5rem', display: 'flex', gap: '0.5rem', margin: '1.5rem 1.5rem 0', borderRadius: '8px' }}>
        <button onClick={() => setActiveTab('leads')} style={{ padding: '0.5rem 1rem', backgroundColor: activeTab === 'leads' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📑 العملاء</button>
        <button onClick={() => setActiveTab('units')} style={{ padding: '0.5rem 1rem', backgroundColor: activeTab === 'units' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>🏢 الوحدات العقارية</button>
        <button onClick={() => setActiveTab('tasks')} style={{ padding: '0.5rem 1rem', backgroundColor: activeTab === 'tasks' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📌 المهام ({tasks.length})</button>
        {userRole === 'admin' && (
          <button onClick={() => setActiveTab('team')} style={{ padding: '0.5rem 1rem', backgroundColor: activeTab === 'team' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>👥 فريق العمل</button>
        )}
      </div>

      {/* Main Content Area */}
      <main style={{ padding: '1.5rem' }}>
        
        {/* LEADS TAB */}
        {activeTab === 'leads' && (
          <div>
            {/* شريط البحث وأزرار الاستيراد والتصدير */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <input type="text" placeholder="🔍 بحث باسم العميل أو رقم الهاتف..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', maxWidth: '350px', padding: '0.6rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
              
              {userRole === 'admin' && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button onClick={exportToCSV} style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>📥 تصدير إكسيل</button>
                  
                  <label style={{ padding: '0.5rem 1rem', backgroundColor: '#059669', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    📤 استيراد إكسيل
                    <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                </div>
              )}
            </div>

            <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: '700px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>
                    <th style={{ padding: '1rem' }}>الاسم</th>
                    <th style={{ padding: '1rem' }}>الهاتف</th>
                    <th style={{ padding: '1rem' }}>المصدر</th>
                    <th style={{ padding: '1rem' }}>الحالة</th>
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
                        <select value={lead.status || 'New Lead'} onChange={(e) => handleUpdateStatus(lead.id, e.target.value)} style={{ padding: '0.3rem', backgroundColor: '#0f172a', color: '#38bdf8', border: '1px solid #334155', borderRadius: '4px' }}>
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
                          <select value={lead.assigned_to || ''} onChange={(e) => handleAssignLead(lead.id, e.target.value)} style={{ padding: '0.3rem', backgroundColor: '#0f172a', color: lead.assigned_to ? '#34d399' : '#f87171', border: '1px solid #334155', borderRadius: '4px' }}>
                            <option value="">غير مخصص</option>
                            {teamMembers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
                          </select>
                        ) : (
                          <span>مخصص لك</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <button onClick={() => { setSelectedLead(lead); fetchLeadLogs(lead.id); }} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>التفاصيل والسجل</button>
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
          <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '8px' }}>
            <h3>🏢 قائمة الوحدات العقارية</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              {units.map(unit => (
                <div key={unit.id} style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '6px', border: '1px solid #334155' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{unit.title}</div>
                  <div style={{ color: '#94a3b8', margin: '0.3rem 0' }}>النوع: {unit.type} | السعر: {unit.price}</div>
                  <span style={{ backgroundColor: unit.status === 'Available' ? '#10b981' : '#ef4444', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>{unit.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '8px' }}>
            <h3>📌 مهامك المطلوبة</h3>
            {tasks.length === 0 ? <p style={{ color: '#94a3b8' }}>لا توجد مهام معلقة حالياً.</p> : (
              <ul>
                {tasks.map(task => (
                  <li key={task.id} style={{ marginBottom: '0.5rem' }}>{task.title}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* TEAM TAB */}
        {activeTab === 'team' && userRole === 'admin' && (
          <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '8px' }}>
            <h3>👥 فريق العمل</h3>
            <ul>
              {teamMembers.map(m => (
                <li key={m.id} style={{ marginBottom: '0.5rem' }}>{m.email} - ({m.role})</li>
              ))}
            </ul>
          </div>
        )}

      </main>

      {/* MODALS */}
      {showUserModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
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

      {showUnitModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1e293b', padding: '2rem', borderRadius: '8px', width: '350px' }}>
            <h3>إضافة وحدة عقارية</h3>
            <form onSubmit={handleCreateUnit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
              <input type="text" placeholder="اسم الوحدة / رقمها" required value={newUnit.title} onChange={(e) => setNewUnit({...newUnit, title: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }} />
              <input type="number" placeholder="السعر" required value={newUnit.price} onChange={(e) => setNewUnit({...newUnit, price: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }} />
              <button type="submit" style={{ padding: '0.6rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>حفظ</button>
              <button type="button" onClick={() => setShowUnitModal(false)} style={{ padding: '0.6rem', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px' }}>إلغاء</button>
            </form>
          </div>
        </div>
      )}

      {selectedLead && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1e293b', padding: '2rem', borderRadius: '8px', width: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2>سجل العميل: {selectedLead.name}</h2>
            <p style={{ color: '#94a3b8', margin: '0.5rem 0' }}>📞 الهاتف: {selectedLead.phone}</p>
            <hr style={{ borderColor: '#334155', margin: '1rem 0' }} />
            <h3>الملاحظات وسجل التواصل:</h3>
            <form onSubmit={handleAddLogNote} style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
              <input placeholder="أضف ملاحظة جديدة..." value={newNote} onChange={(e) => setNewNote(e.target.value)} style={{ flex: 1, padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff' }} />
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

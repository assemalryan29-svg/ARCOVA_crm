import { useEffect, useState, useRef } from 'react';
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  const [newNote, setNewNote] = useState('');
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'sales' });
  const [newLeadData, setNewLeadData] = useState({ name: '', phone: '', email: '', lead_source: 'Manual', assigned_to: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [followUpInput, setFollowUpInput] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(false);
  
  const audioCtxRef = useRef(null);

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

  useEffect(() => {
    if (!audioEnabled) return;

    const interval = setInterval(() => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const hasDue = leads.some(l => l.next_follow_up && new Date(l.next_follow_up).toISOString().slice(0, 10) <= todayStr);
      if (hasDue) {
        playNotificationSound();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [audioEnabled, leads]);

  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = audioCtxRef.current || new AudioContext();
      audioCtxRef.current = ctx;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.15);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {
      console.log("Audio play error:", e);
    }
  };

  const enableAudioAndTest = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      setAudioEnabled(true);
      playNotificationSound();
    } catch (e) {
      alert('الرجاء النقر مرة أخرى للسماح بالتشغيل.');
    }
  };

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
      if (usersData) setTeamMembers(usersData || []);

      let leadsQuery = supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (role !== 'admin') {
        leadsQuery = leadsQuery.eq('assigned_to', session.user.id);
      }
      const { data: leadsData } = await leadsQuery;
      
      if (leadsData) {
        setLeads(leadsData || []);
      }
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

  const handleCreateManualLead = async (e) => {
    e.preventDefault();
    if (!newLeadData.name || !newLeadData.phone) {
      alert('الرجاء إدخال اسم ورقم هاتف العميل');
      return;
    }

    try {
      const assignedTarget = userRole === 'admin' ? (newLeadData.assigned_to || null) : currentUser.id;

      const { error } = await supabase.from('leads').insert([{
        name: newLeadData.name,
        phone: newLeadData.phone,
        email: newLeadData.email || '',
        lead_source: newLeadData.lead_source,
        status: 'New Lead',
        assigned_to: assignedTarget
      }]);

      if (error) {
        alert('خطأ في الإضافة: ' + error.message);
      } else {
        alert('تم إضافة العميل وإسناده للموظف بنجاح!');
        setShowAddLeadModal(false);
        setNewLeadData({ name: '', phone: '', email: '', lead_source: 'Manual', assigned_to: '' });
        fetchData();
      }
    } catch (err) {
      alert('تعذر الاتصال بالخادم.');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n');
        let importedCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cols = line.split(',').map(c => c.replace(/^["']|["']$/g, '').trim());
          const name = cols[0];
          const phone = cols[1];
          const email = cols[2] || '';
          const lead_source = cols[3] || 'Imported';

          if (name && phone) {
            await supabase.from('leads').insert([{
              name,
              phone,
              email,
              lead_source,
              status: 'New Lead',
              assigned_to: userRole === 'admin' ? null : currentUser.id
            }]);
            importedCount++;
          }
        }

        alert(`تم استيراد ${importedCount} عميل بنجاح!`);
        setShowImportModal(false);
        fetchData();
      } catch (err) {
        alert('حدث خطأ أثناء قراءة الملف، تأكد من أنه بصيغة CSV صحيحة.');
      }
    };
    reader.readAsText(file);
  };

  const handleUpdateLeadStatus = async (leadId, newStatus) => {
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
    if (!error) {
      setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      await supabase.from('lead_logs').insert([{
        lead_id: leadId,
        user_email: currentUser.email,
        action_type: 'Status Change',
        content: `تم تغيير حالة العميل: ${newStatus}`
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
        content: `تم جدولة موعد المتابعة: ${dateValue ? new Date(dateValue).toLocaleString('ar-EG') : 'لا يوجد'}`
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
    if (!newNote.trim() || !selectedLead) return;
    
    const { error } = await supabase.from('lead_logs').insert([{
      lead_id: selectedLead.id,
      user_email: currentUser.email,
      action_type: 'Feedback/Note',
      content: newNote
    }]);

    if (!error) {
      setNewNote('');
      fetchLeadLogs(selectedLead.id);
    } else {
      alert('خطأ في إضافة الملاحظة: ' + error.message);
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
        content: `تم إسناد العميل إلى: ${target ? target.email : 'غير مخصص'}`
      }]);
      if (selectedLead) fetchLeadLogs(leadId);
    }
  };

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
        alert('تم إضافة الموظف بنجاح!');
        setShowUserModal(false);
        setNewUser({ email: '', password: '', role: 'sales' });
        fetchData();
      }
    } catch (err) {
      alert('خطأ في الاتصال بالشبكة.');
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

  const totalLeadsCount = leads.length;
  const interestedCount = leads.filter(l => l.status === 'Interested').length;
  const closedWonCount = leads.filter(l => l.status === 'Closed Won').length;

  if (loading) return <div style={{ color: '#d4af37', textAlign: 'center', padding: '5rem', backgroundColor: '#0c0f17', minHeight: '100vh' }}>جاري التحميل...</div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0c0f17', color: '#f3f4f6', fontFamily: 'sans-serif', direction: 'rtl' }}>

      <header style={{ backgroundColor: '#131822', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #d4af37' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 style={{ margin: 0, color: '#d4af37', fontSize: '1.2rem', fontFamily: 'serif' }}>ARCOVA CRM</h1>
          <span style={{ backgroundColor: userRole === 'admin' ? '#991b1b' : '#075985', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem' }}>
            {userRole === 'admin' ? 'Admin' : 'Sales'}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={enableAudioAndTest} style={{ padding: '0.4rem 0.8rem', backgroundColor: audioEnabled ? '#065f46' : '#991b1b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
            {audioEnabled ? '🔔 التنبيه الحي مفعل' : '🔕 تفعيل الصوت التلقائي (اضغط هنا)'}
          </button>

          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{currentUser?.email}</span>
          {userRole === 'admin' && (
            <button onClick={() => setShowUserModal(true)} style={{ padding: '0.4rem 0.8rem', backgroundColor: 'transparent', color: '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>+ موظف</button>
          )}
          <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#374151', color: '#f3f4f6', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>خروج</button>
        </div>
      </header>

      <div style={{ backgroundColor: '#131822', padding: '0.5rem 2rem', display: 'flex', gap: '0.5rem', borderBottom: '1px solid #1f2937', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('list')} style={{ padding: '0.5rem 1rem', backgroundColor: activeTab === 'list' ? '#d4af37' : 'transparent', color: activeTab === 'list' ? '#0c0f17' : '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>العملاء ({leads.length})</button>
          <button onClick={() => setActiveTab('reminders')} style={{ padding: '0.5rem 1rem', backgroundColor: activeTab === 'reminders' ? '#d4af37' : 'transparent', color: activeTab === 'reminders' ? '#0c0f17' : '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>المتابعات ({dueFollowUps.length})</button>
          {userRole === 'admin' && (
            <>
              <button onClick={() => setActiveTab('team')} style={{ padding: '0.5rem 1rem', backgroundColor: activeTab === 'team' ? '#d4af37' : 'transparent', color: activeTab === 'team' ? '#0c0f17' : '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>فريق العمل</button>
              <button onClick={() => setActiveTab('leaderboard')} style={{ padding: '0.5rem 1rem', backgroundColor: activeTab === 'leaderboard' ? '#d4af37' : 'transparent', color: activeTab === 'leaderboard' ? '#0c0f17' : '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>🏆 أداء المبيعات (Leaderboard)</button>
            </>
          )}
        </div>

        <button onClick={() => setShowAddLeadModal(true)} style={{ padding: '0.5rem 1rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
          + تسجيل عميل
        </button>
      </div>

      <main style={{ padding: '1.5rem' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ backgroundColor: '#131822', border: '1px solid #1f2937', borderRight: '4px solid #d4af37', padding: '1rem', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>إجمالي العملاء</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#d4af37', marginTop: '0.3rem' }}>{totalLeadsCount}</div>
          </div>
          <div style={{ backgroundColor: '#131822', border: '1px solid #1f2937', borderRight: '4px solid #f59e0b', padding: '1rem', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>مهتم جداً</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#f59e0b', marginTop: '0.3rem' }}>{interestedCount}</div>
          </div>
          <div style={{ backgroundColor: '#131822', border: '1px solid #1f2937', borderRight: '4px solid #34d399', padding: '1rem', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>تم التعاقد (Won)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#34d399', marginTop: '0.3rem' }}>{closedWonCount}</div>
          </div>
          <div style={{ backgroundColor: '#131822', border: '1px solid #1f2937', borderRight: '4px solid #ef4444', padding: '1rem', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>متابعات مستحقة اليوم</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#ef4444', marginTop: '0.3rem' }}>{dueFollowUps.length}</div>
          </div>
        </div>

        {activeTab === 'list' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.8rem' }}>
              <input type="text" placeholder="🔍 بحث باسم العميل أو الهاتف..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', maxWidth: '300px', padding: '0.5rem', backgroundColor: '#131822', border: '1px solid #374151', color: '#fff', borderRadius: '4px', fontSize: '0.85rem' }} />
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setShowImportModal(true)} style={{ padding: '0.5rem 1rem', backgroundColor: '#1f2937', color: '#34d399', border: '1px solid #34d399', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>📥 استيراد Excel/CSV</button>
                <button onClick={handleExportToExcel} style={{ padding: '0.5rem 1rem', backgroundColor: '#1f2937', color: '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>📤 تصدير Excel</button>
              </div>
            </div>

            <div style={{ backgroundColor: '#131822', borderRadius: '6px', overflowX: 'auto', border: '1px solid #1f2937' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0c0f17', color: '#d4af37', borderBottom: '1px solid #1f2937' }}>
                    <th style={{ padding: '0.8rem' }}>العميل والهاتف</th>
                    <th style={{ padding: '0.8rem' }}>المصدر</th>
                    <th style={{ padding: '0.8rem' }}>الحالة (Feedback)</th>
                    <th style={{ padding: '0.8rem' }}>الموعد القادم</th>
                    <th style={{ padding: '0.8rem' }}>المسؤول</th>
                    <th style={{ padding: '0.8rem' }}>الإجراء السريع</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: '1px solid #1f2937' }}>
                      <td style={{ padding: '0.8rem' }}>
                        <div style={{ fontWeight: 'bold', color: '#f3f4f6' }}>{lead.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{lead.phone}</div>
                      </td>
                      <td style={{ padding: '0.8rem', color: '#9ca3af' }}>{lead.lead_source}</td>
                      <td style={{ padding: '0.8rem' }}>
                        <select value={lead.status || 'New Lead'} onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)} style={{ padding: '0.3rem', backgroundColor: '#0c0f17', color: '#d4af37', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.8rem' }}>
                          {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '0.8rem', color: lead.next_follow_up ? '#34d399' : '#6b7280', fontSize: '0.8rem' }}>
                        {lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : 'غير محدد'}
                      </td>
                      <td style={{ padding: '0.8rem' }}>
                        {userRole === 'admin' ? (
                          <select value={lead.assigned_to || ''} onChange={(e) => handleAssignLead(lead.id, e.target.value)} style={{ padding: '0.3rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.8rem' }}>
                            <option value="">غير مخصص</option>
                            {teamMembers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
                          </select>
                        ) : (
                          <span style={{ color: '#34d399', fontSize: '0.8rem' }}>مخصص لك</span>
                        )}
                      </td>
                      <td style={{ padding: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button onClick={() => handleOpenLeadDetails(lead)} title="عرض الفيدباك" style={{ padding: '0.3rem 0.6rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>الفيدباك</button>
                        <a href={`tel:${lead.phone}`} title="اتصال مباشر" style={{ padding: '0.3rem 0.5rem', backgroundColor: '#065f46', color: '#fff', borderRadius: '4px', textDecoration: 'none', fontSize: '0.75rem' }}>📞</a>
                        <a href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" title="محادثة واتساب" style={{ padding: '0.3rem 0.5rem', backgroundColor: '#166534', color: '#fff', borderRadius: '4px', textDecoration: 'none', fontSize: '0.75rem' }}>🟢</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reminders' && (
          <div style={{ backgroundColor: '#131822', padding: '1.2rem', borderRadius: '6px', border: '1px solid #1f2937' }}>
            <h3 style={{ color: '#d4af37', fontFamily: 'serif', fontSize: '1rem' }}>المتابعات المستحقة ({dueFollowUps.length})</h3>
            {dueFollowUps.length === 0 ? (
              <p style={{ color: '#34d399', marginTop: '0.8rem', fontSize: '0.85rem' }}>لا توجد مهام متابعة مستحقة.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.8rem' }}>
                {dueFollowUps.map(lead => (
                  <div key={lead.id} style={{ backgroundColor: '#0c0f17', padding: '0.8rem', borderRadius: '4px', borderRight: '3px solid #d4af37', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{lead.name} - {lead.phone}</div>
                      <div style={{ color: '#f87171', fontSize: '0.75rem' }}>الموعد: {new Date(lead.next_follow_up).toLocaleString('ar-EG')}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => handleOpenLeadDetails(lead)} style={{ padding: '0.3rem 0.8rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>فتح</button>
                      <a href={`tel:${lead.phone}`} style={{ padding: '0.3rem 0.6rem', backgroundColor: '#065f46', color: '#fff', borderRadius: '4px', textDecoration: 'none', fontSize: '0.8rem' }}>📞</a>
                      <a href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" style={{ padding: '0.3rem 0.6rem', backgroundColor: '#166534', color: '#fff', borderRadius: '4px', textDecoration: 'none', fontSize: '0.8rem' }}>🟢</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'leaderboard' && userRole === 'admin' && (
          <div style={{ backgroundColor: '#131822', padding: '1.5rem', borderRadius: '6px', border: '1px solid #1f2937' }}>
            <h3 style={{ color: '#d4af37', fontFamily: 'serif', fontSize: '1.1rem', marginBottom: '1rem' }}>🏆 لوحة أداء فريق المبيعات (Leaderboard)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {teamMembers.map(member => {
                const memberLeads = leads.filter(l => l.assigned_to === member.id);
                const memberWon = memberLeads.filter(l => l.status === 'Closed Won').length;
                const memberInterested = memberLeads.filter(l => l.status === 'Interested').length;

                return (
                  <div key={member.id} style={{ backgroundColor: '#0c0f17', padding: '1rem', borderRadius: '6px', border: '1px solid #1f2937', borderTop: '3px solid #d4af37' }}>
                    <div style={{ fontWeight: 'bold', color: '#f3f4f6', fontSize: '0.9rem' }}>{member.email}</div>
                    <div style={{ fontSize: '0.75rem', color: '#d4af37', marginBottom: '0.8rem' }}>الدور: {member.role}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', margin: '0.3rem 0', color: '#9ca3af' }}>
                      <span>إجمالي العملاء:</span>
                      <span style={{ color: '#fff', fontWeight: 'bold' }}>{memberLeads.length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', margin: '0.3rem 0', color: '#9ca3af' }}>
                      <span>مهتم جداً:</span>
                      <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{memberInterested}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', margin: '0.3rem 0', color: '#9ca3af' }}>
                      <span>تم التعاقد (Won):</span>
                      <span style={{ color: '#34d399', fontWeight: 'bold' }}>{memberWon}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'team' && userRole === 'admin' && (
          <div style={{ backgroundColor: '#131822', padding: '1.2rem', borderRadius: '6px', border: '1px solid #1f2937' }}>
            <h3 style={{ color: '#d4af37', fontFamily: 'serif', fontSize: '1rem' }}>طاقم العمل</h3>
            <ul style={{ marginTop: '0.8rem', paddingRight: '1rem', fontSize: '0.85rem' }}>
              {teamMembers.map(m => <li key={m.id} style={{ margin: '0.4rem 0', color: '#d1d5db' }}>{m.email} - <span style={{ color: '#d4af37' }}>({m.role})</span></li>)}
            </ul>
          </div>
        )}
      </main>

      {showImportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#131822', padding: '1.5rem', borderRadius: '6px', width: '380px', border: '1px solid #34d399' }}>
            <h3 style={{ color: '#34d399', fontFamily: 'serif', marginTop: 0, fontSize: '1rem' }}>استيراد عملاء من ملف CSV</h3>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '1rem' }}>الملف يجب أن يكون بصيغة CSV ويحتوي على الأعمدة بترتيب: (Name, Phone, Email, Source)</p>
            
            <input type="file" accept=".csv" onChange={handleFileUpload} style={{ marginBottom: '1rem', color: '#fff', fontSize: '0.8rem', width: '100%' }} />

            <button type="button" onClick={() => setShowImportModal(false)} style={{ width: '100%', padding: '0.5rem', backgroundColor: '#374151', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>إغلاق</button>
          </div>
        </div>
      )}

      {showUserModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#131822', padding: '1.5rem', borderRadius: '6px', width: '320px', border: '1px solid #d4af37' }}>
            <h3 style={{ color: '#d4af37', fontFamily: 'serif', marginTop: 0, fontSize: '1rem' }}>إضافة موظف</h3>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.8rem' }}>
              <input type="email" placeholder="البريد الإلكتروني" required value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.85rem' }} />
              <input type="password" placeholder="كلمة المرور" required value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.85rem' }} />
              <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0c0f17', color: '#d4af37', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.85rem' }}>
                <option value="sales">Sales Agent</option>
                <option value="admin">Admin Directorate</option>
              </select>
              <button type="submit" style={{ padding: '0.6rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>حفظ</button>
              <button type="button" onClick={() => setShowUserModal(false)} style={{ padding: '0.5rem', backgroundColor: '#374151', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.85rem' }}>إلغاء</button>
            </form>
          </div>
        </div>
      )}

      {showAddLeadModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#131822', padding: '1.5rem', borderRadius: '6px', width: '350px', border: '1px solid #d4af37' }}>
            <h3 style={{ color: '#d4af37', fontFamily: 'serif', marginTop: 0, fontSize: '1rem' }}>تسجيل عميل جديد</h3>
            <form onSubmit={handleCreateManualLead} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.8rem' }}>
              <input type="text" placeholder="اسم العميل *" required value={newLeadData.name} onChange={(e) => setNewLeadData({...newLeadData, name: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.85rem' }} />
              <input type="text" placeholder="رقم الهاتف *" required value={newLeadData.phone} onChange={(e) => setNewLeadData({...newLeadData, phone: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.85rem' }} />
              <input type="email" placeholder="البريد الإلكتروني" value={newLeadData.email} onChange={(e) => setNewLeadData({...newLeadData, email: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.85rem' }} />
              <input type="text" placeholder="المصدر" value={newLeadData.lead_source} onChange={(e) => setNewLeadData({...newLeadData, lead_source: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.85rem' }} />
              
              {userRole === 'admin' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.75rem', color: '#d4af37' }}>إسناد لموظف Sales:</label>
                  <select value={newLeadData.assigned_to} onChange={(e) => setNewLeadData({...newLeadData, assigned_to: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.85rem' }}>
                    <option value="">-- اختر الموظف --</option>
                    {teamMembers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
                  </select>
                </div>
              )}

              <button type="submit" style={{ padding: '0.6rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>حفظ وإسناد</button>
              <button type="button" onClick={() => setShowAddLeadModal(false)} style={{ padding: '0.5rem', backgroundColor: '#374151', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.85rem' }}>إلغاء</button>
            </form>
          </div>
        </div>
      )}

      {selectedLead && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#131822', padding: '1.5rem', borderRadius: '6px', width: '450px', maxHeight: '80vh', overflowY: 'auto', border: '1px solid #d4af37' }}>
            <h3 style={{ color: '#d4af37', fontFamily: 'serif', marginTop: 0, fontSize: '1rem' }}>{selectedLead.name}</h3>
            <p style={{ color: '#9ca3af', margin: '0.3rem 0', fontSize: '0.8rem' }}>{selectedLead.phone}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', backgroundColor: '#0c0f17', padding: '0.8rem', borderRadius: '4px', margin: '0.8rem 0', border: '1px solid #1f2937', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#d4af37' }}>الحالة:</span>
                <select value={selectedLead.status || 'New Lead'} onChange={(e) => handleUpdateLeadStatus(selectedLead.id, e.target.value)} style={{ padding: '0.3rem', backgroundColor: '#131822', color: '#d4af37', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.8rem' }}>
                  {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ color: '#d4af37', fontSize: '0.8rem' }}>موعد المتابعة:</span>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <input type="datetime-local" value={followUpInput} onChange={(e) => setFollowUpInput(e.target.value)} style={{ flex: 1, padding: '0.3rem', backgroundColor: '#131822', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.8rem' }} />
                  <button onClick={() => handleSaveFollowUp(selectedLead.id, followUpInput)} style={{ padding: '0.3rem 0.6rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>حفظ</button>
                </div>
              </div>
            </div>

            <h4 style={{ color: '#d4af37', fontFamily: 'serif', fontSize: '0.9rem', marginBottom: '0.5rem' }}>سجل الفيدباك:</h4>

            <form onSubmit={handleAddLogNote} style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.8rem' }}>
              <input placeholder="اكتب ملاحظة أو فيدباك..." value={newNote} onChange={(e) => setNewNote(e.target.value)} style={{ flex: 1, padding: '0.5rem', backgroundColor: '#0c0f17', border: '1px solid #374151', color: '#fff', borderRadius: '4px', fontSize: '0.8rem' }} />
              <button type="submit" style={{ padding: '0.5rem 0.8rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>إضافة</button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '150px', overflowY: 'auto' }}>
              {leadLogs.map(log => (
                <div key={log.id} style={{ backgroundColor: '#0c0f17', padding: '0.6rem', borderRadius: '4px', borderRight: '2px solid #d4af37', border: '1px solid #1f2937', fontSize: '0.8rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{log.user_email}</div>
                  <div style={{ marginTop: '0.2rem', color: '#f3f4f6' }}>{log.content}</div>
                </div>
              ))}
            </div>

            <button onClick={() => setSelectedLead(null)} style={{ marginTop: '1rem', padding: '0.4rem 0.8rem', backgroundColor: '#374151', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>إغلاق</button>
          </div>
        </div>
      )}

    </div>
  );
}


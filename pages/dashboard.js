import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('sales');
  const [teamMembers, setTeamMembers] = useState([]);
  
  const [leads, setLeads] = useState([]);
  const [leadLogs, setLeadLogs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [units, setUnits] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  
  const [activeTab, setActiveTab] = useState('list');
  
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  const [newNote, setNewNote] = useState('');
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'sales' });
  const [newLeadData, setNewLeadData] = useState({ 
    name: '', 
    phone: '', 
    email: '', 
    lead_source: 'Manual', 
    assigned_to: '',
    budget: '',
    preferred_location: '',
    property_type: 'شقة',
    notes: ''
  });
  const [newProjectData, setNewProjectData] = useState({ name: '', location: '', description: '' });
  const [newUnitData, setNewUnitData] = useState({ project_id: '', unit_number: '', type: 'شقة', area: '', price: '', status: 'Available' });
  const [newCampaignData, setNewCampaignData] = useState({ name: '', platform: 'Facebook', budget: '', status: 'Active' });
  
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

  const logAuditAction = async (actionType, details) => {
    try {
      if (!currentUser) return;
      await supabase.from('audit_logs').insert([{
        user_email: currentUser.email,
        action_type: actionType,
        details: details
      }]);
    } catch (e) {
      console.log('Audit log error:', e);
    }
  };

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
      if (leadsData) setLeads(leadsData || []);

      const { data: projData } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (projData) setProjects(projData || []);

      const { data: unitData } = await supabase.from('units').select('*, projects(name)').order('created_at', { ascending: false });
      if (unitData) setUnits(unitData || []);

      const { data: campData } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
      if (campData) setCampaigns(campData || []);

      if (role === 'admin') {
        const { data: auditData } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
        if (auditData) setAuditLogs(auditData || []);
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
      alert('الرجاء إدخال اسم ورقم هاتف العميل[span_0](start_span)[span_0](end_span)');
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
        assigned_to: assignedTarget,
        budget: newLeadData.budget ? parseFloat(newLeadData.budget) : null,
        preferred_location: newLeadData.preferred_location,
        property_type: newLeadData.property_type,
        notes: newLeadData.notes
      }]);

      if (error) {
        alert('خطأ في الإضافة: ' + error.message);
      } else {
        setShowAddLeadModal(false);
        setNewLeadData({ name: '', phone: '', email: '', lead_source: 'Manual', assigned_to: '', budget: '', preferred_location: '', property_type: 'شقة', notes: '' });
        await logAuditAction('CREATE_LEAD', `إضافة عميل جديد: ${newLeadData.name}`);
        fetchData();
      }
    } catch (err) {
      alert('تعذر الاتصال بالخادم[span_1](start_span)[span_1](end_span).');
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectData.name) {
      alert('الرجاء إدخال اسم المشروع[span_2](start_span)[span_2](end_span)');
      return;
    }
    const { error } = await supabase.from('projects').insert([newProjectData]);
    if (!error) {
      setShowProjectModal(false);
      setNewProjectData({ name: '', location: '', description: '' });
      await logAuditAction('CREATE_PROJECT', `إضافة مشروع جديد: ${newProjectData.name}`);
      fetchData();
      alert('تم إضافة المشروع بنجاح[span_3](start_span)[span_3](end_span)');
    } else {
      alert('خطأ: ' + error.message);
    }
  };

  const handleCreateUnit = async (e) => {
    e.preventDefault();
    if (!newUnitData.project_id || !newUnitData.unit_number) {
      alert('الرجاء اختيار المشروع ورقم الوحدة[span_4](start_span)[span_4](end_span)');
      return;
    }
    const { error } = await supabase.from('units').insert([newUnitData]);
    if (!error) {
      setShowUnitModal(false);
      setNewUnitData({ project_id: '', unit_number: '', type: 'شقة', area: '', price: '', status: 'Available' });
      await logAuditAction('CREATE_UNIT', `إضافة وحدة عقارية رقم: ${newUnitData.unit_number}`);
      fetchData();
      alert('تم إضافة الوحدة بنجاح[span_5](start_span)[span_5](end_span)');
    } else {
      alert('خطأ: ' + error.message);
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!newCampaignData.name) {
      alert('الرجاء إدخال اسم الحملة');
      return;
    }
    const { error } = await supabase.from('campaigns').insert([newCampaignData]);
    if (!error) {
      setShowCampaignModal(false);
      setNewCampaignData({ name: '', platform: 'Facebook', budget: '', status: 'Active' });
      await logAuditAction('CREATE_CAMPAIGN', `إنشاء حملة تسويقية: ${newCampaignData.name}`);
      fetchData();
      alert('تم إضافة الحملة التسويقية بنجاح');
    } else {
      alert('خطأ: ' + error.message);
    }
  };

  const handleUpdateUnitStatus = async (unitId, newStatus) => {
    const { error } = await supabase.from('units').update({ status: newStatus }).eq('id', unitId);
    if (!error) {
      await logAuditAction('UPDATE_UNIT_STATUS', `تعديل حالة الوحدة رقم ${unitId} إلى ${newStatus}`);
      fetchData();
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

        await logAuditAction('IMPORT_LEADS', `استيراد ${importedCount} عميل عبر ملف CSV`);
        alert(`تم استيراد ${importedCount} عميل بنجاح[span_6](start_span)[span_6](end_span)!`);
        setShowImportModal(false);
        fetchData();
      } catch (err) {
        alert('حدث خطأ أثناء قراءة الملف[span_7](start_span)[span_7](end_span).');
      }
    };
    reader.readAsText(file);
  };

  const handleUpdateLeadStatus = async (leadId, newStatus) => {
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
    if (!error) {
      setLeads(prevLeads => prevLeads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      await supabase.from('lead_logs').insert([{
        lead_id: leadId,
        user_email: currentUser.email,
        action_type: 'Status Change',
        content: `تم تغيير حالة العميل: ${newStatus}`
      }]);
      await logAuditAction('UPDATE_LEAD_STATUS', `تغيير حالة العميل ${leadId} إلى ${newStatus}`);
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(prev => ({ ...prev, status: newStatus }));
        fetchLeadLogs(leadId);
      }
    }
  };

  const handleSaveFollowUp = async (leadId, dateValue) => {
    const { error } = await supabase.from('leads').update({ next_follow_up: dateValue || null }).eq('id', leadId);
    if (!error) {
      setLeads(prevLeads => prevLeads.map(l => l.id === leadId ? { ...l, next_follow_up: dateValue } : l));
      await supabase.from('lead_logs').insert([{
        lead_id: leadId,
        user_email: currentUser.email,
        action_type: 'Follow-up Set',
        content: `تم جدولة موعد المتابعة: ${dateValue ? new Date(dateValue).toLocaleString('ar-EG') : 'لا يوجد'}`
      }]);
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(prev => ({ ...prev, next_follow_up: dateValue }));
        fetchLeadLogs(leadId);
      }
      alert('تم تحديث موعد المتابعة بنجاح[span_8](start_span)[span_8](end_span)');
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
      setLeads(prevLeads => prevLeads.map(l => l.id === leadId ? { ...l, assigned_to: assigneeId } : l));
      await supabase.from('lead_logs').insert([{
        lead_id: leadId,
        user_email: currentUser.email,
        action_type: 'Assign',
        content: `تم إسناد العميل إلى: ${target ? target.email : 'غير مخصص'}`
      }]);
      await logAuditAction('ASSIGN_LEAD', `إسناد العميل ${leadId} إلى ${target ? target.email : 'غير مخصص'}`);
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
        await logAuditAction('CREATE_USER', `إضافة موظف جديد: ${newUser.email} (${newUser.role})`);
        alert('تم إضافة الموظف بنجاح[span_9](start_span)[span_9](end_span)!');
        setShowUserModal(false);
        setNewUser({ email: '', password: '', role: 'sales' });
        fetchData();
      }
    } catch (err) {
      alert('خطأ في الاتصال بالشبكة[span_10](start_span)[span_10](end_span).');
    }
  };

  const handleExportToExcel = () => {
    if (leads.length === 0) { alert('لا توجد بيانات[span_11](start_span)[span_11](end_span)'); return; }
    const headers = ['Name', 'Phone', 'Email', 'Source', 'Status', 'Next Follow Up', 'Budget', 'Preferred Location', 'Property Type'];
    const rows = leads.map(l => [
      `"${l.name || ''}"`, 
      `"${l.phone || ''}"`, 
      `"${l.email || ''}"`, 
      `"${l.lead_source || ''}"`, 
      `"${l.status || ''}"`, 
      `"${l.next_follow_up || ''}"`,
      `"${l.budget || ''}"`,
      `"${l.preferred_location || ''}"`,
      `"${l.property_type || ''}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ARCOVA_Clients.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logAuditAction('EXPORT_LEADS', 'تصدير بيانات العملاء إلى ملف CSV');
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

  // إحصائيات التحليلات الموسعة
  const conversionRate = totalLeadsCount > 0 ? ((closedWonCount / totalLeadsCount) * 100).toFixed(1) : 0;
  const sourceStats = leads.reduce((acc, lead) => {
    const src = lead.lead_source || 'Unknown';
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {});

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
          <button onClick={() => setActiveTab('projects')} style={{ padding: '0.5rem 1rem', backgroundColor: activeTab === 'projects' ? '#d4af37' : 'transparent', color: activeTab === 'projects' ? '#0c0f17' : '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>🏢 المشاريع والوحدات</button>
          <button onClick={() => setActiveTab('campaigns')} style={{ padding: '0.5rem 1rem', backgroundColor: activeTab === 'campaigns' ? '#d4af37' : 'transparent', color: activeTab === 'campaigns' ? '#0c0f17' : '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>📢 الحملات التسويقية</button>
          <button onClick={() => setActiveTab('analytics')} style={{ padding: '0.5rem 1rem', backgroundColor: activeTab === 'analytics' ? '#d4af37' : 'transparent', color: activeTab === 'analytics' ? '#0c0f17' : '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>📊 التحليلات المتقدمة</button>
          {userRole === 'admin' && (
            <>
              <button onClick={() => setActiveTab('team')} style={{ padding: '0.5rem 1rem', backgroundColor: activeTab === 'team' ? '#d4af37' : 'transparent', color: activeTab === 'team' ? '#0c0f17' : '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>فريق العمل</button>
              <button onClick={() => setActiveTab('leaderboard')} style={{ padding: '0.5rem 1rem', backgroundColor: activeTab === 'leaderboard' ? '#d4af37' : 'transparent', color: activeTab === 'leaderboard' ? '#0c0f17' : '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>🏆 أداء المبيعات (Leaderboard)</button>
              <button onClick={() => setActiveTab('audit')} style={{ padding: '0.5rem 1rem', backgroundColor: activeTab === 'audit' ? '#d4af37' : 'transparent', color: activeTab === 'audit' ? '#0c0f17' : '#d4af37', border: '1px solid #d4af37', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>🛡️ سجل التدقيق (Audit)</button>
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
                    <th style={{ padding: '0.8rem' }}>الميزانية والاهتمامات</th>
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
                      <td style={{ padding: '0.8rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                        <div>💰 {lead.budget ? `${lead.budget} ج.م` : 'غير محدد'}</div>
                        <div>📍 {lead.preferred_location || 'غير محدد'} ({lead.property_type || 'شقة'})</div>
                      </td>
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

        {activeTab === 'projects' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#d4af37', fontFamily: 'serif', fontSize: '1.1rem', margin: 0 }}>إدارة المشاريع والوحدات العقارية</h3>
              {userRole === 'admin' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setShowProjectModal(true)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>+ إضافة مشروع</button>
                  <button onClick={() => setShowUnitModal(true)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#1f2937', color: '#34d399', border: '1px solid #34d399', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>+ إضافة وحدة</button>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {projects.map(proj => (
                <div key={proj.id} style={{ backgroundColor: '#131822', padding: '1rem', borderRadius: '6px', border: '1px solid #1f2937', borderRight: '4px solid #d4af37' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#fff' }}>{proj.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#d4af37', margin: '0.2rem 0' }}>📍 {proj.location || 'غير محدد'}</div>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.5rem' }}>{proj.description || 'لا توجد تفاصيل'}</div>
                </div>
              ))}
            </div>

            <h4 style={{ color: '#d4af37', fontFamily: 'serif', fontSize: '1rem', marginBottom: '0.8rem' }}>قائمة الوحدات المتاحة والمحجوزة</h4>
            <div style={{ backgroundColor: '#131822', borderRadius: '6px', overflowX: 'auto', border: '1px solid #1f2937' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0c0f17', color: '#d4af37', borderBottom: '1px solid #1f2937' }}>
                    <th style={{ padding: '0.8rem' }}>المشروع</th>
                    <th style={{ padding: '0.8rem' }}>رقم الوحدة</th>
                    <th style={{ padding: '0.8rem' }}>النوع</th>
                    <th style={{ padding: '0.8rem' }}>المساحة</th>
                    <th style={{ padding: '0.8rem' }}>السعر</th>
                    <th style={{ padding: '0.8rem' }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map(unit => (
                    <tr key={unit.id} style={{ borderBottom: '1px solid #1f2937' }}>
                      <td style={{ padding: '0.8rem', fontWeight: 'bold' }}>{unit.projects?.name || 'مشروع محذوف'}</td>
                      <td style={{ padding: '0.8rem', color: '#f3f4f6' }}>{unit.unit_number}</td>
                      <td style={{ padding: '0.8rem', color: '#9ca3af' }}>{unit.type}</td>
                      <td style={{ padding: '0.8rem', color: '#9ca3af' }}>{unit.area} م²</td>
                      <td style={{ padding: '0.8rem', color: '#34d399' }}>{unit.price} ج.م</td>
                      <td style={{ padding: '0.8rem' }}>
                        <select value={unit.status || 'Available'} onChange={(e) => handleUpdateUnitStatus(unit.id, e.target.value)} style={{ padding: '0.3rem', backgroundColor: '#0c0f17', color: unit.status === 'Available' ? '#34d399' : '#f87171', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.8rem' }}>
                          <option value="Available">🟢 متاحة</option>
                          <option value="Reserved">🟡 محجوزة</option>
                          <option value="Sold">🔴 مباعة</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div style={{ backgroundColor: '#131822', padding: '1.5rem', borderRadius: '6px', border: '1px solid #1f2937' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#d4af37', fontFamily: 'serif', fontSize: '1.1rem', margin: 0 }}>📢 إدارة الحملات التسويقية</h3>
              {userRole === 'admin' && (
                <button onClick={() => setShowCampaignModal(true)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>+ إضافة حملة</button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {campaigns.map(camp => (
                <div key={camp.id} style={{ backgroundColor: '#0c0f17', padding: '1rem', borderRadius: '6px', border: '1px solid #1f2937', borderLeft: '4px solid #d4af37' }}>
                  <div style={{ fontWeight: 'bold', color: '#f3f4f6', fontSize: '0.95rem' }}>{camp.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#d4af37', margin: '0.3rem 0' }}>المنصة: {camp.platform}</div>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>الميزانية: {camp.budget ? `${camp.budget} ج.م` : 'غير محددة'}</div>
                  <div style={{ fontSize: '0.8rem', color: camp.status === 'Active' ? '#34d399' : '#f87171', marginTop: '0.5rem' }}>الحالة: {camp.status}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div style={{ backgroundColor: '#131822', padding: '1.5rem', borderRadius: '6px', border: '1px solid #1f2937' }}>
            <h3 style={{ color: '#d4af37', fontFamily: 'serif', fontSize: '1.1rem', marginBottom: '1rem' }}>📊 التحليلات المتقدمة للأداء</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ backgroundColor: '#0c0f17', padding: '1rem', borderRadius: '6px', border: '1px solid #1f2937' }}>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>معدل التحويل (Conversion Rate)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#34d399', marginTop: '0.4rem' }}>{conversionRate}%</div>
              </div>
              <div style={{ backgroundColor: '#0c0f17', padding: '1rem', borderRadius: '6px', border: '1px solid #1f2937' }}>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>إجمالي العملاء المتوقع إغلاقهم</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b', marginTop: '0.4rem' }}>{interestedCount}</div>
              </div>
            </div>

            <h4 style={{ color: '#d4af37', fontFamily: 'serif', fontSize: '1rem', marginBottom: '0.8rem' }}>توزيع العملاء حسب المصدر (Lead Sources)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
              {Object.entries(sourceStats).map(([src, count]) => (
                <div key={src} style={{ backgroundColor: '#0c0f17', padding: '0.8rem', borderRadius: '4px', border: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#f3f4f6' }}>{src}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#d4af37' }}>{count}</span>
                </div>
              ))}
            </div>
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

        {activeTab === 'audit' && userRole === 'admin' && (
          <div style={{ backgroundColor: '#131822', padding: '1.5rem', borderRadius: '6px', border: '1px solid #1f2937' }}>
            <h3 style={{ color: '#d4af37', fontFamily: 'serif', fontSize: '1.1rem', marginBottom: '1rem' }}>🛡️ سجل التدقيق (Audit Logs)</h3>
            <div style={{ backgroundColor: '#0c0f17', borderRadius: '6px', overflowX: 'auto', border: '1px solid #1f2937' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#131822', color: '#d4af37', borderBottom: '1px solid #1f2937' }}>
                    <th style={{ padding: '0.8rem' }}>المستخدم</th>
                    <th style={{ padding: '0.8rem' }}>نوع الإجراء</th>
                    <th style={{ padding: '0.8rem' }}>التفاصيل</th>
                    <th style={{ padding: '0.8rem' }}>الوقت</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #1f2937' }}>
                      <td style={{ padding: '0.8rem', color: '#f3f4f6' }}>{log.user_email}</td>
                      <td style={{ padding: '0.8rem', color: '#d4af37', fontWeight: 'bold' }}>{log.action_type}</td>
                      <td style={{ padding: '0.8rem', color: '#9ca3af' }}>{log.details}</td>
                      <td style={{ padding: '0.8rem', color: '#6b7280', fontSize: '0.75rem' }}>
                        {new Date(log.created_at).toLocaleString('ar-EG')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

      {/* Modal إضافة مشروع */}
      {showProjectModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#131822', padding: '1.5rem', borderRadius: '6px', width: '350px', border: '1px solid #d4af37' }}>
            <h3 style={{ color: '#d4af37', fontFamily: 'serif', marginTop: 0, fontSize: '1rem' }}>إضافة مشروع جديد</h3>
            <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.8rem' }}>
              <input type="text" placeholder="اسم المشروع *" required value={newProjectData.name} onChange={(e) => setNewProjectData({...newProjectData, name: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.85rem' }} />
              <input type="text" placeholder="الموقع / العرض" value={newProjectData.location} onChange={(e) => setNewProjectData({...newProjectData, location: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.85rem' }} />
              <textarea placeholder="وصف المشروع" value={newProjectData.description} onChange={(e) => setNewProjectData({...newProjectData, description: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.85rem', minHeight: '60px' }} />
              <button type="submit" style={{ padding: '0.6rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>حفظ المشروع</button>
              <button type="button" onClick={() => setShowProjectModal(false)} style={{ padding: '0.5rem', backgroundColor: '#374151', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.85rem' }}>إلغاء</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal إضافة وحدة */}
      {showUnitModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#131822', padding: '1.5rem', borderRadius: '6px', width: '350px', border: '1px solid #d4af37' }}>
            <h3 style={{ color: '#d4af37', fontFamily: 'serif', marginTop: 0, fontSize: '1rem' }}>إضافة وحدة عقارية</h3>
            <form onSubmit={handleCreateUnit} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.8rem' }}>
              <select required value={newUnitData.project_id} onChange={(e) => setNewUnitData({...newUnitData, project_id: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.85rem' }}>
                <option value="">-- اختر المشروع --</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="text" placeholder="رقم الوحدة *" required value={newUnitData.unit_number} onChange={(e) => setNewUnitData({...newUnitData, unit_number: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.85rem' }} />
              <input type="text" placeholder="النوع (شقة، فيلا، مكتب...)" value={newUnitData.type} onChange={(e) => setNewUnitData({...newUnitData, type: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.85rem' }} />
              <input type="number" placeholder="المساحة (م²)" value={newUnitData.area} onChange={(e) => setNewUnitData({...newUnitData, area: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.85rem' }} />
              <input type="number" placeholder="السعر" value={newUnitData.price} onChange={(e) => setNewUnitData({...newUnitData, price: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#0c0f17', color: '#fff', border: '1px solid #374151', borderRadius: '4px', fontSize: '0.85rem' }} />
                  </div>
  );
}
          

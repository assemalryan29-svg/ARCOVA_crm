import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  Bell, BellOff, LogOut, Plus, Download, Upload, Search,
  Folder, Target, Building, CheckSquare, TrendingUp, Users,
  Shield, Trophy, Phone, MessageCircle, FileText, Calendar,
  X, DollarSign, MapPin, Calculator, FileClock, CheckCircle2
} from 'lucide-react';

export default function Dashboard() {
  // === 1. States (الحالات البرمجية كما هي تماماً) ===
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('sales'); 
  const [teamMembers, setTeamMembers] = useState([]);
  
  const [leads, setLeads] = useState([]);
  const [leadLogs, setLeadLogs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [units, setUnits] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  
  const [folders, setFolders] = useState(['عملاء التجمع', 'متابعة حارة', 'أرشيف 2026']);
  const [selectedFolderFilter, setSelectedFolderFilter] = useState('');
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);

  const [activeTab, setActiveTab] = useState('list');
  
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  
  const [selectedLead, setSelectedLead] = useState(null);

  const [newNote, setNewNote] = useState('');
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'sales' });
  
  const [newLeadData, setNewLeadData] = useState({ 
    name: '', phone: '', email: '', lead_source: 'Manual', assigned_to: '',
    budget: '', preferred_area: '', desired_unit_type: 'شقة', folder: ''
  });

  const [newProjectData, setNewProjectData] = useState({ name: '', location: '', description: '' });
  const [newUnitData, setNewUnitData] = useState({ project_id: '', unit_number: '', type: 'شقة', area: '', price: '', status: 'Available' });
  const [newTaskData, setNewTaskData] = useState({ title: '', lead_id: '', due_date: '', description: '' });
  const [newCampaignData, setNewCampaignData] = useState({ name: '', platform: '', budget: '', status: 'Active' });
  
  const [calcData, setCalcData] = useState({
    unitPrice: '', downPaymentPercent: 10, deliveryPercent: 10, years: 5, installmentType: 'monthly'
  });

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

  // === 2. Effects & Functions (المنطق البرمجي كما هو تماماً) ===
  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!audioEnabled) return;
    const interval = setInterval(() => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const hasDue = leads.some(l => l.next_follow_up && new Date(l.next_follow_up).toISOString().slice(0, 10) <= todayStr);
      if (hasDue) playNotificationSound();
    }, 60000);
    return () => clearInterval(interval);
  }, [audioEnabled, leads]);

  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = audioCtxRef.current || new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.5);
    } catch (e) { console.log("Audio play error:", e); }
  };

  const enableAudioAndTest = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume();
      setAudioEnabled(true);
      playNotificationSound();
    } catch (e) { alert('الرجاء النقر مرة أخرى للسماح بالتشغيل.'); }
  };

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/'; return; }
      setCurrentUser(session.user);

      const { data: roleData } = await supabase.from('user_roles').select('role').eq('id', session.user.id).single();
      let role = roleData?.role || 'sales';
      if (session.user.email === 'assemryan0@gmail.com') role = 'admin';
      setUserRole(role);

      const { data: usersData } = await supabase.from('user_roles').select('*');
      if (usersData) setTeamMembers(usersData || []);

      let leadsQuery = supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (role === 'sales') leadsQuery = leadsQuery.eq('assigned_to', session.user.id);
      const { data: leadsData } = await leadsQuery;
      if (leadsData) setLeads(leadsData || []);

      const { data: projData } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (projData) setProjects(projData || []);

      const { data: unitData } = await supabase.from('units').select('*, projects(name)').order('created_at', { ascending: false });
      if (unitData) setUnits(unitData || []);

      const { data: taskData } = await supabase.from('tasks').select('*, leads(name)').order('created_at', { ascending: false });
      if (taskData) setTasks(taskData || []);

      const { data: campData } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
      if (campData) setCampaigns(campData || []);

      if (role === 'admin') {
        const { data: auditData } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
        if (auditData) setAuditLogs(auditData || []);
      }
    } catch (err) { console.log('Error fetching data:', err); } 
    finally { setLoading(false); }
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
    if (!newLeadData.name || !newLeadData.phone) { alert('الرجاء إدخال اسم ورقم هاتف العميل'); return; }
    try {
      const assignedTarget = (userRole === 'admin' || userRole === 'marketing') ? (newLeadData.assigned_to || null) : currentUser.id;
      const { error } = await supabase.from('leads').insert([{
        name: newLeadData.name, phone: newLeadData.phone, email: newLeadData.email || '', lead_source: newLeadData.lead_source,
        status: 'New Lead', assigned_to: assignedTarget, budget: newLeadData.budget ? parseFloat(newLeadData.budget) : null,
        preferred_area: newLeadData.preferred_area, desired_unit_type: newLeadData.desired_unit_type, folder: newLeadData.folder || null
      }]);
      if (error) alert('خطأ في الإضافة: ' + error.message);
      else {
        setShowAddLeadModal(false);
        setNewLeadData({ name: '', phone: '', email: '', lead_source: 'Manual', assigned_to: '', budget: '', preferred_area: '', desired_unit_type: 'شقة', folder: '' });
        fetchData();
      }
    } catch (err) { alert('تعذر الاتصال بالخادم.'); }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectData.name) return;
    const { error } = await supabase.from('projects').insert([newProjectData]);
    if (!error) { setShowProjectModal(false); setNewProjectData({ name: '', location: '', description: '' }); fetchData(); alert('تم إضافة المشروع'); }
  };

  const handleCreateUnit = async (e) => {
    e.preventDefault();
    if (!newUnitData.project_id || !newUnitData.unit_number) return;
    const { error } = await supabase.from('units').insert([newUnitData]);
    if (!error) { setShowUnitModal(false); setNewUnitData({ project_id: '', unit_number: '', type: 'شقة', area: '', price: '', status: 'Available' }); fetchData(); alert('تم إضافة الوحدة'); }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskData.title) return;
    const { error } = await supabase.from('tasks').insert([{ ...newTaskData, status: 'Pending', created_by: currentUser.id }]);
    if (!error) { setShowTaskModal(false); setNewTaskData({ title: '', lead_id: '', due_date: '', description: '' }); fetchData(); }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!newCampaignData.name) return;
    const { error } = await supabase.from('campaigns').insert([newCampaignData]);
    if (!error) { setShowCampaignModal(false); setNewCampaignData({ name: '', platform: '', budget: '', status: 'Active' }); fetchData(); alert('تم إضافة الحملة'); }
  };

  const handleCreateFolder = (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    if (!folders.includes(newFolderName.trim())) setFolders([...folders, newFolderName.trim()]);
    setNewFolderName('');
    setShowCreateFolderModal(false);
  };

  const handleMoveLeadToFolder = async (leadId, folderName) => {
    const { error } = await supabase.from('leads').update({ folder: folderName || null }).eq('id', leadId);
    if (!error) {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, folder: folderName } : l));
      if (selectedLead?.id === leadId) setSelectedLead(prev => ({ ...prev, folder: folderName }));
    }
  };

  const handleUpdateUnitStatus = async (unitId, newStatus) => {
    const { error } = await supabase.from('units').update({ status: newStatus }).eq('id', unitId);
    if (!error) fetchData();
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    if (!error) fetchData();
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
          const name = cols[0], phone = cols[1], email = cols[2] || '', lead_source = cols[3] || 'Imported';
          if (name && phone) {
            await supabase.from('leads').insert([{ name, phone, email, lead_source, status: 'New Lead', assigned_to: null }]);
            importedCount++;
          }
        }
        alert(`تم استيراد ${importedCount} عميل بنجاح!`);
        setShowImportModal(false); fetchData();
      } catch (err) { alert('حدث خطأ أثناء قراءة الملف.'); }
    };
    reader.readAsText(file);
  };

  const handleUpdateLeadStatus = async (leadId, newStatus) => {
    if (userRole === 'marketing') return; 
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
    if (!error) {
      setLeads(prevLeads => prevLeads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      await supabase.from('lead_logs').insert([{ lead_id: leadId, user_email: currentUser.email, action_type: 'Status Change', content: `تغيير حالة العميل: ${newStatus}` }]);
      if (selectedLead?.id === leadId) { setSelectedLead(prev => ({ ...prev, status: newStatus })); fetchLeadLogs(leadId); }
    }
  };

  const handleSaveLeadExtendedDetails = async (e) => {
    e.preventDefault();
    if (!selectedLead || userRole === 'marketing') return;
    const { error } = await supabase.from('leads').update({
      budget: selectedLead.budget ? parseFloat(selectedLead.budget) : null,
      preferred_area: selectedLead.preferred_area, desired_unit_type: selectedLead.desired_unit_type
    }).eq('id', selectedLead.id);
    if (!error) { alert('تم تحديث التفاصيل'); fetchData(); }
  };

  const handleSaveFollowUp = async (leadId, dateValue) => {
    if (userRole === 'marketing') return;
    const { error } = await supabase.from('leads').update({ next_follow_up: dateValue || null }).eq('id', leadId);
    if (!error) {
      setLeads(prevLeads => prevLeads.map(l => l.id === leadId ? { ...l, next_follow_up: dateValue } : l));
      await supabase.from('lead_logs').insert([{ lead_id: leadId, user_email: currentUser.email, action_type: 'Follow-up Set', content: `تم جدولة متابعة: ${dateValue ? new Date(dateValue).toLocaleString('ar-EG') : 'لا يوجد'}` }]);
      if (selectedLead?.id === leadId) { setSelectedLead(prev => ({ ...prev, next_follow_up: dateValue })); fetchLeadLogs(leadId); }
    }
  };

  const handleAddLogNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedLead) return;
    const { error } = await supabase.from('lead_logs').insert([{ lead_id: selectedLead.id, user_email: currentUser.email, action_type: 'Feedback/Note', content: newNote }]);
    if (!error) { setNewNote(''); fetchLeadLogs(selectedLead.id); }
  };

  const handleAssignLead = async (leadId, assigneeId) => {
    if (userRole !== 'admin') return;
    const target = teamMembers.find(m => m.id === assigneeId);
    const { error } = await supabase.from('leads').update({ assigned_to: assigneeId || null }).eq('id', leadId);
    if (!error) {
      setLeads(prevLeads => prevLeads.map(l => l.id === leadId ? { ...l, assigned_to: assigneeId } : l));
      await supabase.from('lead_logs').insert([{ lead_id: leadId, user_email: currentUser.email, action_type: 'Assign', content: `إسناد العميل إلى: ${target ? target.email : 'غير مخصص'}` }]);
      if (selectedLead) fetchLeadLogs(leadId);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.auth.signUp({ email: newUser.email, password: newUser.password });
      if (error) { alert('ملاحظة: ' + error.message); return; }
      if (data?.user) {
        await supabase.from('user_roles').insert([{ id: data.user.id, email: newUser.email, role: newUser.role }]);
        alert('تم إضافة الموظف بنجاح!'); setShowUserModal(false); setNewUser({ email: '', password: '', role: 'sales' }); fetchData();
      }
    } catch (err) { alert('خطأ اتصال'); }
  };

  const handleExportToExcel = () => {
    if (leads.length === 0) return;
    const headers = ['Name', 'Phone', 'Email', 'Source', 'Status', 'Budget', 'Area', 'Folder', 'Next Follow Up'];
    const rows = leads.map(l => [`"${l.name || ''}"`, `"${l.phone || ''}"`, `"${l.email || ''}"`, `"${l.lead_source || ''}"`, `"${l.status || ''}"`, `"${l.budget || ''}"`, `"${l.preferred_area || ''}"`, `"${l.folder || ''}"`, `"${l.next_follow_up || ''}"`]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.setAttribute('href', url); link.setAttribute('download', `ARCOVA_Clients.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleSaveFinancialPlan = async (e) => {
    e.preventDefault();
    if (!selectedLead || !calcData.unitPrice || userRole === 'marketing') return;
    const price = parseFloat(calcData.unitPrice);
    const down = price * (calcData.downPaymentPercent / 100);
    const delivery = price * (calcData.deliveryPercent / 100);
    const remainder = price - (down + delivery);
    const multiplier = calcData.installmentType === 'monthly' ? 12 : (calcData.installmentType === 'quarterly' ? 4 : 1);
    const totalInstalls = calcData.years * multiplier;
    const installValue = remainder / totalInstalls;

    const planDetails = `خطة دفع مقترحة: السعر: ${price.toLocaleString()} | المقدم: ${down.toLocaleString()} | الاستلام: ${delivery.toLocaleString()} | القسط (${calcData.installmentType}): ${installValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} لمدة ${calcData.years} سنوات.`;
    const { error } = await supabase.from('lead_logs').insert([{ lead_id: selectedLead.id, user_email: currentUser.email, action_type: 'Financial Plan', content: planDetails }]);
    if (!error) { alert('تم حفظ الخطة المالية في ملف العميل'); fetchLeadLogs(selectedLead.id); }
  };

  const filteredLeads = leads.filter(l => {
    const matchesSearch = (l.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.phone || '').includes(searchQuery);
    const matchesFolder = selectedFolderFilter ? l.folder === selectedFolderFilter : true;
    let matchesCampaignOrProject = true;
    if (selectedCampaignFilter) {
      matchesCampaignOrProject = (l.campaign_id === selectedCampaignFilter || l.lead_source === selectedCampaignFilter || l.preferred_area === selectedCampaignFilter);
    } else if (userRole === 'marketing') {
      matchesCampaignOrProject = l.lead_source === 'Marketing' || l.assigned_to === currentUser.id;
    }
    return matchesSearch && matchesFolder && matchesCampaignOrProject;
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const dueFollowUps = leads.filter(l => l.next_follow_up && new Date(l.next_follow_up).toISOString().slice(0, 10) <= todayStr);
  const totalLeadsCount = leads.length;
  const interestedCount = leads.filter(l => l.status === 'Interested').length;
  const closedWonCount = leads.filter(l => l.status === 'Closed Won').length;
  const conversionRate = totalLeadsCount > 0 ? ((closedWonCount / totalLeadsCount) * 100).toFixed(1) : 0;
  const totalDealsValue = leads.filter(l => l.status === 'Closed Won' && l.budget).reduce((acc, curr) => acc + Number(curr.budget), 0);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-amber-500 font-bold text-xl">جاري التحميل...</div>;

  // === 3. UI Template (تصميم Tailwind المطور مع الاحتفاظ بالألوان الفخمة) ===
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans dir-rtl">
      
      {/* Header */}
      <header className="bg-slate-900 border-b border-amber-500/20 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3 bg-slate-800/50 border border-amber-500/30 py-2 px-4 rounded-xl shadow-inner">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-200 flex items-center justify-center text-slate-900 font-bold">A</div>
          <div>
            <h1 className="text-amber-500 font-serif text-xl tracking-wide font-bold leading-none">ARCOVA</h1>
            <span className="text-xs text-slate-400">CRM System</span>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-slate-800/80 px-4 py-2 rounded-full border border-slate-700">
          <button onClick={enableAudioAndTest} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${audioEnabled ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/50' : 'bg-red-900/40 text-red-400 border border-red-800/50 hover:bg-red-900/60'}`}>
            {audioEnabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
            {audioEnabled ? 'تنبيه مفعل' : 'تفعيل الصوت'}
          </button>
          
          <div className="flex items-center gap-2 border-r border-slate-600 pr-4">
            <span className="text-sm font-medium text-slate-300">{currentUser?.email}</span>
            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${userRole === 'admin' ? 'bg-amber-500 text-slate-900' : userRole === 'marketing' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
              {userRole}
            </span>
          </div>

          {userRole === 'admin' && (
            <button onClick={() => setShowUserModal(true)} className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded-full transition-colors" title="إضافة موظف">
              <Users className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors" title="تسجيل خروج">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Tabs Menu */}
      <div className="bg-slate-900 px-6 py-2 border-b border-slate-800 flex gap-2 overflow-x-auto hide-scrollbar">
        {[
          { id: 'list', label: `العملاء (${leads.length})`, icon: Users },
          { id: 'reminders', label: `المتابعات (${dueFollowUps.length})`, icon: Bell },
          { id: 'tasks', label: `المهام (${tasks.length})`, icon: CheckSquare },
          { id: 'projects', label: 'المشاريع والوحدات', icon: Building },
          { id: 'campaigns', label: 'الحملات', icon: Target },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-amber-500 text-slate-900 shadow-md shadow-amber-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
        
        {userRole === 'admin' && (
          <>
            <div className="w-px h-6 bg-slate-700 my-auto mx-2"></div>
            {[
              { id: 'leaderboard', label: 'أداء المبيعات', icon: Trophy },
              { id: 'audit', label: 'سجل التدقيق', icon: Shield },
              { id: 'team', label: 'الفريق', icon: Users },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:bg-slate-800'}`}>
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
          </>
        )}
      </div>

      <main className="p-6 max-w-[1600px] mx-auto">
        {/* KPIs Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'إجمالي العملاء', value: totalLeadsCount, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { label: 'مهتم جداً', value: interestedCount, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
            { label: 'تم التعاقد (Won)', value: closedWonCount, color: 'text-blue-400', bg: 'bg-blue-400/10' },
            { label: 'نسبة التحويل', value: `${conversionRate}%`, color: 'text-purple-400', bg: 'bg-purple-400/10' },
            { label: 'إجمالي الصفقات', value: `${totalDealsValue.toLocaleString()} ج`, color: 'text-rose-400', bg: 'bg-rose-400/10' },
          ].map((kpi, i) => (
            <div key={i} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between shadow-sm">
              <span className="text-xs text-slate-400 font-medium">{kpi.label}</span>
              <div className={`text-2xl font-bold mt-2 ${kpi.color}`}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* --- Tab Content: Leads List --- */}
        {activeTab === 'list' && (
          <div className="animate-in fade-in duration-300">
            {/* Toolbar */}
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 mb-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <div className="relative">
                  <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="text" placeholder="بحث باسم أو هاتف..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-4 pr-10 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none w-64 text-slate-200" />
                </div>
                
                <select value={selectedFolderFilter} onChange={(e) => setSelectedFolderFilter(e.target.value)} className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-300 outline-none focus:border-amber-500">
                  <option value="">📁 كل المجلدات</option>
                  {folders.map((f, idx) => <option key={idx} value={f}>{f}</option>)}
                </select>
                
                <button onClick={() => setShowCreateFolderModal(true)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors" title="مجلد جديد">
                  <Folder className="w-4 h-4" />
                </button>

                <select value={selectedCampaignFilter} onChange={(e) => setSelectedCampaignFilter(e.target.value)} className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-purple-400 outline-none focus:border-purple-500">
                  <option value="">🎯 كل الحملات والمشاريع</option>
                  {campaigns.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-3">
                {userRole === 'admin' && (
                  <>
                    <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-emerald-400 border border-slate-700 rounded-xl hover:bg-slate-700 text-sm font-medium transition-colors"><Upload className="w-4 h-4"/> استيراد</button>
                    <button onClick={handleExportToExcel} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-amber-500 border border-slate-700 rounded-xl hover:bg-slate-700 text-sm font-medium transition-colors"><Download className="w-4 h-4"/> تصدير</button>
                  </>
                )}
                <button onClick={() => setShowAddLeadModal(true)} className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-slate-950 rounded-xl hover:bg-amber-400 text-sm font-bold shadow-lg shadow-amber-500/20 transition-all"><Plus className="w-4 h-4"/> تسجيل عميل</button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4 font-medium">العميل</th>
                      <th className="px-6 py-4 font-medium">المصدر/المجلد</th>
                      <th className="px-6 py-4 font-medium">الاهتمام</th>
                      <th className="px-6 py-4 font-medium">الحالة</th>
                      <th className="px-6 py-4 font-medium">المتابعة القادمة</th>
                      <th className="px-6 py-4 font-medium">المسؤول</th>
                      <th className="px-6 py-4 font-medium text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-200">{lead.name}</div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <Phone className="w-3 h-3"/> {userRole === 'admin' ? lead.phone : `******${(lead.phone || '').slice(-4)}`}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-300 bg-slate-800 px-2 py-1 rounded text-xs">{lead.lead_source}</span>
                          {lead.folder && <div className="text-amber-500 text-xs mt-2 flex items-center gap-1"><Folder className="w-3 h-3"/>{lead.folder}</div>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-300 font-medium">{lead.budget ? `${Number(lead.budget).toLocaleString()} ج` : '-'}</div>
                          <div className="text-xs text-slate-500 mt-1">{lead.preferred_area || '-'} ({lead.desired_unit_type || '-'})</div>
                        </td>
                        <td className="px-6 py-4">
                          <select disabled={userRole === 'marketing'} value={lead.status || 'New Lead'} onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)} className={`bg-slate-950 border border-slate-700 text-xs px-2 py-1.5 rounded-lg outline-none ${userRole === 'marketing' ? 'opacity-60 cursor-not-allowed' : 'focus:border-amber-500'} ${lead.status === 'Closed Won' ? 'text-emerald-400' : lead.status === 'Interested' ? 'text-amber-500' : 'text-slate-300'}`}>
                            {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          {lead.next_follow_up ? (
                            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><Calendar className="w-3 h-3"/> {new Date(lead.next_follow_up).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          ) : (
                            <span className="text-xs text-slate-500">غير محدد</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {userRole === 'admin' ? (
                            <select value={lead.assigned_to || ''} onChange={(e) => handleAssignLead(lead.id, e.target.value)} className="bg-slate-950 border border-slate-700 text-slate-300 text-xs px-2 py-1.5 rounded-lg outline-none focus:border-amber-500">
                              <option value="">غير مخصص</option>
                              {teamMembers.map(m => <option key={m.id} value={m.id}>{m.email.split('@')[0]}</option>)}
                            </select>
                          ) : userRole === 'marketing' ? (
                            <span className="text-xs text-slate-500">{teamMembers.find(m => m.id === lead.assigned_to)?.email.split('@')[0] || 'غير مخصص'}</span>
                          ) : (
                            <span className="text-xs text-emerald-400 font-medium">مخصص لك</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleOpenLeadDetails(lead)} className="px-3 py-1.5 bg-slate-800 hover:bg-amber-500 hover:text-slate-900 text-slate-300 text-xs font-medium rounded-lg transition-colors border border-slate-700 hover:border-amber-500">تفاصيل</button>
                            <select value={lead.folder || ''} onChange={(e) => handleMoveLeadToFolder(lead.id, e.target.value)} className="w-6 p-1.5 opacity-0 absolute group-hover:opacity-100 group-hover:relative transition-all bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded-lg cursor-pointer" title="نقل لمجلد">
                              <option value="">نقل لـ...</option>
                              {folders.map((f, i) => <option key={i} value={f}>{f}</option>)}
                            </select>
                            {userRole !== 'marketing' && (
                              <>
                                <a href={`tel:${lead.phone}`} className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-slate-900 rounded-lg transition-colors" title="اتصال"><Phone className="w-4 h-4"/></a>
                                <a href={`https://wa.me/${(lead.phone || '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg transition-colors" title="واتساب"><MessageCircle className="w-4 h-4"/></a>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredLeads.length === 0 && (
                      <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500">لا توجد نتائج مطابقة للبحث</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- Tab Content: Reminders --- */}
        {activeTab === 'reminders' && (
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 animate-in fade-in">
            <h3 className="text-amber-500 font-serif text-lg mb-6 flex items-center gap-2"><Bell className="w-5 h-5"/> المتابعات المستحقة</h3>
            {dueFollowUps.length === 0 ? (
              <div className="text-center py-10 text-slate-500 flex flex-col items-center"><CheckCircle2 className="w-12 h-12 mb-3 text-slate-700"/> لا توجد مهام متابعة مستحقة لليوم. عمل رائع!</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dueFollowUps.map(lead => (
                  <div key={lead.id} className="bg-slate-950 p-4 rounded-xl border border-red-500/30 flex flex-col justify-between hover:border-red-500/60 transition-colors">
                    <div>
                      <div className="font-bold text-slate-200 mb-1">{lead.name}</div>
                      <div className="text-sm text-slate-500 mb-3">{userRole === 'admin' ? lead.phone : `******${(lead.phone || '').slice(-4)}`}</div>
                      <div className="text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg inline-flex items-center gap-2"><FileClock className="w-3 h-3"/> الموعد: {new Date(lead.next_follow_up).toLocaleString('ar-EG')}</div>
                    </div>
                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800">
                      <button onClick={() => handleOpenLeadDetails(lead)} className="flex-1 py-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-slate-900 rounded-lg text-sm font-medium transition-colors">فتح الملف</button>
                      {userRole !== 'marketing' && (
                        <>
                          <a href={`tel:${lead.phone}`} className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-center"><Phone className="w-4 h-4"/></a>
                          <a href={`https://wa.me/${(lead.phone || '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="p-2 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors flex items-center justify-center"><MessageCircle className="w-4 h-4"/></a>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- Tab Content: Projects & Tasks (وغيرها من التبويبات كأمثلة سريعة) --- */}
        {activeTab === 'projects' && (
           <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 animate-in fade-in">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-amber-500 font-serif text-lg flex items-center gap-2"><Building className="w-5 h-5"/> المشاريع والوحدات</h3>
                {(userRole === 'admin' || userRole === 'marketing') && (
                  <div className="flex gap-3">
                    <button onClick={() => setShowProjectModal(true)} className="px-4 py-2 bg-slate-800 text-amber-500 border border-slate-700 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">+ إضافة مشروع</button>
                    <button onClick={() => setShowUnitModal(true)} className="px-4 py-2 bg-amber-500 text-slate-950 hover:bg-amber-400 rounded-xl text-sm font-bold shadow-lg transition-colors">+ إضافة وحدة</button>
                  </div>
                )}
             </div>
             {/* جدول الوحدات مصغر كمثال، يمكنك تطبيق نفس تنسيق Leads عليه */}
             <div className="overflow-x-auto border border-slate-800 rounded-xl">
               <table className="w-full text-right text-sm">
                 <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                   <tr><th className="px-4 py-3">المشروع</th><th className="px-4 py-3">الوحدة</th><th className="px-4 py-3">المساحة</th><th className="px-4 py-3">السعر</th><th className="px-4 py-3">الحالة</th></tr>
                 </thead>
                 <tbody className="divide-y divide-slate-800/50">
                   {units.map(u => (
                     <tr key={u.id} className="hover:bg-slate-800/30">
                       <td className="px-4 py-3 text-slate-200 font-bold">{u.projects?.name}</td>
                       <td className="px-4 py-3 text-slate-400">{u.unit_number} ({u.type})</td>
                       <td className="px-4 py-3 text-slate-400">{u.area} م²</td>
                       <td className="px-4 py-3 text-emerald-400 font-medium">{Number(u.price).toLocaleString()} ج</td>
                       <td className="px-4 py-3">
                         <select disabled={userRole === 'marketing'} value={u.status} onChange={(e)=>handleUpdateUnitStatus(u.id, e.target.value)} className="bg-slate-950 border border-slate-700 text-xs px-2 py-1 rounded outline-none text-slate-300">
                           <option value="Available">متاحة</option><option value="Reserved">محجوزة</option><option value="Sold">مباعة</option>
                         </select>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
        )}

        {/* ... (يمكنك تطبيق نفس فكرة عرض الجداول على المهام والحملات وسجل التدقيق بنفس الكلاسات bg-slate-900 border-slate-800) */}
        
      </main>

      {/* === 4. Modals (النوافذ المنبثقة بتصميم A-Class متراكب) === */}

      {/* Lead Details Modal (الأهم والمشترك بين المبيعات والأدمن) */}
      {selectedLead && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
              <div>
                <h3 className="text-xl font-bold text-amber-500">{selectedLead.name}</h3>
                <p className="text-sm text-slate-400 mt-1 flex gap-4">
                  <span>{userRole === 'admin' ? selectedLead.phone : `******${(selectedLead.phone || '').slice(-4)}`}</span>
                  <span>{selectedLead.email || 'بدون إيميل'}</span>
                </p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5"/></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Form 1: Extended Details */}
              <form onSubmit={handleSaveLeadExtendedDetails} className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
                <div className="text-sm font-bold text-amber-500 flex items-center gap-2 mb-2"><MapPin className="w-4 h-4"/> بيانات الاهتمام العقاري</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">الميزانية</label>
                    <input type="number" disabled={userRole === 'marketing'} value={selectedLead.budget || ''} onChange={(e) => setSelectedLead({...selectedLead, budget: e.target.value})} className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-200 disabled:opacity-50 outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">المنطقة المفضلة</label>
                    <input type="text" disabled={userRole === 'marketing'} value={selectedLead.preferred_area || ''} onChange={(e) => setSelectedLead({...selectedLead, preferred_area: e.target.value})} className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-200 disabled:opacity-50 outline-none focus:border-amber-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">نوع الوحدة</label>
                  <select disabled={userRole === 'marketing'} value={selectedLead.desired_unit_type || 'شقة'} onChange={(e) => setSelectedLead({...selectedLead, desired_unit_type: e.target.value})} className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-200 disabled:opacity-50 outline-none focus:border-amber-500">
                    <option value="شقة">شقة</option><option value="فيلا">فيلا</option><option value="تاون هاوس">تاون هاوس</option><option value="تجاري / إداري">تجاري / إداري</option>
                  </select>
                </div>
                {userRole !== 'marketing' && <button type="submit" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-500 text-sm font-medium rounded-lg border border-slate-700 transition-colors">حفظ التعديلات</button>}
              </form>

              {/* Status & Follow up */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                  <label className="text-xs text-slate-500 mb-2 block font-bold text-amber-500">تحديث الحالة</label>
                  <select disabled={userRole === 'marketing'} value={selectedLead.status || 'New Lead'} onChange={(e) => handleUpdateLeadStatus(selectedLead.id, e.target.value)} className="w-full bg-slate-900 border border-slate-700 px-3 py-2.5 rounded-lg text-sm text-slate-200 disabled:opacity-50 outline-none focus:border-amber-500">
                    {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                  <label className="text-xs text-slate-500 mb-2 block font-bold text-amber-500">موعد المتابعة القادم</label>
                  <div className="flex gap-2">
                    <input type="datetime-local" disabled={userRole === 'marketing'} value={followUpInput} onChange={(e) => setFollowUpInput(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 px-3 py-2.5 rounded-lg text-sm text-slate-200 disabled:opacity-50 outline-none focus:border-amber-500" />
                    {userRole !== 'marketing' && <button onClick={() => handleSaveFollowUp(selectedLead.id, followUpInput)} className="px-4 py-2 bg-amber-500 text-slate-900 text-sm font-bold rounded-lg hover:bg-amber-400 transition-colors">حفظ</button>}
                  </div>
                </div>
              </div>

              {/* Financial Calculator */}
              {userRole !== 'marketing' && (
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 border-l-4 border-l-emerald-500">
                  <h4 className="text-sm font-bold text-emerald-400 mb-4 flex items-center gap-2"><Calculator className="w-4 h-4"/> حاسبة الأقساط الذكية</h4>
                  <form onSubmit={handleSaveFinancialPlan} className="space-y-4">
                    <input type="number" placeholder="سعر الوحدة الإجمالي" value={calcData.unitPrice} onChange={(e) => setCalcData({...calcData, unitPrice: e.target.value})} className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-200 outline-none focus:border-emerald-500" required />
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-xs text-slate-500 mb-1 block">نسبة المقدم (%)</label><input type="number" value={calcData.downPaymentPercent} onChange={(e) => setCalcData({...calcData, downPaymentPercent: e.target.value})} className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-200 outline-none focus:border-emerald-500" /></div>
                      <div><label className="text-xs text-slate-500 mb-1 block">دفعة الاستلام (%)</label><input type="number" value={calcData.deliveryPercent} onChange={(e) => setCalcData({...calcData, deliveryPercent: e.target.value})} className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-200 outline-none focus:border-emerald-500" /></div>
                      <div><label className="text-xs text-slate-500 mb-1 block">سنوات التقسيط</label><input type="number" value={calcData.years} onChange={(e) => setCalcData({...calcData, years: e.target.value})} className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-200 outline-none focus:border-emerald-500" /></div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">دورية القسط</label>
                        <select value={calcData.installmentType} onChange={(e) => setCalcData({...calcData, installmentType: e.target.value})} className="w-full bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-sm text-slate-200 outline-none focus:border-emerald-500">
                          <option value="monthly">شهري</option><option value="quarterly">ربع سنوي</option><option value="yearly">سنوي</option>
                        </select>
                      </div>
                    </div>
                    {calcData.unitPrice && (
                      <div className="bg-emerald-500/10 p-3 rounded-lg text-emerald-400 text-sm border border-emerald-500/20 font-medium text-center">
                        القسط المستحق: {((parseFloat(calcData.unitPrice) - (parseFloat(calcData.unitPrice) * (calcData.downPaymentPercent/100)) - (parseFloat(calcData.unitPrice) * (calcData.deliveryPercent/100))) / (calcData.years * (calcData.installmentType === 'monthly' ? 12 : (calcData.installmentType === 'quarterly' ? 4 : 1)))).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ج.م
                      </div>
                    )}
                    <button type="submit" className="w-full py-2.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-900 border border-emerald-500/30 rounded-lg text-sm font-bold transition-colors">حفظ الخطة في السجل</button>
                  </form>
                </div>
              )}

              {/* Logs */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-amber-500 flex items-center gap-2"><FileText className="w-4 h-4"/> سجل الفيدباك</h4>
                <form onSubmit={handleAddLogNote} className="flex gap-2">
                  <input placeholder="اكتب ملاحظة أو فيدباك للعميل..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 px-4 py-2.5 rounded-xl text-sm text-slate-200 outline-none focus:border-amber-500" />
                  <button type="submit" className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition-colors">إضافة</button>
                </form>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {leadLogs.map(log => (
                    <div key={log.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 border-r-2 border-r-amber-500 text-sm">
                      <div className="text-xs text-slate-500 flex justify-between mb-1"><span>{log.user_email}</span> <span>{new Date(log.created_at).toLocaleString('ar-EG', {dateStyle: 'short', timeStyle: 'short'})}</span></div>
                      <div className="text-slate-300">{log.content}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* مودال إنشاء عميل جديد كمثال على النوافذ المنبثقة الأصغر */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-amber-500 mb-6">تسجيل عميل جديد</h3>
            <form onSubmit={handleCreateManualLead} className="space-y-4">
              <input type="text" placeholder="اسم العميل" required value={newLeadData.name} onChange={(e) => setNewLeadData({...newLeadData, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl text-sm text-slate-200 outline-none focus:border-amber-500" />
              <input type="text" placeholder="رقم الهاتف" required value={newLeadData.phone} onChange={(e) => setNewLeadData({...newLeadData, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl text-sm text-slate-200 outline-none focus:border-amber-500" />
              <select value={newLeadData.folder} onChange={(e) => setNewLeadData({...newLeadData, folder: e.target.value})} className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl text-sm text-slate-200 outline-none focus:border-amber-500">
                <option value="">إضافة إلى مجلد (اختياري)...</option>
                {folders.map((f, i) => <option key={i} value={f}>{f}</option>)}
              </select>
              {(userRole === 'admin' || userRole === 'marketing') && (
                <select value={newLeadData.assigned_to} onChange={(e) => setNewLeadData({...newLeadData, assigned_to: e.target.value})} className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl text-sm text-slate-200 outline-none focus:border-amber-500">
                  <option value="">إسناد العميل إلى... (اختياري)</option>
                  {teamMembers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
                </select>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-2.5 bg-amber-500 text-slate-900 rounded-xl text-sm font-bold hover:bg-amber-400 transition-colors">حفظ</button>
                <button type="button" onClick={() => setShowAddLeadModal(false)} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* (باقي النوافذ المنبثقة Project, Unit, Task, Campaign, Import... يمكنك تطبيق نفس هيكل كلاسات Tailwind عليها بسهولة باتباع نمط Modal العميل) */}

    </div>
  );
        }

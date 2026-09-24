import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import Sidebar from '../components/Sidebar';
import PipelineBoard from '../components/PipelineBoard';
import TeamController from '../components/TeamController';
import OperationsPanel from '../components/OperationsPanel';
import ReportsPanel from '../components/ReportsPanel';
import FollowupsPanel from '../components/FollowupsPanel';
import LeadCard from '../components/LeadCard';
import DailyBrief from '../components/DailyBrief';
import { normalizeRole, getLeadScope, canManageUsers, canManageTeam, canManageInventory, can, getRoleLabel, PERMISSIONS } from '../lib/permissions';
import { getCurrentIdentity } from '../lib/auth';
import { validateLeadInput, isDuplicateLead } from '../lib/leadValidation';

async function crmMutation(method, table, data, id = null) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return { data: null, error: new Error('انتهت الجلسة. سجل الدخول مرة أخرى.') };
  try {
    const response = await fetch('/api/crm/mutate', {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ table, data, id })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { data: null, error: new Error(result.error || 'فشلت العملية.') };
    return { data: result.data || null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

async function crmCancelPendingFollowups(leadId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return;
  const response = await fetch('/api/crm/followups/cancel-pending?lead_id=' + encodeURIComponent(leadId), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!response.ok) console.error('Failed to cancel pending followups');
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  
  const [leads, setLeads] = useState([]);
  const [leadLogs, setLeadLogs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [units, setUnits] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  
  // المجلدات والفلاتر الجديدة
  const [folders, setFolders] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [selectedFolderFilter, setSelectedFolderFilter] = useState('');
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);

  const viewToTab = {
    overview: 'overview',
    leads: 'list',
    reminders: 'reminders',
    projects: 'projects',
    tasks: 'tasks',
    campaigns: 'campaigns',
    pipeline: 'pipeline',
    leaderboard: 'leaderboard',
    operations: 'operations',
    reports: 'reports',
    audit: 'audit',
    team: 'team'
  };

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'overview';
    const view = window.location.hash.replace('#', '') || 'overview';
    return viewToTab[view] || 'overview';
  });
  
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importSkippedPreview, setImportSkippedPreview] = useState(0);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  
  const [selectedLead, setSelectedLead] = useState(null);

  const [newNote, setNewNote] = useState('');
  const [newUser, setNewUser] = useState({ full_name: '', email: '', password: '', role: 'sales' });
  
  const [newLeadData, setNewLeadData] = useState({ 
    name: '', phone: '', email: '', lead_source: 'Manual', assigned_to: '',
    budget: '', preferred_area: '', desired_unit_type: 'شقة', folder: ''
  });

  const [newProjectData, setNewProjectData] = useState({ name: '', location: '', description: '' });
  const [newUnitData, setNewUnitData] = useState({ project_id: '', unit_number: '', type: 'شقة', area: '', price: '', status: 'Available' });
  const [newTaskData, setNewTaskData] = useState({ title: '', lead_id: '', due_date: '', description: '' });
  const [newCampaignData, setNewCampaignData] = useState({ name: '', platform: '', budget: '', status: 'Active' });
  
  // حاسبة الأقساط
  const [calcData, setCalcData] = useState({
    unitPrice: '',
    downPaymentPercent: 10,
    deliveryPercent: 10,
    years: 5,
    installmentType: 'monthly'
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [followUpInput, setFollowUpInput] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(false);

  const handleSidebarNavigation = (view) => {
    setActiveTab(viewToTab[view] || 'list');
  };
  
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

  // دعم التنقل الأصلي عبر Hash: يعمل حتى على الموبايل بدون Reload.
  useEffect(() => {
    const syncHash = () => {
      if (typeof window === 'undefined') return;
      const view = window.location.hash.replace('#', '') || 'leads';
      setActiveTab(viewToTab[view] || 'list');
    };

    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    if (!audioEnabled) return;
    const interval = setInterval(() => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const hasDue = leads.some(l => l.status !== 'Archived' && l.next_follow_up && new Date(l.next_follow_up).toISOString().slice(0, 10) <= todayStr);
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
      if (ctx.state === 'suspended') ctx.resume();
      setAudioEnabled(true);
      playNotificationSound();
    } catch (e) {
      alert('الرجاء النقر مرة أخرى للسماح بالتشغيل.');
    }
  };

  const fetchData = async () => {
    try {
      const identity = await getCurrentIdentity();
      const { session, user, role, profile } = identity;
      if (!session || !user) { window.location.href = '/'; return; }
      
      setCurrentUser(user);

      const profileData = profile || {};
      setUserRole(role || null);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id,email,full_name,role,active,team_leader_id,manager_id,team_id')
        .order('email');
      if (profilesData) setTeamMembers(profilesData || []);

      const leadScope = getLeadScope(role);
      let leadsData = [];
      if (leadScope === 'all') {
        const result = await supabase.from('leads').select('*').order('created_at', { ascending: false });
        leadsData = result.data || [];
      } else if (leadScope === 'team') {
        const teamIds = (profilesData || [])
          .filter((p) => p.id === session.user.id || p.team_leader_id === session.user.id || (profileData?.team_id && p.team_id === profileData.team_id))
          .map((p) => p.id);
        const result = teamIds.length
          ? await supabase.from('leads').select('*').in('assigned_to', teamIds).order('created_at', { ascending: false })
          : await supabase.from('leads').select('*').eq('assigned_to', session.user.id).order('created_at', { ascending: false });
        leadsData = result.data || [];
      } else if (leadScope === 'own') {
        const result = await supabase.from('leads').select('*').eq('assigned_to', session.user.id).order('created_at', { ascending: false });
        leadsData = result.data || [];
      }
      setLeads(leadsData);

      const { data: projData } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (projData) setProjects(projData || []);

      const { data: unitData } = await supabase.from('units').select('*, projects(name)').order('created_at', { ascending: false });
      if (unitData) setUnits(unitData || []);

      const { data: taskData } = await supabase.from('tasks').select('*, leads(name)').order('created_at', { ascending: false });
      if (taskData) setTasks(taskData || []);

      const { data: campData } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
      if (campData) setCampaigns(campData || []);

      const { data: folderData } = await supabase.from('lead_folders').select('id,name,active').eq('active', true).order('name');
      if (folderData) setFolders(folderData.map((folder) => folder.name));

      const { data: followupData } = await supabase.from('followups').select('*, leads(name,phone)').order('followup_date', { ascending: true });
      if (followupData) setFollowups(followupData || []);

      if (canManageUsers(role)) {
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
    const validation = validateLeadInput(newLeadData);
    if (!validation.valid) {
      alert(Object.values(validation.errors).join('\n'));
      return;
    }

    try {
      const assignedTarget = canManageTeam(userRole) ? (newLeadData.assigned_to || null) : currentUser.id;
      const existingDuplicate = leads.find((l) => isDuplicateLead(l, newLeadData));
      if (existingDuplicate) {
        alert('العميل موجود بالفعل بنفس رقم الهاتف أو البريد الإلكتروني.');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('انتهت الجلسة. سجل الدخول مرة أخرى.');
        return;
      }

      const response = await fetch('/api/leads/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token
        },
        body: JSON.stringify({
          name: newLeadData.name,
          phone: newLeadData.phone,
          email: newLeadData.email || null,
          lead_source: newLeadData.lead_source,
          status: 'New Lead',
          assigned_to: assignedTarget,
          budget: newLeadData.budget ? parseFloat(newLeadData.budget) : null,
          preferred_area: newLeadData.preferred_area,
          desired_unit_type: newLeadData.desired_unit_type,
          folder: newLeadData.folder || null
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert('خطأ في الإضافة: ' + (result.error || 'تعذر إضافة العميل.'));
        return;
      }

      setShowAddLeadModal(false);
      setNewLeadData({ name: '', phone: '', email: '', lead_source: 'Manual', assigned_to: '', budget: '', preferred_area: '', desired_unit_type: 'شقة', folder: '' });
      fetchData();
    } catch (err) { alert('تعذر الاتصال بالخادم.'); }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectData.name) return;
    const { error } = await crmMutation('POST', 'projects', newProjectData);
    if (!error) { setShowProjectModal(false); setNewProjectData({ name: '', location: '', description: '' }); fetchData(); alert('تم إضافة المشروع'); }
  };

  const handleCreateUnit = async (e) => {
    e.preventDefault();
    if (!newUnitData.project_id || !newUnitData.unit_number) return;
    const { error } = await crmMutation('POST', 'units', newUnitData);
    if (!error) { setShowUnitModal(false); setNewUnitData({ project_id: '', unit_number: '', type: 'شقة', area: '', price: '', status: 'Available' }); fetchData(); alert('تم إضافة الوحدة'); }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskData.title) return;
    const { error } = await crmMutation('POST', 'tasks', { ...newTaskData, status: 'Pending', user_id: currentUser.id, created_by: currentUser.id });
    if (!error) { setShowTaskModal(false); setNewTaskData({ title: '', lead_id: '', due_date: '', description: '' }); fetchData(); }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!newCampaignData.name) return;
    const { error } = await crmMutation('POST', 'campaigns', newCampaignData);
    if (!error) { setShowCampaignModal(false); setNewCampaignData({ name: '', platform: '', budget: '', status: 'Active' }); fetchData(); alert('تم إضافة الحملة'); }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name || !can(userRole, PERMISSIONS.LEADS_CREATE)) return;
    if (folders.includes(name)) {
      setNewFolderName('');
      setShowCreateFolderModal(false);
      return;
    }

    const { error } = await crmMutation('POST', 'lead_folders', { name, created_by: currentUser.id, active: true });

    if (error) {
      alert('فشل إنشاء المجلد: ' + error.message);
      return;
    }

    setFolders((prev) => [...prev, name].sort());
    setNewFolderName('');
    setShowCreateFolderModal(false);
  };

  const handleMoveLeadToFolder = async (leadId, folderName) => {
    const { error } = await crmMutation('PATCH', 'leads', { folder: folderName || null }, leadId);
    if (!error) {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, folder: folderName } : l));
      if (selectedLead?.id === leadId) setSelectedLead(prev => ({ ...prev, folder: folderName }));
    }
  };

  const handleUpdateUnitStatus = async (unitId, newStatus) => {
    const { error } = await crmMutation('PATCH', 'units', { status: newStatus }, unitId);
    if (!error) fetchData();
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    const { error } = await crmMutation('PATCH', 'tasks', { status: newStatus }, taskId);
    if (!error) fetchData();
  };

  const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"') {
        if (quoted && next === '"') {
          cell += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (ch === ',' && !quoted) {
        row.push(cell.trim());
        cell = '';
      } else if ((ch === '\n' || ch === '\r') && !quoted) {
        if (ch === '\r' && next === '\n') i++;
        row.push(cell.trim());
        if (row.some((value) => value !== '')) rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += ch;
      }
    }

    if (cell !== '' || row.length) {
      row.push(cell.trim());
      if (row.some((value) => value !== '')) rows.push(row);
    }
    return rows;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rows = parseCsv(String(event.target.result || ''));
        if (rows.length < 2) {
          alert('الملف لا يحتوي على سجلات قابلة للاستيراد.');
          return;
        }

        const pending = [];
        let skipped = 0;

        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i];
          const lead = {
            name: cols[0] || '',
            phone: cols[1] || '',
            email: cols[2] || '',
            lead_source: cols[3] || 'Imported',
            status: 'New Lead',
            assigned_to: currentUser.id
          };

          const validation = validateLeadInput(lead);
          const duplicate =
            leads.some((existing) => isDuplicateLead(existing, lead)) ||
            pending.some((existing) => isDuplicateLead(existing, lead));

          if (!validation.valid || duplicate) {
            skipped++;
            continue;
          }

          pending.push(lead);
        }

        setImportPreview(pending);
        setImportSkippedPreview(skipped);
      } catch (err) {
        alert('حدث خطأ أثناء قراءة ملف CSV.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!importPreview.length || !currentUser?.id) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('انتهت الجلسة. سجل الدخول مرة أخرى.');
        return;
      }

      const response = await fetch('/api/leads/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token
        },
        body: JSON.stringify({ leads: importPreview })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert('فشل الاستيراد: ' + (result.error || 'تعذر استيراد العملاء.'));
        return;
      }

      const importedCount = Number(result.imported || 0);
      const skippedCount = Number(result.skipped || 0);

      alert(`تم استيراد ${importedCount} عميل بنجاح! وتم تخطي ${skippedCount} سجل غير صالح أو مكرر.`);
      setImportPreview([]);
      setImportSkippedPreview(0);
      setShowImportModal(false);
      fetchData();
    } catch (err) {
      alert('تعذر الاتصال بالخادم أثناء الاستيراد.');
    }
  };

  const handleUpdateLeadStatus = async (leadId, newStatus) => {
    if (!can(userRole, PERMISSIONS.LEADS_UPDATE)) return;
    const { error } = await crmMutation('PATCH', 'leads', { status: newStatus }, leadId);
    if (!error) {
      setLeads(prevLeads => prevLeads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      await crmMutation('POST', 'lead_logs', { lead_id: leadId, user_email: currentUser.email, action_type: 'Status Change', content: `تغيير حالة العميل: ${newStatus}` });
      if (selectedLead?.id === leadId) { setSelectedLead(prev => ({ ...prev, status: newStatus })); fetchLeadLogs(leadId); }
    }
  };

  const handleSaveLeadExtendedDetails = async (e) => {
    e.preventDefault();
    if (!selectedLead || !can(userRole, PERMISSIONS.LEADS_UPDATE)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('انتهت الجلسة. سجل الدخول مرة أخرى.');
        return;
      }

      const response = await fetch('/api/leads/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token
        },
        body: JSON.stringify({
          id: selectedLead.id,
          name: selectedLead.name,
          phone: selectedLead.phone,
          email: selectedLead.email,
          lead_source: selectedLead.lead_source,
          budget: selectedLead.budget,
          preferred_area: selectedLead.preferred_area,
          preferred_location: selectedLead.preferred_location,
          desired_unit_type: selectedLead.desired_unit_type,
          folder: selectedLead.folder
        })
      });

      const result = await response.json();
      if (!response.ok) {
        alert('فشل تحديث بيانات العميل: ' + (result.error || 'خطأ غير معروف'));
        return;
      }

      setLeads(prev => prev.map(lead => lead.id === selectedLead.id ? { ...lead, ...result.lead } : lead));
      setSelectedLead(prev => ({ ...prev, ...result.lead }));
      alert('تم تحديث بيانات العميل بنجاح');
      fetchLeadLogs(selectedLead.id);
      fetchData();
    } catch (err) {
      alert('تعذر الاتصال بالخادم: ' + err.message);
    }
  };

  const handleSaveFollowUp = async (leadId, dateValue) => {
    if (!can(userRole, PERMISSIONS.FOLLOWUPS_MANAGE)) return;

    const { error: leadError } = await crmMutation('PATCH', 'leads', { next_follow_up: dateValue || null }, leadId);

    if (leadError) {
      alert('فشل تحديث متابعة العميل: ' + leadError.message);
      return;
    }

    if (dateValue) {
      await crmMutation('POST', 'followups', { lead_id: leadId, assigned_to: currentUser.id, followup_date: new Date(dateValue).toISOString(), type: 'Call', status: 'Pending' });
    } else {
      await crmCancelPendingFollowups(leadId);
    }

    setLeads(prevLeads => prevLeads.map(l => l.id === leadId ? { ...l, next_follow_up: dateValue } : l));
    await crmMutation('POST', 'lead_logs', { lead_id: leadId, user_email: currentUser.email, action_type: 'Follow-up Set', content: `تم جدولة متابعة: ${dateValue ? new Date(dateValue).toLocaleString('ar-EG') : 'لا يوجد'}` });
    if (selectedLead?.id === leadId) {
      setSelectedLead(prev => ({ ...prev, next_follow_up: dateValue }));
      fetchLeadLogs(leadId);
    }
    const { data: updatedFollowups } = await supabase.from('followups').select('*, leads(name,phone)').order('followup_date', { ascending: true });
    setFollowups(updatedFollowups || []);
  };

  const handleAddLogNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedLead) return;
    const { error } = await crmMutation('POST', 'lead_logs', { lead_id: selectedLead.id, user_email: currentUser.email, action_type: 'Feedback/Note', content: newNote });
    if (!error) { setNewNote(''); fetchLeadLogs(selectedLead.id); }
  };

  const handleAssignLead = async (leadId, assigneeId) => {
    if (!canManageTeam(userRole)) return;
    const target = teamMembers.find(m => m.id === assigneeId);
    const { error } = await crmMutation('PATCH', 'leads', { assigned_to: assigneeId || null }, leadId);
    if (!error) {
      setLeads(prevLeads => prevLeads.map(l => l.id === leadId ? { ...l, assigned_to: assigneeId } : l));
      await crmMutation('POST', 'lead_logs', { lead_id: leadId, user_email: currentUser.email, action_type: 'Assign', content: `إسناد العميل إلى: ${target ? target.email : 'غير مخصص'}` });
      if (selectedLead) fetchLeadLogs(leadId);
    }
  };

  const handleLeadCardFolderOrAssignment = async (key, value) => {
    if (String(key).startsWith('__ASSIGN__:')) {
      const leadId = String(key).slice('__ASSIGN__:'.length);
      await handleAssignLead(leadId, value);
      return;
    }
    await handleMoveLeadToFolder(key, value);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('انتهت الجلسة. سجل الدخول مرة أخرى.');
        return;
      }

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token
        },
        body: JSON.stringify({
          full_name: newUser.full_name.trim(),
          email: newUser.email.trim(),
          password: newUser.password,
          role: newUser.role
        })
      });

      const result = await response.json();
      if (!response.ok) {
        alert('فشل إنشاء المستخدم: ' + (result.error || 'خطأ غير معروف'));
        return;
      }

      alert('تم إضافة الموظف بنجاح.');
      setShowUserModal(false);
      setNewUser({ full_name: '', email: '', password: '', role: 'sales' });
      fetchData();
    } catch (err) {
      alert('خطأ اتصال: ' + err.message);
    }
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
    if (!selectedLead || !calcData.unitPrice || !can(userRole, PERMISSIONS.LEADS_UPDATE)) return;
    const price = parseFloat(calcData.unitPrice);
    const down = price * (calcData.downPaymentPercent / 100);
    const delivery = price * (calcData.deliveryPercent / 100);
    const remainder = price - (down + delivery);
    const multiplier = calcData.installmentType === 'monthly' ? 12 : (calcData.installmentType === 'quarterly' ? 4 : 1);
    const totalInstalls = calcData.years * multiplier;
    const installValue = remainder / totalInstalls;

    const planDetails = `خطة دفع مقترحة: السعر: ${price.toLocaleString()} | المقدم: ${down.toLocaleString()} | الاستلام: ${delivery.toLocaleString()} | القسط (${calcData.installmentType}): ${installValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} لمدة ${calcData.years} سنوات.`;

    const { error } = await crmMutation('POST', 'lead_logs', { lead_id: selectedLead.id, user_email: currentUser.email, action_type: 'Financial Plan', content: planDetails });
    if (!error) { alert('تم حفظ الخطة المالية في ملف العميل'); fetchLeadLogs(selectedLead.id); }
  };

  const handleArchiveLead = async (lead = selectedLead) => {
    if (!lead || !can(userRole, PERMISSIONS.LEADS_DELETE)) return;
    const confirmed = window.confirm('هل تريد أرشفة العميل "' + (lead.name || 'بدون اسم') + '"؟ سيختفي من القائمة الحالية ويمكن الاحتفاظ به في قاعدة البيانات.');
    if (!confirmed) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('انتهت الجلسة. سجل الدخول مرة أخرى.');
        return;
      }

      const response = await fetch('/api/records/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token
        },
        body: JSON.stringify({ table: 'leads', id: lead.id, mode: 'archive' })
      });

      const result = await response.json();
      if (!response.ok) {
        alert('فشل أرشفة العميل: ' + (result.error || 'خطأ غير معروف'));
        return;
      }

      await crmCancelPendingFollowups(lead.id);
      setLeads(prev => prev.map(item => item.id === lead.id ? { ...item, status: 'Archived', next_follow_up: null } : item));
      setSelectedLead(prev => prev?.id === lead.id ? null : prev);
      alert('تمت أرشفة العميل بنجاح');
      fetchData();
    } catch (err) {
      alert('تعذر الاتصال بالخادم: ' + err.message);
    }
  };

  // تصفية العملاء
  const filteredLeads = leads.filter(l => {
    const matchesSearch = (l.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.phone || '').includes(searchQuery);
    const matchesFolder = selectedFolderFilter ? l.folder === selectedFolderFilter : true;
    
    // فلترة الماركتنج حسب الحملة/المشروع وإمكانية الرؤية
    let matchesCampaignOrProject = true;
    if (selectedCampaignFilter) {
      matchesCampaignOrProject = (l.campaign_id === selectedCampaignFilter || l.lead_source === selectedCampaignFilter || l.preferred_area === selectedCampaignFilter);
    } else if (userRole === 'marketing') {
      // إذا لم يجهز للماركتنج فلتر، يرى فقط العملاء المرتبطين بحملاته أو مصادره
      matchesCampaignOrProject = l.lead_source === 'Marketing' || l.assigned_to === currentUser.id;
    }

    return l.status !== 'Archived' && matchesSearch && matchesFolder && matchesCampaignOrProject;
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const dueFollowUps = followups.filter((f) => f.status === 'Pending' && f.followup_date && new Date(f.followup_date).toISOString().slice(0, 10) <= todayStr);

  const activeLeads = leads.filter(l => l.status !== 'Archived');
  const totalLeadsCount = activeLeads.length;
  const interestedCount = activeLeads.filter(l => l.status === 'Interested').length;
  const closedWonCount = activeLeads.filter(l => l.status === 'Closed Won').length;
  const conversionRate = totalLeadsCount > 0 ? ((closedWonCount / totalLeadsCount) * 100).toFixed(1) : 0;
  const totalDealsValue = activeLeads.filter(l => l.status === 'Closed Won' && l.budget).reduce((acc, curr) => acc + Number(curr.budget), 0);

  const visibleViews = [
    ['overview', PERMISSIONS.DASHBOARD_VIEW],
    ['leads', PERMISSIONS.LEADS_VIEW],
    ['pipeline', PERMISSIONS.PIPELINE_VIEW],
    ['reminders', PERMISSIONS.FOLLOWUPS_VIEW],
    ['projects', PERMISSIONS.PROJECTS_VIEW],
    ['tasks', PERMISSIONS.TASKS_VIEW],
    ['campaigns', PERMISSIONS.CAMPAIGNS_VIEW],
    ['operations', PERMISSIONS.DEALS_VIEW],
    ['reports', PERMISSIONS.REPORTS_VIEW],
    ['leaderboard', PERMISSIONS.REPORTS_VIEW],
    ['audit', PERMISSIONS.AUDIT_VIEW],
    ['team', PERMISSIONS.TEAMS_VIEW]
  ].filter(([, permission]) => can(userRole, permission)).map(([view]) => view);

  if (loading) return <div style={{ color: '#b08a4a', textAlign: 'center', padding: '5rem', backgroundColor: '#f5efe3', minHeight: '100vh' }}>جاري التحميل...</div>;

  return (
    <div className="arcova-dashboard-shell" style={{ minHeight: '100vh', backgroundColor: '#f5efe3', color: '#3f321f', fontFamily: 'sans-serif', direction: 'rtl' }}>
      <Sidebar activeView={activeTab === "list" ? "leads" : activeTab} onNavigate={handleSidebarNavigation} visibleViews={visibleViews} />
      <div className="arcova-dashboard-content" style={{ flex: 1, minWidth: 0, minHeight: '100vh' }}>
        <style jsx>{`
          .arcova-mobile-leads { display: none; }
          .arcova-desktop-leads { display: block; }
          @media (max-width: 768px) {
            .arcova-mobile-leads { display: grid; gap: 12px; }
            .arcova-desktop-leads { display: none !important; }
            .arcova-dashboard-content main { padding: 0.85rem !important; }
          }

          .arcova-dashboard-shell { display: flex; flex-direction: row; width: 100%; }
          .arcova-dashboard-content { width: 100%; }
          @media (max-width: 768px) {
            .arcova-dashboard-shell { display: block !important; width: 100%; overflow-x: hidden; }
            .arcova-dashboard-content { display: block; width: 100%; min-width: 0; }
          }
        `}</style>

      {/* --- شريط الهيدر المودرن (Modern Navbar) --- */}
      <header style={{ 
        backgroundColor: '#fffaf0', 
        padding: '0.8rem 2rem', 
        display: 'flex', 
        justify: 'space-between', 
        alignItems: 'center', 
        borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
        position: 'relative'
      }}>
        {/* اللوجو ARCOVA في كارت زجاجي Glassmorphic مع إضاءة خلفية دائرية */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <div style={{
            position: 'absolute',
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212,175,55,0.25) 0%, rgba(0,0,0,0) 70%)',
            top: '-30px',
            left: '-20px',
            pointerEvents: 'none'
          }} />
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(212, 175, 55, 0.4)',
            padding: '0.4rem 1.2rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.8rem',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
          }}>
            <h1 style={{ margin: 0, color: '#b08a4a', fontSize: '1.3rem', fontFamily: 'serif', letterSpacing: '1px' }}>ARCOVA</h1>
            <span style={{ fontSize: '0.75rem', color: '#806f56', borderRight: '1px solid #d9c5a4', paddingRight: '0.8rem' }}>CRM System</span>
          </div>
        </div>

        {/* تجميع زر الصوت، بريد المستخدم، وشارة الدور بطريقة متناسقة */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(19, 24, 34, 0.8)', padding: '0.4rem 0.8rem', borderRadius: '30px', border: '1px solid #d9c5a4' }}>
          <button onClick={enableAudioAndTest} style={{ padding: '0.4rem 0.8rem', backgroundColor: audioEnabled ? '#065f46' : '#991b1b', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            {audioEnabled ? '🔔 التنبيه مفعّل' : '🔕 تفعيل الصوت'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRight: '1px solid #d9c5a4', paddingRight: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#e5e7eb', fontWeight: '500' }}>{currentUser?.email}</span>
            <span style={{ 
              backgroundColor: userRole === 'admin' ? '#991b1b' : userRole === 'ceo' ? '#7c3aed' : userRole === 'finance' ? '#047857' : userRole === 'manager' ? '#0369a1' : userRole === 'team_leader' ? '#0f766e' : userRole === 'marketing' ? '#9333ea' : '#075985', 
              color: '#fff', 
              padding: '0.15rem 0.6rem', 
              borderRadius: '12px', 
              fontSize: '0.7rem',
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              {getRoleLabel(userRole)}
            </span>
          </div>

          {canManageUsers(userRole) && (
            <button onClick={() => setShowUserModal(true)} style={{ padding: '0.3rem 0.7rem', backgroundColor: 'transparent', color: '#b08a4a', border: '1px solid #b08a4a', borderRadius: '15px', cursor: 'pointer', fontSize: '0.75rem' }}>+ موظف</button>
          )}
          <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')} style={{ padding: '0.3rem 0.7rem', backgroundColor: '#d9c5a4', color: '#3f321f', border: 'none', borderRadius: '15px', cursor: 'pointer', fontSize: '0.75rem' }}>خروج</button>
        </div>
      </header>

      <main style={{ padding: '1.5rem' }}>
        {activeTab === 'overview' && (
        <>
          <DailyBrief
            leads={activeLeads}
            followups={followups}
            tasks={tasks}
            onLeadOpen={(leadId) => {
              const target = leads.find((lead) => lead.id === leadId);
              if (target) handleOpenLeadDetails(target);
            }}
            onOpenReminders={() => setActiveTab('reminders')}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ backgroundColor: '#fffaf0', border: '1px solid #d9c5a4', borderRight: '4px solid #b08a4a', padding: '1rem', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.75rem', color: '#806f56' }}>إجمالي العملاء</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#b08a4a', marginTop: '0.3rem' }}>{totalLeadsCount}</div>
          </div>
          <div style={{ backgroundColor: '#fffaf0', border: '1px solid #d9c5a4', borderRight: '4px solid #f59e0b', padding: '1rem', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.75rem', color: '#806f56' }}>مهتم جداً</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#f59e0b', marginTop: '0.3rem' }}>{interestedCount}</div>
          </div>
          <div style={{ backgroundColor: '#fffaf0', border: '1px solid #d9c5a4', borderRight: '4px solid #34d399', padding: '1rem', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.75rem', color: '#806f56' }}>تم التعاقد (Won)</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#34d399', marginTop: '0.3rem' }}>{closedWonCount}</div>
          </div>
          <div style={{ backgroundColor: '#fffaf0', border: '1px solid #d9c5a4', borderRight: '4px solid #60a5fa', padding: '1rem', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.75rem', color: '#806f56' }}>نسبة التحويل</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#60a5fa', marginTop: '0.3rem' }}>{conversionRate}%</div>
          </div>
          <div style={{ backgroundColor: '#fffaf0', border: '1px solid #d9c5a4', borderRight: '4px solid #a855f7', padding: '1rem', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.75rem', color: '#806f56' }}>إجمالي الصفقات</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#a855f7', marginTop: '0.3rem' }}>{totalDealsValue.toLocaleString()} ج</div>
          </div>
          </div>
        </>
        )}

        {activeTab === 'pipeline' && can(userRole, PERMISSIONS.PIPELINE_VIEW) && (
          <PipelineBoard leads={filteredLeads} statusOptions={statusOptions} onStatusChange={handleUpdateLeadStatus} onOpenLead={handleOpenLeadDetails} />
        )}

        {activeTab === 'operations' && can(userRole, PERMISSIONS.DEALS_VIEW) && (
          <OperationsPanel currentUser={currentUser} userRole={userRole} leads={leads} units={units} />
        )}

        {activeTab === 'reports' && can(userRole, PERMISSIONS.REPORTS_VIEW) && (
          <ReportsPanel leads={leads} tasks={tasks} userRole={userRole} />
        )}

        {activeTab === 'list' && (
          <div>
            {/* --- شريط أدوات الإجراءات (Modern Toolbar) --- */}
            <div style={{ 
              backgroundColor: '#fffaf0', 
              padding: '0.8rem 1rem', 
              borderRadius: '8px', 
              border: '1px solid #d9c5a4',
              display: 'flex', 
              alignItems: 'center', 
              justify: 'space-between', 
              flexWrap: 'wrap', 
              gap: '0.8rem',
              marginBottom: '1rem' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap', flex: 1 }}>
                {/* تصفية حسب المجلد */}
                <select 
                  value={selectedFolderFilter} 
                  onChange={(e) => setSelectedFolderFilter(e.target.value)}
                  style={{ padding: '0.5rem', backgroundColor: '#f5efe3', border: '1px solid #d9c5a4', color: '#b08a4a', borderRadius: '6px', fontSize: '0.85rem' }}
                >
                  <option value="">📁 كل المجلدات</option>
                  {folders.map((f, idx) => (
                    <option key={idx} value={f}>📂 {f}</option>
                  ))}
                </select>

                {/* زر إنشاء مجلد جديد */}
                {can(userRole, PERMISSIONS.LEADS_CREATE) && (
                  <button
                    type="button"
                    onClick={() => setShowCreateFolderModal(true)}
                    style={{ padding: '0.5rem 0.8rem', backgroundColor: '#d9c5a4', color: '#b08a4a', border: '1px solid #b08a4a', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    + مجلد جديد
                  </button>
                )}

                {/* فلتر حملة الماركتنج والمشروع */}
                <select 
                  value={selectedCampaignFilter} 
                  onChange={(e) => setSelectedCampaignFilter(e.target.value)}
                  style={{ padding: '0.5rem', backgroundColor: '#f5efe3', border: '1px solid #d9c5a4', color: '#9333ea', borderRadius: '6px', fontSize: '0.85rem' }}
                >
                  <option value="">🎯 كل الحملات والمشاريع</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.name}>📢 {c.name}</option>
                  ))}
                  {projects.map(p => (
                    <option key={p.id} value={p.name}>🏢 {p.name}</option>
                  ))}
                </select>

                {/* شريط البحث */}
                <input 
                  type="text" 
                  placeholder="🔍 بحث باسم العميل أو الهاتف..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  style={{ flex: 1, minWidth: '200px', padding: '0.5rem 0.8rem', backgroundColor: '#f5efe3', border: '1px solid #d9c5a4', color: '#fff', borderRadius: '6px', fontSize: '0.85rem' }} 
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button onClick={() => setShowAddLeadModal(true)} style={{ padding: '0.5rem 1rem', backgroundColor: '#b08a4a', color: '#f5efe3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                  + تسجيل عميل
                </button>

                {can(userRole, PERMISSIONS.LEADS_IMPORT) && (
                  <button onClick={() => setShowImportModal(true)} style={{ padding: '0.5rem 0.8rem', backgroundColor: '#d9c5a4', color: '#34d399', border: '1px solid #34d399', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>📥 استيراد</button>
                )}
                {can(userRole, PERMISSIONS.LEADS_EXPORT) && (
                  <button onClick={handleExportToExcel} style={{ padding: '0.5rem 0.8rem', backgroundColor: '#d9c5a4', color: '#b08a4a', border: '1px solid #b08a4a', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>📤 تصدير</button>
                )}
              </div>
            </div>

            <div className="arcova-mobile-leads">
              {filteredLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  userRole={userRole}
                  folders={folders}
                  teamMembers={teamMembers}
                  canUpdate={can(userRole, PERMISSIONS.LEADS_UPDATE)}
                  canDelete={can(userRole, PERMISSIONS.LEADS_DELETE)}
                  canAssign={canManageTeam(userRole)}
                  statusOptions={statusOptions}
                  onOpen={handleOpenLeadDetails}
                  onStatusChange={handleUpdateLeadStatus}
                  onFolderChange={handleLeadCardFolderOrAssignment}
                  onArchive={handleArchiveLead}
                />
              ))}
              {!filteredLeads.length && (
                <div style={{ background:'#fffaf0', border:'1px solid #d9c5a4', borderRadius:14, padding:20, textAlign:'center', color:'#806f56' }}>
                  لا توجد عملاء مطابقون للفلاتر الحالية.
                </div>
              )}
            </div>

            <div className="arcova-desktop-leads" style={{ backgroundColor: '#fffaf0', borderRadius: '6px', overflowX: 'auto', border: '1px solid #d9c5a4' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5efe3', color: '#b08a4a', borderBottom: '1px solid #d9c5a4' }}>
                    <th style={{ padding: '0.8rem' }}>العميل والهاتف</th>
                    <th style={{ padding: '0.8rem' }}>المصدر / المجلد</th>
                    <th style={{ padding: '0.8rem' }}>الميزانية والمنطقة</th>
                    <th style={{ padding: '0.8rem' }}>الحالة</th>
                    <th style={{ padding: '0.8rem' }}>الموعد القادم</th>
                    <th style={{ padding: '0.8rem' }}>المسؤول</th>
                    <th style={{ padding: '0.8rem' }}>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: '1px solid #d9c5a4' }}>
                      <td style={{ padding: '0.8rem' }}>
                        <div style={{ fontWeight: 'bold', color: '#3f321f' }}>{lead.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#806f56' }}>
                          {/* التشفير لأرقام الهواتف لحماية الخصوصية ما عدا الأدمن */}
                          {userRole === 'admin' ? lead.phone : `******${(lead.phone || '').slice(-4)}`}
                        </div>
                      </td>
                      <td style={{ padding: '0.8rem', color: '#806f56' }}>
                        <div>{lead.lead_source}</div>
                        {lead.folder && (
                          <span style={{ backgroundColor: '#d9c5a4', color: '#b08a4a', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', marginTop: '0.2rem', display: 'inline-block' }}>
                            📁 {lead.folder}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.8rem', color: '#806f56', fontSize: '0.8rem' }}>
                        <div>{lead.budget ? `${Number(lead.budget).toLocaleString()} ج.م` : 'غير محدد'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#b08a4a' }}>{lead.preferred_area || ''} ({lead.desired_unit_type || ''})</div>
                      </td>
                      <td style={{ padding: '0.8rem' }}>
                        {/* الماركتنج ممنوع من تغيير حالة العميل */}
                        <select disabled={!can(userRole, PERMISSIONS.LEADS_UPDATE)} value={lead.status || 'New Lead'} onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)} style={{ padding: '0.3rem', backgroundColor: '#f5efe3', color: '#b08a4a', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.8rem', opacity: userRole === 'marketing' ? 0.7 : 1 }}>
                          {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '0.8rem', color: lead.next_follow_up ? '#34d399' : '#806f56', fontSize: '0.8rem' }}>
                        {lead.next_follow_up ? new Date(lead.next_follow_up).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : 'غير محدد'}
                      </td>
                      <td style={{ padding: '0.8rem' }}>
                        {canManageTeam(userRole) ? (
                          <select value={lead.assigned_to || ''} onChange={(e) => handleAssignLead(lead.id, e.target.value)} style={{ padding: '0.3rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.8rem' }}>
                            <option value="">غير مخصص</option>
                            {teamMembers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
                          </select>
                        ) : userRole === 'marketing' ? (
                          <span style={{ color: '#806f56', fontSize: '0.8rem' }}>{teamMembers.find(m => m.id === lead.assigned_to)?.email || 'غير مخصص'}</span>
                        ) : (
                          <span style={{ color: '#34d399', fontSize: '0.8rem' }}>مخصص لك</span>
                        )}
                      </td>
                      <td style={{ padding: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button onClick={() => handleOpenLeadDetails(lead)} title="تفاصيل وفيدباك" style={{ padding: '0.3rem 0.6rem', backgroundColor: '#b08a4a', color: '#f5efe3', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>التفاصيل</button>
                        {can(userRole, PERMISSIONS.LEADS_DELETE) && (
                          <button type="button" onClick={() => handleArchiveLead(lead)} title="أرشفة العميل" style={{ padding: '0.3rem 0.55rem', backgroundColor: '#fff7f2', color: '#a7352b', border: '1px solid #d9a07a', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}>🗑️</button>
                        )}
                        <a href={`/customer360?lead_id=${encodeURIComponent(lead.id)}`} title="Customer 360" style={{ padding: '0.3rem 0.55rem', backgroundColor: '#f5efe3', color: '#765522', border: '1px solid #d9c5a4', borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.75rem' }}>360°</a>

                        {/* خيار نقل العميل إلى مجلد */}
                        <select 
                          value={lead.folder || ''} 
                          onChange={(e) => handleMoveLeadToFolder(lead.id, e.target.value)}
                          style={{ padding: '0.25rem', backgroundColor: '#f5efe3', color: '#806f56', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.7rem' }}
                        >
                          <option value="">نقل لمجلد...</option>
                          {folders.map((f, i) => <option key={i} value={f}>{f}</option>)}
                        </select>

                        {/* الاتصال المباشر والواتساب للمبيعات والأدمن */}
                        {can(userRole, PERMISSIONS.LEADS_UPDATE) && (
                          <>
                            <a href={`tel:${lead.phone}`} title="اتصال" style={{ padding: '0.3rem 0.5rem', backgroundColor: '#065f46', color: '#fff', borderRadius: '4px', textDecoration: 'none', fontSize: '0.75rem' }}>📞</a>
                            <a href={`https://wa.me/${(lead.phone || '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" title="واتساب" style={{ padding: '0.3rem 0.5rem', backgroundColor: '#166534', color: '#fff', borderRadius: '4px', textDecoration: 'none', fontSize: '0.75rem' }}>🟢</a>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reminders' && can(userRole, PERMISSIONS.FOLLOWUPS_VIEW) && (
          <FollowupsPanel currentUser={currentUser} userRole={userRole} leads={leads} />
        )}

        {activeTab === 'tasks' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#b08a4a', fontFamily: 'serif', fontSize: '1.1rem', margin: 0 }}>إدارة المهام والأنشطة</h3>
              <button onClick={() => setShowTaskModal(true)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#b08a4a', color: '#f5efe3', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>+ إضافة مهمة جديدة</button>
            </div>
            <div style={{ backgroundColor: '#fffaf0', borderRadius: '6px', overflowX: 'auto', border: '1px solid #d9c5a4' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5efe3', color: '#b08a4a', borderBottom: '1px solid #d9c5a4' }}>
                    <th style={{ padding: '0.8rem' }}>عنوان المهمة</th>
                    <th style={{ padding: '0.8rem' }}>العميل المرتبط</th>
                    <th style={{ padding: '0.8rem' }}>تاريخ الاستحقاق</th>
                    <th style={{ padding: '0.8rem' }}>التفاصيل</th>
                    <th style={{ padding: '0.8rem' }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(task => (
                    <tr key={task.id} style={{ borderBottom: '1px solid #d9c5a4' }}>
                      <td style={{ padding: '0.8rem', fontWeight: 'bold', color: '#fff' }}>{task.title}</td>
                      <td style={{ padding: '0.8rem', color: '#34d399' }}>{task.leads?.name || 'عامة'}</td>
                      <td style={{ padding: '0.8rem', color: '#f87171' }}>{task.due_date ? new Date(task.due_date).toLocaleString('ar-EG') : 'غير محدد'}</td>
                      <td style={{ padding: '0.8rem', color: '#806f56' }}>{task.description || '-'}</td>
                      <td style={{ padding: '0.8rem' }}>
                        <select value={task.status || 'Pending'} onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)} style={{ padding: '0.3rem', backgroundColor: '#f5efe3', color: task.status === 'Completed' ? '#34d399' : '#b08a4a', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.8rem' }}>
                          <option value="Pending">⏳ قيد التنفيذ</option>
                          <option value="Completed">✅ مكتملة</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#b08a4a', fontFamily: 'serif', fontSize: '1.1rem', margin: 0 }}>المشاريع والوحدات</h3>
              {canManageTeam(userRole) && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setShowProjectModal(true)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#d9c5a4', color: '#b08a4a', border: '1px solid #b08a4a', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>+ إضافة مشروع</button>
                  <button onClick={() => setShowUnitModal(true)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#b08a4a', color: '#f5efe3', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>+ إضافة وحدة</button>
                </div>
              )}
            </div>
            <div style={{ backgroundColor: '#fffaf0', borderRadius: '6px', overflowX: 'auto', border: '1px solid #d9c5a4' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5efe3', color: '#b08a4a', borderBottom: '1px solid #d9c5a4' }}>
                    <th style={{ padding: '0.8rem' }}>المشروع</th>
                    <th style={{ padding: '0.8rem' }}>رقم الوحدة / النوع</th>
                    <th style={{ padding: '0.8rem' }}>المساحة</th>
                    <th style={{ padding: '0.8rem' }}>السعر</th>
                    <th style={{ padding: '0.8rem' }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map(unit => (
                    <tr key={unit.id} style={{ borderBottom: '1px solid #d9c5a4' }}>
                      <td style={{ padding: '0.8rem', color: '#fff', fontWeight: 'bold' }}>{unit.projects?.name || '-'}</td>
                      <td style={{ padding: '0.8rem', color: '#806f56' }}>{unit.unit_number} ({unit.type})</td>
                      <td style={{ padding: '0.8rem', color: '#806f56' }}>{unit.area ? `${unit.area} م²` : '-'}</td>
                      <td style={{ padding: '0.8rem', color: '#34d399' }}>{unit.price ? `${Number(unit.price).toLocaleString()} ج.م` : '-'}</td>
                      <td style={{ padding: '0.8rem' }}>
                        <select value={unit.status || 'Available'} onChange={(e) => handleUpdateUnitStatus(unit.id, e.target.value)} disabled={!canManageInventory(userRole)} style={{ padding: '0.3rem', backgroundColor: '#f5efe3', color: unit.status === 'Sold' ? '#f87171' : '#34d399', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.8rem' }}>
                          <option value="Available">متاحة</option>
                          <option value="Reserved">محجوزة</option>
                          <option value="Sold">مباعة</option>
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
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#b08a4a', fontFamily: 'serif', fontSize: '1.1rem', margin: 0 }}>إدارة الحملات التسويقية</h3>
              {can(userRole, PERMISSIONS.PROJECTS_MANAGE) && (
                <button onClick={() => setShowCampaignModal(true)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#b08a4a', color: '#f5efe3', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>+ إضافة حملة</button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {campaigns.map(camp => (
                <div key={camp.id} style={{ backgroundColor: '#fffaf0', padding: '1rem', borderRadius: '6px', border: '1px solid #d9c5a4', borderRight: '4px solid #b08a4a' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#fff' }}>{camp.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#b08a4a', margin: '0.3rem 0' }}> المنصة: {camp.platform || 'غير محددة'}</div>
                  <div style={{ fontSize: '0.8rem', color: '#34d399' }}> الميزانية: {camp.budget ? `${Number(camp.budget).toLocaleString()} ج.م` : 'غير محددة'}</div>
                  <div style={{ fontSize: '0.75rem', color: '#806f56', marginTop: '0.5rem' }}>الحالة: {camp.status}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && can(userRole, PERMISSIONS.REPORTS_VIEW) && (
          <div style={{ backgroundColor: '#fffaf0', padding: '1.2rem', borderRadius: '6px', border: '1px solid #d9c5a4' }}>
            <h3 style={{ color: '#b08a4a', fontFamily: 'serif', fontSize: '1rem', marginBottom: '1rem' }}>🏆 أداء المبيعات (Leaderboard)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {teamMembers.map(member => {
                const memberLeads = leads.filter(l => l.assigned_to === member.id);
                const wonLeads = memberLeads.filter(l => l.status === 'Closed Won');
                const rate = memberLeads.length > 0 ? Math.round((wonLeads.length / memberLeads.length) * 100) : 0;
                return (
                  <div key={member.id} style={{ backgroundColor: '#f5efe3', padding: '0.8rem', borderRadius: '4px', border: '1px solid #d9c5a4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>{member.email}</div>
                      <div style={{ color: '#806f56', fontSize: '0.75rem', marginTop: '0.2rem' }}>إجمالي العملاء المستلمين: {memberLeads.length}</div>
                         </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ color: '#34d399', fontWeight: 'bold', fontSize: '0.9rem' }}>تم البيع: {wonLeads.length}</div>
                      <div style={{ color: '#60a5fa', fontSize: '0.75rem' }}>نسبة النجاح: {rate}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'audit' && can(userRole, PERMISSIONS.AUDIT_VIEW) && (
          <div style={{ backgroundColor: '#fffaf0', padding: '1.2rem', borderRadius: '6px', border: '1px solid #d9c5a4' }}>
            <h3 style={{ color: '#b08a4a', fontFamily: 'serif', fontSize: '1rem', marginBottom: '1rem' }}>🛡️ سجل التدقيق والأنشطة (Audit Logs)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {auditLogs.map(log => (
                <div key={log.id} style={{ backgroundColor: '#f5efe3', padding: '0.8rem', borderRadius: '4px', borderRight: '3px solid #991b1b', border: '1px solid #d9c5a4', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#806f56', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                    <span>{log.user_email || 'مستخدم النظام'}</span>
                    <span>{new Date(log.created_at).toLocaleString('ar-EG')}</span>
                  </div>
                  <div style={{ color: '#3f321f' }}>{log.action || log.details || 'نشاط على النظام'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'team' && can(userRole, PERMISSIONS.TEAMS_VIEW) && (
          <TeamController userRole={userRole} onSaved={fetchData} />
        )}
      </main>

      {/* --- جميع النوافذ المنبثقة (Modals) --- */}

      {/* مودال إنشاء مجلد جديد */}
      {showCreateFolderModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#fffaf0', padding: '1.5rem', borderRadius: '6px', width: '320px', border: '1px solid #b08a4a' }}>
            <h3 style={{ color: '#b08a4a', fontFamily: 'serif', marginTop: 0, fontSize: '1rem' }}>إنشاء مجلد جديد</h3>
            <form onSubmit={handleCreateFolder} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.8rem' }}>
              <input type="text" placeholder="اسم المجلد (مثل: عملاء التجمع)" required value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }} />
              <button type="submit" style={{ padding: '0.6rem', backgroundColor: '#b08a4a', color: '#f5efe3', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>إنشاء</button>
              <button type="button" onClick={() => setShowCreateFolderModal(false)} style={{ padding: '0.5rem', backgroundColor: '#d9c5a4', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.85rem' }}>إلغاء</button>
            </form>
          </div>
        </div>
      )}

      {/* مودال إضافة مستخدم جديد */}
      {showUserModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#fffaf0', padding: '1.5rem', borderRadius: '6px', width: '320px', border: '1px solid #b08a4a' }}>
            <h3 style={{ color: '#b08a4a', fontFamily: 'serif', marginTop: 0, fontSize: '1rem' }}>إضافة موظف</h3>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.8rem' }}>
              <input type="text" placeholder="اسم الموظف" required value={newUser.full_name} onChange={(e) => setNewUser({...newUser, full_name: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '8px', fontSize: '0.85rem' }} />
              <input type="email" placeholder="البريد الإلكتروني" required value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }} />
              <input type="password" placeholder="كلمة المرور" required value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }} />
              <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#b08a4a', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }}>
                <option value="sales">Sales (مبيعات)</option>
                <option value="team_leader">Team Leader (قائد فريق)</option>
                <option value="manager">Manager (مدير المبيعات)</option>
                <option value="finance">Finance (المالية)</option>
                <option value="marketing">Marketing (تسويق)</option>
                <option value="ceo">CEO (الرئيس التنفيذي)</option>
                <option value="admin">Admin (مدير النظام)</option>
              </select>
              <button type="submit" style={{ padding: '0.6rem', backgroundColor: '#b08a4a', color: '#f5efe3', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>حفظ</button>
              <button type="button" onClick={() => setShowUserModal(false)} style={{ padding: '0.5rem', backgroundColor: '#d9c5a4', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.85rem' }}>إلغاء</button>
            </form>
          </div>
        </div>
      )}

      {/* مودال تفاصيل العميل وحاسبة الأقساط */}
      {selectedLead && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#fffaf0', padding: '1.5rem', borderRadius: '6px', width: '480px', maxHeight: '85vh', overflowY: 'auto', border: '1px solid #b08a4a' }}>
            <h3 style={{ color: '#b08a4a', fontFamily: 'serif', marginTop: 0, fontSize: '1rem' }}>{selectedLead.name}</h3>
            <p style={{ color: '#806f56', margin: '0.3rem 0', fontSize: '0.8rem' }}>
              {userRole === 'admin' ? selectedLead.phone : `******${(selectedLead.phone || '').slice(-4)}`} | {selectedLead.email || 'بدون إيميل'}
            </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                {can(userRole, PERMISSIONS.LEADS_DELETE) && (
                  <button type="button" onClick={handleArchiveLead} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#b45309', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }} title="حذف العميل من القائمة مع الاحتفاظ به في الأرشيف">🗑️ حذف العميل</button><a href={`/customer360?lead_id=${encodeURIComponent(selectedLead.id)}`} style={{ padding:'0.4rem 0.8rem', backgroundColor:'#f5efe3', color:'#765522', border:'1px solid #d9c5a4', borderRadius:'4px', textDecoration:'none', fontSize:'0.8rem', fontWeight:'bold' }}>360° الملف الكامل</a>
                )}
              </div>
            
            <form onSubmit={handleSaveLeadExtendedDetails} style={{ backgroundColor: '#f5efe3', padding: '0.8rem', borderRadius: '4px', margin: '0.8rem 0', border: '1px solid #d9c5a4', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#b08a4a', fontWeight: 'bold' }}>بيانات الاهتمام العقاري:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <input type="number" disabled={!can(userRole, PERMISSIONS.LEADS_UPDATE)} placeholder="الميزانية" value={selectedLead.budget || ''} onChange={(e) => setSelectedLead({...selectedLead, budget: e.target.value})} style={{ padding: '0.4rem', backgroundColor: '#fffaf0', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.8rem' }} />
                <input type="text" disabled={!can(userRole, PERMISSIONS.LEADS_UPDATE)} placeholder="المنطقة المفضلة" value={selectedLead.preferred_area || ''} onChange={(e) => setSelectedLead({...selectedLead, preferred_area: e.target.value})} style={{ padding: '0.4rem', backgroundColor: '#fffaf0', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.8rem' }} />
              </div>
              <select disabled={!can(userRole, PERMISSIONS.LEADS_UPDATE)} value={selectedLead.desired_unit_type || 'شقة'} onChange={(e) => setSelectedLead({...selectedLead, desired_unit_type: e.target.value})} style={{ padding: '0.4rem', backgroundColor: '#fffaf0', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.8rem' }}>
                <option value="شقة">شقة</option>
                <option value="فيلا">فيلا</option>
                <option value="تاون هاوس">تاون هاوس</option>
                <option value="تجاري / إداري">تجاري / إداري</option>
              </select>
              {can(userRole, PERMISSIONS.LEADS_UPDATE) && (
                <button type="submit" style={{ padding: '0.3rem 0.6rem', backgroundColor: '#34d399', color: '#f5efe3', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem', alignSelf: 'flex-start' }}>حفظ التعديلات</button>
              )}
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', backgroundColor: '#f5efe3', padding: '0.8rem', borderRadius: '4px', margin: '0.8rem 0', border: '1px solid #d9c5a4', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#b08a4a' }}>الحالة:</span>
                {/* الماركتنج ممنوع من تغيير حالة العميل */}
                <select disabled={!can(userRole, PERMISSIONS.LEADS_UPDATE)} value={selectedLead.status || 'New Lead'} onChange={(e) => handleUpdateLeadStatus(selectedLead.id, e.target.value)} style={{ padding: '0.3rem', backgroundColor: '#fffaf0', color: '#b08a4a', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.8rem', opacity: userRole === 'marketing' ? 0.7 : 1 }}>
                  {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>

              {/* الماركتنج ممنوع من تعديل المتابعات */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ color: '#b08a4a', fontSize: '0.8rem' }}>موعد المتابعة:</span>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <input type="datetime-local" disabled={!can(userRole, PERMISSIONS.FOLLOWUPS_MANAGE)} value={followUpInput} onChange={(e) => setFollowUpInput(e.target.value)} style={{ flex: 1, padding: '0.3rem', backgroundColor: '#fffaf0', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.8rem' }} />
                  {can(userRole, PERMISSIONS.FOLLOWUPS_MANAGE) && (
                    <button onClick={() => handleSaveFollowUp(selectedLead.id, followUpInput)} style={{ padding: '0.3rem 0.6rem', backgroundColor: '#b08a4a', color: '#f5efe3', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>حفظ</button>
                  )}
                </div>
              </div>
            </div>

            {/* حاسبة الأقساط التفاعلية - ممنوع للماركتنج */}
            {can(userRole, PERMISSIONS.LEADS_UPDATE) && (
              <div style={{ backgroundColor: '#f5efe3', padding: '0.8rem', borderRadius: '4px', margin: '0.8rem 0', border: '1px solid #d9c5a4' }}>
                <h4 style={{ color: '#b08a4a', fontFamily: 'serif', fontSize: '0.9rem', marginTop: 0, marginBottom: '0.5rem' }}>🧮 حاسبة الأقساط التفاعلية</h4>
                <form onSubmit={handleSaveFinancialPlan} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input type="number" placeholder="سعر الوحدة الإجمالي" value={calcData.unitPrice} onChange={(e) => setCalcData({...calcData, unitPrice: e.target.value})} style={{ padding: '0.4rem', backgroundColor: '#fffaf0', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.8rem' }} required />
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#806f56' }}>نسبة المقدم (%)</label>
                      <input type="number" value={calcData.downPaymentPercent} onChange={(e) => setCalcData({...calcData, downPaymentPercent: e.target.value})} style={{ width: '100%', padding: '0.4rem', backgroundColor: '#fffaf0', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.8rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#806f56' }}>دفعة الاستلام (%)</label>
                      <input type="number" value={calcData.deliveryPercent} onChange={(e) => setCalcData({...calcData, deliveryPercent: e.target.value})} style={{ width: '100%', padding: '0.4rem', backgroundColor: '#fffaf0', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.8rem' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#806f56' }}>سنوات التقسيط</label>
                      <input type="number" value={calcData.years} onChange={(e) => setCalcData({...calcData, years: e.target.value})} style={{ width: '100%', padding: '0.4rem', backgroundColor: '#fffaf0', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.8rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: '#806f56' }}>نوع القسط</label>
                      <select value={calcData.installmentType} onChange={(e) => setCalcData({...calcData, installmentType: e.target.value})} style={{ width: '100%', padding: '0.4rem', backgroundColor: '#fffaf0', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.8rem' }}>
                        <option value="monthly">شهري</option>
                        <option value="quarterly">ربع سنوي</option>
                        <option value="yearly">سنوي</option>
                      </select>
                    </div>
                  </div>

                  {calcData.unitPrice && (
                    <div style={{ backgroundColor: '#fffaf0', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem', color: '#34d399', border: '1px dashed #34d399' }}>
                      <strong>قيمة القسط: </strong> 
                      {((parseFloat(calcData.unitPrice) - (parseFloat(calcData.unitPrice) * (calcData.downPaymentPercent/100)) - (parseFloat(calcData.unitPrice) * (calcData.deliveryPercent/100))) / (calcData.years * (calcData.installmentType === 'monthly' ? 12 : (calcData.installmentType === 'quarterly' ? 4 : 1)))).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ج.م
                    </div>
                  )}
                  
                  <button type="submit" style={{ padding: '0.4rem', backgroundColor: '#34d399', color: '#f5efe3', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>💾 حفظ الخطة بملف العميل</button>
                </form>
              </div>
            )}

            {/* الفيدباك والملاحظات - متاح للماركتنج بشكل كامل */}
            <h4 style={{ color: '#b08a4a', fontFamily: 'serif', fontSize: '0.9rem', marginBottom: '0.5rem' }}>سجل الفيدباك:</h4>

            <form onSubmit={handleAddLogNote} style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.8rem' }}>
              <input placeholder="اكتب ملاحظة أو فيدباك..." value={newNote} onChange={(e) => setNewNote(e.target.value)} style={{ flex: 1, padding: '0.5rem', backgroundColor: '#f5efe3', border: '1px solid #d9c5a4', color: '#fff', borderRadius: '4px', fontSize: '0.8rem' }} />
              <button type="submit" style={{ padding: '0.5rem 0.8rem', backgroundColor: '#b08a4a', color: '#f5efe3', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>إضافة</button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto' }}>
              {leadLogs.map(log => (
                <div key={log.id} style={{ backgroundColor: '#f5efe3', padding: '0.6rem', borderRadius: '4px', borderRight: '2px solid #b08a4a', border: '1px solid #d9c5a4', fontSize: '0.8rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#806f56' }}>{log.user_email}</div>
                  <div style={{ marginTop: '0.2rem', color: '#3f321f' }}>{log.content}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" onClick={() => setSelectedLead(null)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#d9c5a4', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* مودال تسجيل عميل يدوي */}
      {showAddLeadModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#fffaf0', padding: '1.5rem', borderRadius: '6px', width: '350px', border: '1px solid #b08a4a' }}>
            <h3 style={{ color: '#b08a4a', fontFamily: 'serif', marginTop: 0, fontSize: '1rem' }}>تسجيل عميل جديد</h3>
            <form onSubmit={handleCreateManualLead} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.8rem' }}>
              <input type="text" placeholder="اسم العميل" required value={newLeadData.name} onChange={(e) => setNewLeadData({...newLeadData, name: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }} />
              <input type="text" placeholder="رقم الهاتف" required value={newLeadData.phone} onChange={(e) => setNewLeadData({...newLeadData, phone: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }} />
              
              <select value={newLeadData.folder} onChange={(e) => setNewLeadData({...newLeadData, folder: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#b08a4a', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }}>
                <option value="">إضافة إلى مجلد (اختياري)...</option>
                {folders.map((f, i) => <option key={i} value={f}>{f}</option>)}
              </select>

              {can(userRole, PERMISSIONS.PROJECTS_MANAGE) && (
                <select value={newLeadData.assigned_to} onChange={(e) => setNewLeadData({...newLeadData, assigned_to: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#b08a4a', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }}>
                  <option value="">إسناد العميل إلى... (اختياري)</option>
                  {teamMembers.map(m => <option key={m.id} value={m.id}>{m.email}</option>)}
                </select>
              )}
              
              <button type="submit" style={{ padding: '0.6rem', backgroundColor: '#b08a4a', color: '#f5efe3', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>حفظ العميل</button>
              <button type="button" onClick={() => setShowAddLeadModal(false)} style={{ padding: '0.5rem', backgroundColor: '#d9c5a4', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.85rem' }}>إلغاء</button>
            </form>
          </div>
        </div>
      )}

      {/* مودال استيراد الإكسيل */}
      {showImportModal && can(userRole, PERMISSIONS.LEADS_IMPORT) && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#fffaf0', padding: '1.5rem', borderRadius: '6px', width: '350px', border: '1px solid #34d399' }}>
            <h3 style={{ color: '#34d399', fontFamily: 'serif', marginTop: 0, fontSize: '1rem' }}>📥 استيراد من Excel / CSV</h3>
            <p style={{ fontSize: '0.75rem', color: '#806f56' }}>الرجاء رفع ملف CSV يحتوي على الأعمدة: Name, Phone, Email, Source</p>
            <input type="file" accept=".csv" onChange={handleFileUpload} style={{ marginTop: '1rem', color: '#fff', fontSize: '0.8rem' }} />

            {importPreview.length > 0 && (
              <div style={{ marginTop: '1rem', backgroundColor: '#f5efe3', border: '1px solid #d9c5a4', borderRadius: '6px', padding: '0.8rem', maxHeight: '240px', overflow: 'auto' }}>
                <div style={{ color: '#34d399', fontWeight: 'bold', fontSize: '0.8rem' }}>
                  معاينة: {importPreview.length} سجل جاهز للاستيراد
                </div>
                <div style={{ color: '#f59e0b', fontSize: '0.72rem', marginTop: '0.25rem' }}>
                  تم تخطي {importSkippedPreview} سجل غير صالح أو مكرر
                </div>
                {importPreview.slice(0, 10).map((lead, index) => (
                  <div key={index} style={{ marginTop: '0.35rem', color: '#806f56', fontSize: '0.7rem' }}>
                    {lead.name} · {lead.phone} · {lead.email || 'بدون بريد'}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              {importPreview.length > 0 && (
                <button type="button" onClick={handleConfirmImport} style={{ padding: '0.4rem 1rem', backgroundColor: '#34d399', color: '#f5efe3', border: 'none', borderRadius: '4px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold' }}>
                  تأكيد الاستيراد
                </button>
              )}
              <button type="button" onClick={() => { setShowImportModal(false); setImportPreview([]); setImportSkippedPreview(0); }} style={{ padding: '0.4rem 1rem', backgroundColor: '#d9c5a4', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.85rem', cursor: 'pointer' }}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال إضافة مشروع */}
      {showProjectModal && can(userRole, PERMISSIONS.PROJECTS_MANAGE) && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#fffaf0', padding: '1.5rem', borderRadius: '6px', width: '320px', border: '1px solid #b08a4a' }}>
            <h3 style={{ color: '#b08a4a', fontFamily: 'serif', marginTop: 0, fontSize: '1rem' }}>إضافة مشروع</h3>
            <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.8rem' }}>
              <input type="text" placeholder="اسم المشروع" required value={newProjectData.name} onChange={(e) => setNewProjectData({...newProjectData, name: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }} />
              <input type="text" placeholder="الموقع" value={newProjectData.location} onChange={(e) => setNewProjectData({...newProjectData, location: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }} />
              <button type="submit" style={{ padding: '0.6rem', backgroundColor: '#b08a4a', color: '#f5efe3', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>حفظ</button>
              <button type="button" onClick={() => setShowProjectModal(false)} style={{ padding: '0.5rem', backgroundColor: '#d9c5a4', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.85rem' }}>إلغاء</button>
            </form>
          </div>
        </div>
      )}

      {/* مودال إضافة وحدة */}
      {showUnitModal && can(userRole, PERMISSIONS.UNITS_MANAGE) && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#fffaf0', padding: '1.5rem', borderRadius: '6px', width: '320px', border: '1px solid #b08a4a' }}>
            <h3 style={{ color: '#b08a4a', fontFamily: 'serif', marginTop: 0, fontSize: '1rem' }}>إضافة وحدة</h3>
            <form onSubmit={handleCreateUnit} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.8rem' }}>
              <select required value={newUnitData.project_id} onChange={(e) => setNewUnitData({...newUnitData, project_id: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }}>
                <option value="">اختر المشروع...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="text" placeholder="رقم / اسم الوحدة" required value={newUnitData.unit_number} onChange={(e) => setNewUnitData({...newUnitData, unit_number: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }} />
              <input type="number" placeholder="المساحة" value={newUnitData.area} onChange={(e) => setNewUnitData({...newUnitData, area: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }} />
              <input type="number" placeholder="السعر" value={newUnitData.price} onChange={(e) => setNewUnitData({...newUnitData, price: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }} />
              <button type="submit" style={{ padding: '0.6rem', backgroundColor: '#b08a4a', color: '#f5efe3', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>حفظ</button>
              <button type="button" onClick={() => setShowUnitModal(false)} style={{ padding: '0.5rem', backgroundColor: '#d9c5a4', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.85rem' }}>إلغاء</button>
            </form>
          </div>
        </div>
      )}

      {/* مودال إضافة مهمة */}
      {showTaskModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#fffaf0', padding: '1.5rem', borderRadius: '6px', width: '320px', border: '1px solid #b08a4a' }}>
            <h3 style={{ color: '#b08a4a', fontFamily: 'serif', marginTop: 0, fontSize: '1rem' }}>إضافة مهمة جديدة</h3>
            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.8rem' }}>
              <input type="text" placeholder="عنوان المهمة" required value={newTaskData.title} onChange={(e) => setNewTaskData({...newTaskData, title: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }} />
              <select value={newTaskData.lead_id} onChange={(e) => setNewTaskData({...newTaskData, lead_id: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }}>
                <option value="">ارتباط بعميل (اختياري)</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <input type="datetime-local" value={newTaskData.due_date} onChange={(e) => setNewTaskData({...newTaskData, due_date: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }} />
              <button type="submit" style={{ padding: '0.6rem', backgroundColor: '#b08a4a', color: '#f5efe3', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>حفظ</button>
              <button type="button" onClick={() => setShowTaskModal(false)} style={{ padding: '0.5rem', backgroundColor: '#d9c5a4', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.85rem' }}>إلغاء</button>
            </form>
          </div>
        </div>
      )}

      {/* مودال إضافة حملة */}
      {showCampaignModal && can(userRole, PERMISSIONS.CAMPAIGNS_MANAGE) && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#fffaf0', padding: '1.5rem', borderRadius: '6px', width: '320px', border: '1px solid #b08a4a' }}>
            <h3 style={{ color: '#b08a4a', fontFamily: 'serif', marginTop: 0, fontSize: '1rem' }}>إضافة حملة إعلانية</h3>
            <form onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.8rem' }}>
              <input type="text" placeholder="اسم الحملة" required value={newCampaignData.name} onChange={(e) => setNewCampaignData({...newCampaignData, name: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }} />
              <input type="text" placeholder="المنصة (مثل Facebook)" value={newCampaignData.platform} onChange={(e) => setNewCampaignData({...newCampaignData, platform: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }} />
              <input type="number" placeholder="الميزانية" value={newCampaignData.budget} onChange={(e) => setNewCampaignData({...newCampaignData, budget: e.target.value})} style={{ padding: '0.5rem', backgroundColor: '#f5efe3', color: '#fff', border: '1px solid #d9c5a4', borderRadius: '4px', fontSize: '0.85rem' }} />
              <button type="submit" style={{ padding: '0.6rem', backgroundColor: '#b08a4a', color: '#f5efe3', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>حفظ</button>
              <button type="button" onClick={() => setShowCampaignModal(false)} style={{ padding: '0.5rem', backgroundColor: '#d9c5a4', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.85rem' }}>إلغاء</button>
            </form>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
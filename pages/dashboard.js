import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [units, setUnits] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('analytics');
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTemperature, setFilterTemperature] = useState('ALL');
  const [filterSource, setFilterSource] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const initialFormState = {
    name: '', phone: '', whatsapp: '', email: '', governorate: '',
    client_type: 'End User', budget: '', down_payment: '', monthly_installment: '',
    required_area: '', bedrooms: 1, required_region: '', property_type: 'شقة',
    payment_method: 'تقسيط', lead_source: 'Facebook', status: 'New Lead',
    temperature: 'Cold', notes: ''
  };

  const [formData, setFormData] = useState(initialFormState);
  const [taskData, setTaskData] = useState({ lead_id: '', title: '', task_type: 'Call', due_date: '', notes: '' });
  const [unitData, setUnitData] = useState({ unit_code: '', project_name: '', property_type: 'شقة', region: '', area: '', price: '', bedrooms: '1', status: 'Available', notes: '' });

  const leadStatuses = [
    'New Lead', 'Contacted', 'Qualified', 'Interested', 
    'Project Sent', 'Meeting', 'Viewing', 'Negotiation', 
    'Reservation', 'Contract', 'Closed Won', 'Closed Lost'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }

    const { data: leadsData } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (leadsData) setLeads(leadsData);

    const { data: unitsData } = await supabase.from('units').select('*').order('created_at', { ascending: false });
    if (unitsData) setUnits(unitsData);

    const { data: tasksData } = await supabase.from('tasks').select('*, leads(name, phone)').order('due_date', { ascending: true });
    if (tasksData) setTasks(tasksData);

    setLoading(false);
  };

  const handleAddLead = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('leads').insert([formData]);
    if (error) { alert('خطأ في إضافة العميل: ' + error.message); }
    else { setShowLeadModal(false); setFormData(initialFormState); fetchData(); }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('tasks').insert([taskData]);
    if (error) { alert('خطأ في إضافة المهمة: ' + error.message); }
    else { setShowTaskModal(false); setTaskData({ lead_id: '', title: '', task_type: 'Call', due_date: '', notes: '' }); fetchData(); }
  };

  const handleAddUnit = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('units').insert([unitData]);
    if (error) { alert('خطأ في إضافة الوحدة: ' + error.message); }
    else { setShowUnitModal(false); setUnitData({ unit_code: '', project_name: '', property_type: 'شقة', region: '', area: '', price: '', bedrooms: '1', status: 'Available', notes: '' }); fetchData(); }
  };

  const updateUnitStatus = async (unitId, newStatus) => {
    const { error } = await supabase.from('units').update({ status: newStatus }).eq('id', unitId);
    if (!error) fetchData();
  };

  const toggleTaskStatus = async (taskId, currentStatus) => {
    const newStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    if (!error) fetchData();
  };

  const updateLeadStatus = async (leadId, newStatus) => {
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
    if (!error) setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const exportToCSV = (data, filename) => {
    if (!data || !data.length) { alert('لا توجد بيانات للتصدير'); return; }
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).map(v => `"${v || ''}"`).join(','));
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter Logic
  const filteredLeads = leads.filter(lead => {
    const matchesQuery = (lead.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (lead.phone || '').includes(searchQuery);
    const matchesTemp = filterTemperature === 'ALL' || lead.temperature === filterTemperature;
    const matchesSource = filterSource === 'ALL' || lead.lead_source === filterSource;
    const matchesStatus = filterStatus === 'ALL' || lead.status === filterStatus;

    return matchesQuery && matchesTemp && matchesSource && matchesStatus;
  });

  // Analytics Helpers
  const hotLeadsCount = leads.filter(l => l.temperature === 'Hot').length;
  const wonLeadsCount = leads.filter(l => l.status === 'Closed Won').length;
  const availableUnitsCount = units.filter(u => u.status === 'Available').length;
  const pendingTasksCount = tasks.filter(t => t.status === 'Pending').length;

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '5rem', backgroundColor: '#0f172a', minHeight: '100vh' }}>جاري التحميل...</div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'sans-serif', direction: 'rtl' }}>
      
      {/* Header */}
      <header style={{ backgroundColor: '#1e293b', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0, color: '#38bdf8' }}>ARCOVA CRM</h2>
          <span style={{ backgroundColor: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem' }}>v3.2 Fixed All Modals</span>
        </div>
        <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>تسجيل الخروج</button>
      </header>

      {/* Navigation Bar */}
      <div style={{ backgroundColor: '#1e293b', padding: '0.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('analytics')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'analytics' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📈 التقارير والإحصائيات</button>
          <button onClick={() => setActiveTab('kanban')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'kanban' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📊 لوحة المراحل (Kanban)</button>
          <button onClick={() => setActiveTab('list')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'list' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📑 قائمة العملاء ({leads.length})</button>
          <button onClick={() => setActiveTab('tasks')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'tasks' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>✅ المهام اليومية ({pendingTasksCount})</button>
          <button onClick={() => setActiveTab('inventory')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'inventory' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>🏢 المخزون العقاري ({units.length})</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {activeTab === 'list' && (
            <button onClick={() => exportToCSV(filteredLeads, 'filtered_leads')} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>📥 تصدير نتائج البحث</button>
          )}
          {activeTab === 'inventory' && (
            <>
              <button onClick={() => exportToCSV(units, 'units_export')} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>📥 تصدير الوحدات</button>
              <button onClick={() => setShowUnitModal(true)} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>+ إضافة وحدة جديدة</button>
            </>
          )}
          {activeTab === 'tasks' && (
            <button onClick={() => setShowTaskModal(true)} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>+ إضافة مهمة جديدة</button>
          )}
          <button onClick={() => setShowLeadModal(true)} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>+ إضافة عميل جديد</button>
        </div>
      </div>

      {/* Content */}
      <main style={{ padding: '1.5rem', overflowX: 'auto' }}>

        {/* 0. ANALYTICS VIEW */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{ backgroundColor: '#1e293b', padding: '1.2rem', borderRadius: '8px', borderRight: '4px solid #0284c7' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>إجمالي العملاء</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', marginTop: '0.4rem' }}>{leads.length}</div>
              </div>
              <div style={{ backgroundColor: '#1e293b', padding: '1.2rem', borderRadius: '8px', borderRight: '4px solid #ef4444' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>عملاء شديدو الاهتمام (Hot)</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#f87171', marginTop: '0.4rem' }}>{hotLeadsCount}</div>
              </div>
              <div style={{ backgroundColor: '#1e293b', padding: '1.2rem', borderRadius: '8px', borderRight: '4px solid #10b981' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>صفقات ناجحة (Closed Won)</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#34d399', marginTop: '0.4rem' }}>{wonLeadsCount}</div>
              </div>
              <div style={{ backgroundColor: '#1e293b', padding: '1.2rem', borderRadius: '8px', borderRight: '4px solid #8b5cf6' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>الوحدات المتاحة</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#c084fc', marginTop: '0.4rem' }}>{availableUnitsCount} / {units.length}</div>
              </div>
              <div style={{ backgroundColor: '#1e293b', padding: '1.2rem', borderRadius: '8px', borderRight: '4px solid #f59e0b' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>المهام المتبقية</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fbbf24', marginTop: '0.4rem' }}>{pendingTasksCount}</div>
              </div>
            </div>
          </div>
        )}

        {/* 1. KANBAN BOARD */}
        {activeTab === 'kanban' && (
          <div style={{ display: 'flex', gap: '1rem', minHeight: 'calc(100vh - 180px)', paddingBottom: '1rem' }}>
            {leadStatuses.map((status) => {
              const statusLeads = leads.filter(l => l.status === status);
              return (
                <div key={status} style={{ minWidth: '280px', backgroundColor: '#1e293b', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid #334155', paddingBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{status}</h4>
                    <span style={{ backgroundColor: '#334155', padding: '0.1rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem' }}>{statusLeads.length}</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto' }}>
                    {statusLeads.map((lead) => (
                      <div key={lead.id} onClick={() => setSelectedLead(lead)} style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '6px', borderLeft: `4px solid ${lead.temperature === 'Hot' ? '#ef4444' : lead.temperature === 'Warm' ? '#f59e0b' : '#3b82f6'}`, cursor: 'pointer' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.3rem' }}>{lead.name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>📞 {lead.phone}</div>
                        <div style={{ fontSize: '0.85rem', color: '#34d399', marginTop: '0.3rem' }}>{lead.budget ? `${lead.budget} ج.م` : 'الميزانية غير محددة'}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.8rem', paddingTop: '0.5rem', borderTop: '1px solid #1e293b' }}>
                          <span style={{ fontSize: '0.75rem', backgroundColor: '#334155', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>{lead.lead_source}</span>
                          <select value={lead.status} onChange={(e) => updateLeadStatus(lead.id, e.target.value)} onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '4px', fontSize: '0.75rem' }}>
                            {leadStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 2. LEADS LIST WITH FILTERS */}
        {activeTab === 'list' && (
          <div>
            {/* Search and Filters Bar */}
            <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="🔍 بحث بالاسم أو رقم الهاتف..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, minWidth: '200px', padding: '0.6rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
              />
              <select value={filterTemperature} onChange={(e) => setFilterTemperature(e.target.value)} style={{ padding: '0.6rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}>
                <option value="ALL">كل درجات الاهتمام</option>
                <option value="Hot">🔥 Hot</option>
                <option value="Warm">☀️ Warm</option>
                <option value="Cold">❄️ Cold</option>
              </select>
              <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={{ padding: '0.6rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}>
                <option value="ALL">كل المصادر</option>
                <option value="Facebook">Facebook</option>
                <option value="Instagram">Instagram</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Google">Google</option>
                <option value="Cold Call">Cold Call</option>
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: '0.6rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}>
                <option value="ALL">كل المراحل</option>
                {leadStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Table */}
            <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>
                    <th style={{ padding: '1rem' }}>الاسم</th>
                    <th style={{ padding: '1rem' }}>الهاتف</th>
                    <th style={{ padding: '1rem' }}>الميزانية</th>
                    <th style={{ padding: '1rem' }}>المصدر</th>
                    <th style={{ padding: '1rem' }}>الحالة</th>
                    <th style={{ padding: '1rem' }}>الدرجة</th>
                    <th style={{ padding: '1rem' }}>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '1rem', fontWeight: 'bold' }}>{lead.name}</td>
                      <td style={{ padding: '1rem' }}>{lead.phone}</td>
                      <td style={{ padding: '1rem', color: '#34d399' }}>{lead.budget ? `${lead.budget} ج.م` : '-'}</td>
                      <td style={{ padding: '1rem' }}>{lead.lead_source}</td>
                      <td style={{ padding: '1rem' }}>{lead.status}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ backgroundColor: lead.temperature === 'Hot' ? '#ef4444' : lead.temperature === 'Warm' ? '#f59e0b' : '#3b82f6', padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.75rem' }}>{lead.temperature}</span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <button onClick={() => setSelectedLead(lead)} style={{ padding: '0.3rem 0.8rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>عرض 360°</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. TASKS VIEW */}
        {activeTab === 'tasks' && (
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>✅ قائمة المهام والمتابعات اليومية</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {tasks.map((task) => (
                <div key={task.id} style={{ backgroundColor: '#0f172a', padding: '1rem 1.5rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRight: `5px solid ${task.status === 'Completed' ? '#10b981' : '#f59e0b'}` }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '1.1rem', textDecoration: task.status === 'Completed' ? 'line-through' : 'none', color: task.status === 'Completed' ? '#64748b' : '#fff' }}>{task.title}</span>
                      <span style={{ backgroundColor: '#334155', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem' }}>{task.task_type}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                      العميل: {task.leads ? task.leads.name : 'غير محدد'} ({task.leads ? task.leads.phone : '-'})
                    </div>
                  </div>
                  <button onClick={() => toggleTaskStatus(task.id, task.status)} style={{ padding: '0.5rem 1rem', backgroundColor: task.status === 'Completed' ? '#64748b' : '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    {task.status === 'Completed' ? 'إلغاء الإنجاز' : 'تم الإنجاز ✓'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. INVENTORY VIEW */}
        {activeTab === 'inventory' && (
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>🏢 المخزون العقاري والوحدات المتاحة</h3>
            <div style={{ backgroundColor: '#0f172a', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: '#94a3b8' }}>
                    <th style={{ padding: '1rem' }}>كود الوحدة</th>
                    <th style={{ padding: '1rem' }}>المشروع</th>
                    <th style={{ padding: '1rem' }}>السعر</th>
                    <th style={{ padding: '1rem' }}>الحالة</th>
                    <th style={{ padding: '1rem' }}>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((unit) => (
                    <tr key={unit.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '1rem', fontWeight: 'bold', color: '#38bdf8' }}>{unit.unit_code}</td>
                      <td style={{ padding: '1rem' }}>{unit.project_name}</td>
                      <td style={{ padding: '1rem', color: '#34d399' }}>{unit.price ? `${unit.price} ج.م` : '-'}</td>
                      <td style={{ padding: '1rem' }}>{unit.status}</td>
                      <td style={{ padding: '1rem' }}>
                        <select value={unit.status} onChange={(e) => updateUnitStatus(unit.id, e.target.value)} style={{ backgroundColor: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: '4px', padding: '0.3rem' }}>
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

      </main>

      {/* Add Lead Modal */}
      {showLeadModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1e293b', padding: '2rem', borderRadius: '10px', width: '90%', maxWidth: '600px' }}>
            <h3>إضافة عميل جديد</h3>
            <form onSubmit={handleAddLead} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <input placeholder="اسم العميل" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }} />
              <input placeholder="رقم الهاتف" required value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }} />
              <input placeholder="الميزانية" value={formData.budget} onChange={(e) => setFormData({...formData, budget: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }} />
              <select value={formData.lead_source} onChange={(e) => setFormData({...formData, lead_source: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }}>
                <option value="Facebook">Facebook</option>
                <option value="Instagram">Instagram</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Google">Google</option>
                <option value="Cold Call">Cold Call</option>
              </select>
              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowLeadModal(false)} style={{ padding: '0.5rem 1rem', backgroundColor: '#64748b', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>إلغاء</button>
                <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>حفظ العميل</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Unit Modal */}
      {showUnitModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1e293b', padding: '2rem', borderRadius: '10px', width: '90%', maxWidth: '600px' }}>
            <h3>إضافة وحدة عقارية جديدة</h3>
            <form onSubmit={handleAddUnit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <input placeholder="كود الوحدة (مثال: A-102)" required value={unitData.unit_code} onChange={(e) => setUnitData({...unitData, unit_code: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }} />
              <input placeholder="اسم المشروع" required value={unitData.project_name} onChange={(e) => setUnitData({...unitData, project_name: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }} />
              <input placeholder="المنطقة / الموقع" value={unitData.region} onChange={(e) => setUnitData({...unitData, region: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }} />
              <input placeholder="المساحة (م²)" value={unitData.area} onChange={(e) => setUnitData({...unitData, area: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }} />
              <input placeholder="السعر المطلوب" value={unitData.price} onChange={(e) => setUnitData({...unitData, price: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }} />
              <select value={unitData.property_type} onChange={(e) => setUnitData({...unitData, property_type: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }}>
                <option value="شقة">شقة</option>
                <option value="فيلا">فيلا</option>
                <option value="تاون هاوس">تاون هاوس</option>
                <option value="مكتب تجاري">مكتب تجاري</option>
                <option value="محل تجاري">محل تجاري</option>
              </select>
              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowUnitModal(false)} style={{ padding: '0.5rem 1rem', backgroundColor: '#64748b', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>إلغاء</button>
                <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#8b5cf6', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>حفظ الوحدة</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showTaskModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1e293b', padding: '2rem', borderRadius: '10px', width: '90%', maxWidth: '500px' }}>
            <h3>إضافة مهمة جديدة</h3>
            <form onSubmit={handleAddTask} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input placeholder="عنوان المهمة (مثال: متابعة تفاصيل المعاينة)" required value={taskData.title} onChange={(e) => setTaskData({...taskData, title: e.target.value})} style={{ padding: '0.6rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }} />
              <select value={taskData.lead_id} onChange={(e) => setTaskData({...taskData, lead_id: e.target.value})} style={{ padding: '0.6rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }}>
                <option value="">اختر العميل المرتبط بالمهام</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.name} - {l.phone}</option>)}
              </select>
              <select value={taskData.task_type} onChange={(e) => setTaskData({...taskData, task_type: e.target.value})} style={{ padding: '0.6rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }}>
                <option value="Call">📞 مكالمة هاتفية</option>
                <option value="Meeting">🤝 اجتماع</option>
                <option value="Viewing">🏘️ معاينة وحدة</option>
                <option value="Follow-up">💬 متابعة واتساب</option>
              </select>
              <input type="datetime-local" value={taskData.due_date} onChange={(e) => setTaskData({...taskData, due_date: e.target.value})} style={{ padding: '0.6rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }} />
              <textarea placeholder="ملاحظات حول المهمة..." value={taskData.notes} onChange={(e) => setTaskData({...taskData, notes: e.target.value})} style={{ padding: '0.6rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px', minHeight: '80px' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowTaskModal(false)} style={{ padding: '0.5rem 1rem', backgroundColor: '#64748b', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>إلغاء</button>
                <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>حفظ المهمة</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Lead Modal (Customer 360 Full Profile with Call & WhatsApp) */}
      {selectedLead && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1e293b', padding: '2rem', borderRadius: '10px', width: '90%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
              <h2>بطاقة العميل الكاملة (Customer 360)</h2>
              <button onClick={() => setSelectedLead(null)} style={{ backgroundColor: 'transparent', color: '#fff', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: '#0f172a', padding: '1rem', borderRadius: '8px' }}>
              <div><strong>الاسم:</strong> {selectedLead.name}</div>
              <div><strong>الهاتف:</strong> {selectedLead.phone}</div>
              <div><strong>الميزانية:</strong> {selectedLead.budget ? `${selectedLead.budget} ج.م` : 'غير محدد'}</div>
              <div><strong>المقدم المتاح:</strong> {selectedLead.down_payment ? `${selectedLead.down_payment} ج.م` : 'غير محدد'}</div>
              <div><strong>نوع العميل:</strong> {selectedLead.client_type || 'End User'}</div>
              <div><strong>درجة الاهتمام:</strong> {selectedLead.temperature}</div>
              <div><strong>مصدر العميل:</strong> {selectedLead.lead_source}</div>
              <div><strong>المرحلة الحالية:</strong> {selectedLead.status}</div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
              <a href={`https://wa.me/${selectedLead.phone}`} target="_blank" rel="noreferrer" style={{ padding: '0.6rem 1.2rem', backgroundColor: '#22c55e', color: '#fff', textDecoration: 'none', borderRadius: '6px', textAlign: 'center', flex: 1, fontWeight: 'bold' }}>💬 مراسلة واتساب</a>
              <a href={`tel:${selectedLead.phone}`} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#3b82f6', color: '#fff', textDecoration: 'none', borderRadius: '6px', textAlign: 'center', flex: 1, fontWeight: 'bold' }}>📞 اتصال هاتفي</a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [units, setUnits] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('kanban');
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  const initialFormState = {
    name: '', phone: '', whatsapp: '', email: '', governorate: '',
    client_type: 'End User', budget: '', down_payment: '', monthly_installment: '',
    required_area: '', bedrooms: 1, required_region: '', property_type: 'شقة',
    payment_method: 'تقسيط', lead_source: 'Facebook', status: 'New Lead',
    temperature: 'Cold', notes: ''
  };

  const [formData, setFormData] = useState(initialFormState);
  const [taskData, setTaskData] = useState({
    lead_id: '', title: '', task_type: 'Call', due_date: '', notes: ''
  });

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

    const { data: unitsData } = await supabase.from('units').select('*');
    if (unitsData) setUnits(unitsData);

    const { data: tasksData } = await supabase.from('tasks').select('*, leads(name, phone)').order('due_date', { ascending: true });
    if (tasksData) setTasks(tasksData);

    setLoading(false);
  };

  const handleAddLead = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('leads').insert([formData]);
    if (error) {
      alert('خطأ في إضافة العميل: ' + error.message);
    } else {
      setShowLeadModal(false);
      setFormData(initialFormState);
      fetchData();
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('tasks').insert([taskData]);
    if (error) {
      alert('خطأ في إضافة المهمة: ' + error.message);
    } else {
      setShowTaskModal(false);
      setTaskData({ lead_id: '', title: '', task_type: 'Call', due_date: '', notes: '' });
      fetchData();
    }
  };

  const toggleTaskStatus = async (taskId, currentStatus) => {
    const newStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    if (!error) fetchData();
  };

  const updateLeadStatus = async (leadId, newStatus) => {
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);
    if (!error) {
      setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '5rem', backgroundColor: '#0f172a', minHeight: '100vh' }}>جاري التحميل...</div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'sans-serif', direction: 'rtl' }}>
      
      {/* Header */}
      <header style={{ backgroundColor: '#1e293b', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0, color: '#38bdf8' }}>ARCOVA CRM</h2>
          <span style={{ backgroundColor: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem' }}>v2.0 Pro</span>
        </div>
        <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>تسجيل الخروج</button>
      </header>

      {/* Navigation Bar */}
      <div style={{ backgroundColor: '#1e293b', padding: '0.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setActiveTab('kanban')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'kanban' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📊 لوحة المراحل (Kanban)</button>
          <button onClick={() => setActiveTab('list')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'list' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📑 قائمة العملاء ({leads.length})</button>
          <button onClick={() => setActiveTab('tasks')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'tasks' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>✅ المهام اليومية ({tasks.filter(t => t.status === 'Pending').length})</button>
          <button onClick={() => setActiveTab('inventory')} style={{ padding: '0.6rem 1.2rem', backgroundColor: activeTab === 'inventory' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>🏢 المخزون العقاري ({units.length})</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {activeTab === 'tasks' && (
            <button onClick={() => setShowTaskModal(true)} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>+ إضافة مهمة جديدة</button>
          )}
          <button onClick={() => setShowLeadModal(true)} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>+ إضافة عميل جديد</button>
        </div>
      </div>

      {/* Content */}
      <main style={{ padding: '1.5rem', overflowX: 'auto' }}>

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

        {/* 2. LEADS LIST */}
        {activeTab === 'list' && (
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
                {leads.map((lead) => (
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
        )}

        {/* 3. TASKS VIEW */}
        {activeTab === 'tasks' && (
          <div style={{ backgroundColor: '#1e293b', borderRadius: '8px', padding: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>✅ قائمة المهام والمتابعات اليومية</h3>
            {tasks.length === 0 ? (
              <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>لا توجد مهام مسجلة حتى الآن. اضغط "+ إضافة مهمة جديدة".</p>
            ) : (
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
                      {task.notes && <div style={{ fontSize: '0.85rem', color: '#38bdf8', marginTop: '0.3rem' }}>💡 {task.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{task.due_date ? new Date(task.due_date).toLocaleDateString('ar-EG') : ''}</span>
                      <button onClick={() => toggleTaskStatus(task.id, task.status)} style={{ padding: '0.5rem 1rem', backgroundColor: task.status === 'Completed' ? '#64748b' : '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                        {task.status === 'Completed' ? 'إلغاء الإنجاز' : 'تم الإنجاز ✓'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. INVENTORY */}
        {activeTab === 'inventory' && (
          <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#1e293b', borderRadius: '8px' }}>
            <h3>🏢 قسم المخزون والوحدات العقارية</h3>
            <p style={{ color: '#94a3b8' }}>يمكنك هنا إضافة المشاريع والوحدات وتتبع حالتها (متاحة، محجوزة، مباعة).</p>
          </div>
        )}

      </main>

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

      {/* Customer 360 Modal */}
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
              <div><strong>نوع العميل:</strong> {selectedLead.client_type}</div>
              <div><strong>درجة الاهتمام:</strong> {selectedLead.temperature}</div>
              <div><strong>مصدر العميل:</strong> {selectedLead.lead_source}</div>
              <div><strong>المرحلة الحالية:</strong> {selectedLead.status}</div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <a href={`https://wa.me/${selectedLead.phone}`} target="_blank" rel="noreferrer" style={{ padding: '0.6rem 1.2rem', backgroundColor: '#22c55e', color: '#fff', textDecoration: 'none', borderRadius: '6px', textAlign: 'center', flex: 1 }}>💬 مراسلة واتساب</a>
              <a href={`tel:${selectedLead.phone}`} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#3b82f6', color: '#fff', textDecoration: 'none', borderRadius: '6px', textAlign: 'center', flex: 1 }}>📞 اتصال هاتفي</a>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showLeadModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1e293b', padding: '2rem', borderRadius: '10px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>إضافة عميل جديد</h3>
            <form onSubmit={handleAddLead} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <input placeholder="اسم العميل" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }} />
              <input placeholder="رقم الهاتف" required value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }} />
              <input placeholder="الميزانية (Budget)" value={formData.budget} onChange={(e) => setFormData({...formData, budget: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }} />
              <input placeholder="المقدم المتاح" value={formData.down_payment} onChange={(e) => setFormData({...formData, down_payment: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }} />
              <select value={formData.lead_source} onChange={(e) => setFormData({...formData, lead_source: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }}>
                <option value="Facebook">Facebook</option>
                <option value="Instagram">Instagram</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Google">Google</option>
                <option value="Cold Call">Cold Call</option>
              </select>
              <select value={formData.temperature} onChange={(e) => setFormData({...formData, temperature: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', borderRadius: '4px' }}>
                <option value="Cold">Cold</option>
                <option value="Warm">Warm</option>
                <option value="Hot">Hot</option>
              </select>
              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowLeadModal(false)} style={{ padding: '0.5rem 1rem', backgroundColor: '#64748b', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>إلغاء</button>
                <button type="submit" style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>حفظ العميل</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

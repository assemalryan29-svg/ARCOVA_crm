'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, LayoutDashboard, Layers, LogOut, 
  Plus, Phone, MessageSquare 
} from 'lucide-react';

export default function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [leads, setLeads] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) fetchLeads();
  }, [session]);

  const fetchLeads = async () => {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (data) setLeads(data);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    setLoading(false);
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-xl max-w-md w-full border border-slate-700 shadow-2xl">
          <h1 className="text-3xl font-bold text-center text-blue-500 mb-2">ARCOVA CRM</h1>
          <p className="text-slate-400 text-center text-sm mb-6">Real Estate Enterprise Platform</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-slate-300">Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500" 
                placeholder="name@arcova.com" required 
              />
            </div>
            <div>
              <label className="text-xs text-slate-300">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500" 
                placeholder="••••••••" required 
              />
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 font-bold rounded-lg transition-all">
              {loading ? 'Entering...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row dir-rtl">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 border-b md:border-r border-slate-800 p-4">
        <h2 className="text-xl font-bold text-blue-500 mb-6 text-center">ARCOVA CRM</h2>
        <nav className="space-y-2">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button onClick={() => setActiveTab('kanban')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'kanban' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Layers size={18} /> Pipeline
          </button>
          <button onClick={() => setActiveTab('leads')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium ${activeTab === 'leads' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Users size={18} /> Customer 360 Leads
          </button>
        </nav>
        <button onClick={() => supabase.auth.signOut()} className="mt-8 w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg text-sm hover:bg-red-500/20">
          <LogOut size={16} /> Sign Out
        </button>
      </aside>

      {/* Content Area */}
      <main className="flex-1 p-6">
        {activeTab === 'dashboard' && (
          <div>
            <h1 className="text-2xl font-bold mb-6">Performance Dashboard</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-xs">Total Leads</span>
                <p className="text-2xl font-bold text-blue-400 mt-1">{leads.length}</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-xs">Hot Prospects</span>
                <p className="text-2xl font-bold text-red-400 mt-1">{leads.filter(l => l.temperature === 'Hot').length}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leads' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Leads Management</h1>
              <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg text-sm font-bold">
                <Plus size={16} /> Add Lead
              </button>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-800 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Budget</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="p-3 font-semibold">{l.name}</td>
                      <td className="p-3">{l.phone}</td>
                      <td className="p-3">{l.budget ? `${l.budget} EGP` : '-'}</td>
                      <td className="p-3"><span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">{l.status}</span></td>
                      <td className="p-3 flex gap-2">
                        <a href={`https://wa.me/${l.phone}`} target="_blank" className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded"><MessageSquare size={16} /></a>
                        <a href={`tel:${l.phone}`} className="p-1.5 bg-blue-500/20 text-blue-400 rounded"><Phone size={16} /></a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

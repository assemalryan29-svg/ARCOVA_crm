import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  Building2,
  ListTodo,
  Megaphone,
  Trophy,
  ShieldCheck,
  UserCog,
  ChevronLeft,
} from 'lucide-react';

const navItems = [
  { name: 'الرئيسية', view: 'overview', icon: LayoutDashboard },
  { name: 'العملاء', view: 'leads', icon: Users },
  { name: 'المتابعات', view: 'reminders', icon: CalendarClock },
  { name: 'المشاريع والوحدات', view: 'projects', icon: Building2 },
  { name: 'المهام', view: 'tasks', icon: ListTodo },
  { name: 'الحملات', view: 'campaigns', icon: Megaphone },
  { name: 'أداء المبيعات', view: 'leaderboard', icon: Trophy },
  { name: 'سجل التدقيق', view: 'audit', icon: ShieldCheck },
  { name: 'فريق العمل', view: 'team', icon: UserCog },
];

export default function Sidebar() {
  const router = useRouter();
  const activeView = typeof router.query.view === 'string' ? router.query.view : 'overview';

  return (
    <aside
      dir="rtl"
      style={{
        width: '240px',
        minWidth: '240px',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#020617',
        borderLeft: '1px solid #1e293b',
        padding: '1rem',
        color: '#fff',
        boxSizing: 'border-box',
        zIndex: 20
      }}
    >
      <div>
        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #1e293b', padding: '0.5rem 0.5rem 1.25rem' }}>
          <div style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: '1px solid rgba(251,191,36,0.7)', background: 'linear-gradient(135deg,#fcd34d,#d97706)', fontSize: '1.2rem', fontWeight: 700, color: '#020617' }}>A</div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.18em', color: '#fcd34d' }}>ARCOVA</div>
            <div style={{ marginTop: '0.15rem', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.16em', color: '#94a3b8' }}>REAL ESTATE CRM</div>
          </div>
        </div>

        <div style={{ marginBottom: '0.75rem', padding: '0 0.75rem', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', color: '#64748b' }}>القائمة الرئيسية</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.view;
            return (
              <Link key={item.view} href={{ pathname: '/dashboard', query: { view: item.view } }} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: isActive ? '#fbbf24' : 'transparent',
                  color: isActive ? '#020617' : '#cbd5e1',
                  boxShadow: isActive ? '0 10px 25px rgba(245, 158, 11, 0.12)' : 'none'
                }}>
                <span className="flex items-center gap-3"><Icon style={{ width: '18px', height: '18px' }} /><span>{item.name}</span></span>
                <ChevronLeft className={`h-4 w-4 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`} />
              </Link>
            );
          })}
        </nav>
      </div>

      <div style={{ borderRadius: '12px', border: '1px solid #1e293b', backgroundColor: 'rgba(15,23,42,0.7)', padding: '0.75rem', textAlign: 'center' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', color: '#fcd34d' }}>ARCOVA CRM</div>
        <div style={{ marginTop: '0.25rem', fontSize: '0.65rem', color: '#64748b' }}>نظام إدارة العملاء والعقارات</div>
      </div>
    </aside>
  );
}


const _arcovaSidebarMobile = true;

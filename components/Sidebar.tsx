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
    <aside className="arcova-sidebar" dir="rtl">
      <div className="arcova-sidebar-content">
        <div className="arcova-brand">
          <div className="arcova-brand-mark">A</div>
          <div>
            <div className="arcova-brand-name">ARCOVA</div>
            <div className="arcova-brand-subtitle">REAL ESTATE CRM</div>
          </div>
        </div>

        <div className="arcova-menu-title">القائمة الرئيسية</div>
        <nav className="arcova-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.view;
            return (
              <Link
                key={item.view}
                className={`arcova-nav-link ${isActive ? 'active' : ''}`}
                href={{ pathname: '/dashboard', query: { view: item.view } }}
                shallow
                scroll={false}
              >
                <span className="arcova-nav-label"><Icon size={18} /><span>{item.name}</span></span>
                <ChevronLeft size={16} className="arcova-nav-arrow" />
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="arcova-sidebar-footer">
        <div className="arcova-footer-title">ARCOVA CRM</div>
        <div className="arcova-footer-text">نظام إدارة العملاء والعقارات</div>
      </div>

      <style jsx>{`
        .arcova-sidebar { width: 240px; min-width: 240px; height: 100vh; position: sticky; top: 0; display: flex; flex-direction: column; background: #020617; border-left: 1px solid #1e293b; padding: 16px; color: #fff; box-sizing: border-box; z-index: 20; overflow: hidden; flex: 0 0 240px; }
        .arcova-sidebar-content { min-height: 0; flex: 1 1 auto; overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; scrollbar-color: #475569 transparent; }
        .arcova-brand { margin-bottom: 24px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #1e293b; padding: 8px 8px 20px; }
        .arcova-brand-mark { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 12px; border: 1px solid rgba(251,191,36,.7); background: linear-gradient(135deg,#fcd34d,#d97706); font-size: 1.2rem; font-weight: 700; color: #020617; flex-shrink: 0; }
        .arcova-brand-name { font-size: 1rem; font-weight: 700; letter-spacing: .18em; color: #fcd34d; }
        .arcova-brand-subtitle { margin-top: 2px; font-size: .6rem; font-weight: 600; letter-spacing: .16em; color: #94a3b8; }
        .arcova-menu-title { margin-bottom: 12px; padding: 0 12px; font-size: .65rem; font-weight: 700; letter-spacing: .12em; color: #64748b; }
        .arcova-nav { display: flex; flex-direction: column; gap: 8px; }
        .arcova-nav-link { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 12px; border-radius: 12px; box-sizing: border-box; color: #cbd5e1; text-decoration: none; transition: background .2s ease, color .2s ease, transform .2s ease; cursor: pointer; touch-action: manipulation; }
        .arcova-nav-link:hover { background: #0f172a; color: #fff; transform: translateX(-2px); }
        .arcova-nav-link.active { background: #fbbf24; color: #020617; box-shadow: 0 10px 25px rgba(245,158,11,.12); }
        .arcova-nav-label { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .arcova-nav-label span { white-space: nowrap; font-size: .9rem; }
        .arcova-nav-arrow { opacity: 0; flex-shrink: 0; }
        .arcova-nav-link.active .arcova-nav-arrow, .arcova-nav-link:hover .arcova-nav-arrow { opacity: .8; }
        .arcova-sidebar-footer { margin-top: auto; flex-shrink: 0; border-radius: 12px; border: 1px solid #1e293b; background: rgba(15,23,42,.7); padding: 12px; text-align: center; }
        .arcova-footer-title { font-size: .65rem; font-weight: 700; letter-spacing: .1em; color: #fcd34d; }
        .arcova-footer-text { margin-top: 4px; font-size: .65rem; color: #64748b; }
        @media (max-width: 768px) {
          .arcova-sidebar { width: 100%; min-width: 0; height: auto; min-height: 0; position: relative; padding: 10px; flex: 0 0 auto; }
          .arcova-sidebar-content { flex: 0 0 auto; overflow: visible; }
          .arcova-brand { margin-bottom: 14px; padding-bottom: 12px; }
          .arcova-nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
          .arcova-nav-link { padding: 10px 8px; min-height: 44px; }
          .arcova-nav-label { gap: 7px; }
          .arcova-nav-label span { font-size: .76rem; }
          .arcova-nav-arrow { display: none; }
          .arcova-sidebar-footer { margin-top: 12px; }
        }
      `}</style>
    </aside>
  );
}

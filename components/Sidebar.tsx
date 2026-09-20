import React, { useState } from 'react';
import {
  LayoutDashboard, Users, CalendarClock, Building2, ListTodo, Megaphone,
  Trophy, ShieldCheck, UserCog, GitBranch, Briefcase, BarChart3,
  ChevronLeft, FolderKanban, Menu, X
} from 'lucide-react';

const navItems = [
  { name: 'الرئيسية', view: 'overview', icon: LayoutDashboard },
  { name: 'العملاء / Customer 360', view: 'leads', icon: Users },
  { name: 'مجلدات العملاء', view: 'folders', route: '/folders', icon: FolderKanban },
  { name: 'Pipeline', view: 'pipeline', icon: GitBranch },
  { name: 'المتابعات', view: 'reminders', icon: CalendarClock },
  { name: 'المشاريع والوحدات', view: 'projects', icon: Building2 },
  { name: 'المهام', view: 'tasks', icon: ListTodo },
  { name: 'الحملات', view: 'campaigns', icon: Megaphone },
  { name: 'الصفقات والحجوزات', view: 'operations', icon: Briefcase },
  { name: 'التقارير', view: 'reports', icon: BarChart3 },
  { name: 'أداء المبيعات', view: 'leaderboard', icon: Trophy },
  { name: 'سجل التدقيق', view: 'audit', icon: ShieldCheck },
  { name: 'فريق العمل والصلاحيات', view: 'team', icon: UserCog },
];

export default function Sidebar({ activeView = 'overview', onNavigate, visibleViews = navItems.map((item) => item.view) }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = navItems.filter((item) => item.route || visibleViews.includes(item.view));

  return (
    <aside className={`arcova-sidebar ${mobileOpen ? 'mobile-open' : ''}`} dir="rtl">
      <div className="arcova-top">
        <div className="arcova-brand">
          <div className="arcova-brand-mark">A</div>
          <div>
            <div className="arcova-brand-name">ARCOVA</div>
            <div className="arcova-brand-subtitle">REAL ESTATE CRM</div>
          </div>
        </div>
        <button className="mobile-toggle" type="button" onClick={() => setMobileOpen((v) => !v)} aria-label="القائمة">
          {mobileOpen ? <X size={22}/> : <Menu size={22}/>}
        </button>
      </div>

      <div className="arcova-sidebar-content">
        <div className="arcova-menu-title">القائمة الرئيسية</div>
        <nav className="arcova-nav" aria-label="القائمة الرئيسية">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.view;
            return (
              <a
                key={item.view}
                href={item.route || `#${item.view}`}
                className={`arcova-nav-link ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={(event) => {
                  if (item.route) {
                    event.preventDefault();
                    window.location.assign(item.route);
                  } else {
                    event.preventDefault();
                    onNavigate?.(item.view);
                    window.location.hash = item.view;
                  }
                  setMobileOpen(false);
                }}
              >
                <span className="arcova-nav-label"><Icon size={19}/><span>{item.name}</span></span>
                <ChevronLeft size={16} className="arcova-nav-arrow"/>
              </a>
            );
          })}
        </nav>
      </div>

      <div className="arcova-sidebar-footer">
        <div className="arcova-footer-title">ARCOVA CRM</div>
        <div className="arcova-footer-text">نظام إدارة العملاء والعقارات</div>
      </div>

      <style jsx>{`
        .arcova-sidebar{isolation:isolate;width:250px;min-width:250px;height:100vh;position:sticky;top:0;display:flex;flex-direction:column;background:#020617;border-left:1px solid #1e293b;padding:16px;color:#fff;z-index:40;flex:0 0 250px}
        .arcova-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
        .arcova-brand{margin-bottom:18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #1e293b;padding:8px 8px 18px;flex:1}
        .arcova-brand-mark{width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:12px;border:1px solid rgba(251,191,36,.7);background:linear-gradient(135deg,#fcd34d,#d97706);font-size:1.2rem;font-weight:800;color:#020617;flex-shrink:0}
        .arcova-brand-name{font-size:1rem;font-weight:800;letter-spacing:.18em;color:#fcd34d}.arcova-brand-subtitle{margin-top:2px;font-size:.6rem;font-weight:600;letter-spacing:.16em;color:#94a3b8}
        .mobile-toggle{display:none;background:#111827;color:#fbbf24;border:1px solid #334155;border-radius:10px;width:44px;height:44px;align-items:center;justify-content:center}
        .arcova-sidebar-content{min-height:0;flex:1;overflow-y:auto;overflow-x:hidden}.arcova-menu-title{margin-bottom:10px;padding:0 12px;font-size:.67rem;font-weight:700;color:#64748b}
        .arcova-nav{display:flex;flex-direction:column;gap:7px}.arcova-nav-link{display:flex;align-items:center;justify-content:space-between;width:100%;padding:12px;border-radius:11px;color:#cbd5e1;background:transparent;text-decoration:none;transition:.18s ease}
        .arcova-nav-link:hover{background:#0f172a;color:#fff;transform:translateX(-2px)}.arcova-nav-link.active{background:linear-gradient(135deg,#fcd34d,#f59e0b);color:#020617;box-shadow:0 8px 22px rgba(245,158,11,.14)}
        .arcova-nav-label{display:flex;align-items:center;gap:11px;min-width:0}.arcova-nav-label span{white-space:nowrap;font-size:.88rem}.arcova-nav-arrow{opacity:.45;flex-shrink:0}.arcova-nav-link.active .arcova-nav-arrow{opacity:.9}
        .arcova-sidebar-footer{margin-top:12px;flex-shrink:0;border-radius:12px;border:1px solid #1e293b;background:rgba(15,23,42,.7);padding:12px;text-align:center}.arcova-footer-title{font-size:.68rem;font-weight:800;letter-spacing:.1em;color:#fcd34d}.arcova-footer-text{margin-top:4px;font-size:.65rem;color:#64748b}
        @media(max-width:768px){
          .arcova-sidebar{position:relative;width:100%!important;min-width:0!important;height:auto;min-height:0;padding:10px 12px;flex:0 0 auto;border-left:0;border-bottom:1px solid #1e293b}
          .arcova-top{width:100%}.arcova-brand{margin:0;border:0;padding:4px 0}.arcova-brand-mark{width:38px;height:38px}.mobile-toggle{display:flex}
          .arcova-sidebar-content,.arcova-sidebar-footer{display:none}.arcova-sidebar.mobile-open .arcova-sidebar-content{display:block;margin-top:10px;max-height:70vh;overflow-y:auto}.arcova-sidebar.mobile-open .arcova-sidebar-footer{display:block}
          .arcova-nav{display:grid;grid-template-columns:1fr 1fr;gap:8px}.arcova-nav-link{min-height:48px;padding:10px}.arcova-nav-label span{font-size:.78rem;overflow:hidden;text-overflow:ellipsis}.arcova-nav-arrow{display:none}
        }
      `}</style>
    </aside>
  );
}

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  Users,
  Building2,
  Calculator,
  BadgeDollarSign,
  Settings,
  ChevronLeft,
} from 'lucide-react';

const navItems = [
  { name: 'الرئيسية', view: 'overview', icon: LayoutDashboard },
  { name: 'العملاء والطلبات', view: 'leads', icon: Users },
  { name: 'الوحدات والمشاريع', view: 'properties', icon: Building2 },
  { name: 'حاسبة الأقساط', view: 'calculator', icon: Calculator },
  { name: 'المبيعات والصفقات', view: 'sales', icon: BadgeDollarSign },
  { name: 'الإعدادات والصلاحيات', view: 'settings', icon: Settings },
];

export default function Sidebar() {
  const router = useRouter();
  const activeView = typeof router.query.view === 'string' ? router.query.view : 'overview';

  return (
    <aside dir="rtl" className="flex min-h-screen w-64 shrink-0 flex-col justify-between border-l border-slate-800 bg-slate-950 p-4 text-white shadow-xl">
      <div>
        <div className="mb-8 flex items-center gap-3 border-b border-slate-800 px-2 pb-5 pt-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/70 bg-gradient-to-br from-amber-300 to-amber-600 text-xl font-bold text-slate-950 shadow-lg shadow-amber-500/10">A</div>
          <div>
            <div className="text-base font-bold tracking-[0.18em] text-amber-300">ARCOVA</div>
            <div className="mt-0.5 text-[10px] font-medium tracking-[0.2em] text-slate-400">REAL ESTATE CRM</div>
          </div>
        </div>

        <div className="mb-3 px-3 text-[10px] font-semibold tracking-widest text-slate-500">القائمة الرئيسية</div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.view;
            return (
              <Link key={item.view} href={{ pathname: '/dashboard', query: { view: item.view } }} className={`group flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 ${isActive ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/15' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                <span className="flex items-center gap-3"><Icon className="h-[18px] w-[18px]" /><span>{item.name}</span></span>
                <ChevronLeft className={`h-4 w-4 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`} />
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3 text-center">
        <div className="text-[10px] font-semibold tracking-widest text-amber-300">ARCOVA CRM</div>
        <div className="mt-1 text-[10px] text-slate-500">نظام إدارة العملاء والعقارات</div>
      </div>
    </aside>
  );
}

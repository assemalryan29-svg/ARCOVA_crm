import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Calculator, 
  BadgeDollarSign, 
  Settings 
} from 'lucide-react';

const navItems = [
  { name: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard },
  { name: 'العملاء والطلبات', href: '/dashboard/leads', icon: Users },
  { name: 'الوحدات والمشاريع', href: '/dashboard/properties', icon: Building2 },
  { name: 'حاسبة الأقساط', href: '/dashboard/calculator', icon: Calculator },
  { name: 'المبيعات والصفقات', href: '/dashboard/sales', icon: BadgeDollarSign },
  { name: 'الإعدادات والصلاحيات', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar() {
  const router = useRouter();

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-slate-800">
          <div className="bg-blue-600 p-2 rounded-lg font-bold text-xl">A</div>
          <span className="font-bold text-lg tracking-wide">ARCOVA CRM</span>
        </div>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = router.pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

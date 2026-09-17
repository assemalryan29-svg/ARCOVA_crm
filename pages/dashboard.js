import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Users, CheckCircle, Building2, 
  RefreshCw, Download, Calendar, Filter, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';

export default function ExecutiveDashboard({ data, loading, onRefresh }) {
  const [timeRange, setTimeRange] = useState('this_month');

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 font-sans dir-rtl">
      {/* 1. Header & Top Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">نظام إدارة العمليات والتحليلات</h1>
          <p className="text-sm text-slate-500 mt-1">متابعة فورية للأداء، المبيعات، والأنشطة اليومية</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-medium text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-transparent border-none focus:outline-none cursor-pointer"
            >
              <option value="today">اليوم</option>
              <option value="this_week">هذا الأسبوع</option>
              <option value="this_month">هذا الشهر</option>

            </select>
          </div>

          <button 
            onClick={onRefresh}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all">
            <Download className="w-3.5 h-3.5" />
            تصدير تقرير
          </button>
        </div>
      </div>

      {/* 2. KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {/* Card 1: Leads */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">إجمالي العملاء</span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{data?.leadsCount || 0}</span>
            <span className="flex items-center text-xs font-bold text-emerald-600">
              <ArrowUpRight className="w-3.5 h-3.5" /> +12%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">مقارنة بالفترة السابقة</p>
        </div>

        {/* Card 2: Sales / Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">المبيعات المحققة</span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{data?.salesTotal || '0'} ج.م</span>
            <span className="flex items-center text-xs font-bold text-emerald-600">
              <ArrowUpRight className="w-3.5 h-3.5" /> +8%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">تدرج مستمر في الهدف</p>
        </div>

        {/* Card 3: Tasks */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">المهام المكتملة</span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{data?.tasksCount || 0}</span>
            <span className="flex items-center text-xs font-bold text-rose-500">
              <ArrowDownRight className="w-3.5 h-3.5" /> -3%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">يحتاج متابعة فورية</p>
        </div>

        {/* Card 4: Units */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">الوحدات المتاحة</span>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{data?.unitsCount || 0}</span>
            <span className="text-xs font-medium text-slate-500">من أصل {data?.totalUnits || 0}</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">نسبة إشغال ممتازة</p>
        </div>
      </div>

      {/* 3. Main Operational Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left/Main Column: Detailed Data Tabs */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800">نظرة عامة على الجداول والعمليات</h2>
            <button className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
              <Filter className="w-3.5 h-3.5" /> تصفية تقدمية
            </button>
          </div>

          {/* محتوى الجداول ينزل هنا */}
          <div className="text-slate-500 text-sm text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            [قسم عرض جداول المهام والعملاء والوحدات بشكل مبوب]
          </div>
        </div>

        {/* Right Column: Recent Activity & Logs */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 pb-4 border-b border-slate-100">سجل النشاطات المباشر</h2>
          <div className="space-y-4">
            {/* نموذج لبند في سجل النشاطات */}
            <div className="flex items-start gap-3 text-xs">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"></div>
              <div>
                <p className="font-semibold text-slate-800">تم إضافة عميل جديد بواسطة المبيعات</p>
                <p className="text-slate-400 mt-0.5">منذ 10 دقائق</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


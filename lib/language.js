import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

const LanguageContext = createContext(null);

export const translations = {
  ar: {
    menu: 'القائمة الرئيسية', dashboard: 'الرئيسية', customers: 'العملاء / Customer 360', folders: 'مجلدات العملاء', addEmployee: 'إضافة موظف', pipeline: 'مراحل الصفقات', followups: 'المتابعات', projects: 'المشاريع والوحدات', tasks: 'المهام', campaigns: 'الحملات', operations: 'الصفقات والحجوزات', reports: 'التقارير', leaderboard: 'أداء المبيعات', audit: 'سجل التدقيق', duplicates: 'مراجعة العملاء المكررين', team: 'فريق العمل والصلاحيات', settings: 'الإعدادات', system: 'نظام إدارة العملاء والعقارات',
    login: 'تسجيل الدخول', logout: 'تسجيل الخروج', back: 'العودة', save: 'حفظ', cancel: 'إلغاء', close: 'إغلاق', edit: 'تعديل', delete: 'حذف', add: 'إضافة', update: 'تحديث', search: 'بحث', filter: 'فلترة', refresh: 'تحديث البيانات', loading: 'جاري التحميل...', processing: 'جاري المعالجة...', confirm: 'تأكيد', yes: 'نعم', no: 'لا', actions: 'الإجراءات', details: 'التفاصيل', status: 'الحالة', date: 'التاريخ', notes: 'ملاحظات', name: 'الاسم', email: 'البريد الإلكتروني', phone: 'رقم الهاتف', owner: 'المسؤول', source: 'المصدر', project: 'المشروع', unit: 'الوحدة', budget: 'الميزانية', location: 'الموقع', type: 'النوع', amount: 'المبلغ', total: 'الإجمالي', paid: 'المدفوع', remaining: 'المتبقي', dueDate: 'تاريخ الاستحقاق', payment: 'الدفعة', payments: 'المدفوعات', installment: 'القسط', installments: 'الأقساط', deal: 'الصفقة', deals: 'الصفقات', reservation: 'الحجز', reservations: 'الحجوزات', customer: 'العميل', customersTitle: 'إدارة العملاء', customer360: 'ملف العميل الكامل', timeline: 'السجل الزمني', tasksTitle: 'إدارة المهام', addTask: 'إضافة مهمة', addCustomer: 'إضافة عميل', editCustomer: 'تعديل العميل', deleteCustomer: 'حذف العميل', deleteTask: 'حذف المهمة', deleteConfirm: 'هل أنت متأكد من الحذف؟ لا يمكن التراجع عن هذا الإجراء.', language: 'اللغة', systemLanguage: 'لغة النظام', arabic: 'العربية', english: 'English', saveLanguage: 'حفظ اللغة', changePassword: 'تغيير كلمة المرور', newPassword: 'كلمة المرور الجديدة', confirmPassword: 'تأكيد كلمة المرور', passwordMin: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.', passwordsMismatch: 'تأكيد كلمة المرور غير مطابق.', saved: 'تم الحفظ بنجاح.', deleted: 'تم الحذف بنجاح.', errorGeneric: 'حدث خطأ غير متوقع. حاول مرة أخرى.', noData: 'لا توجد بيانات لعرضها.', accessDenied: 'ليس لديك صلاحية لتنفيذ هذا الإجراء.',
    newLead: 'عميل جديد', contacted: 'تم الاتصال', interested: 'مهتم', meetingSet: 'تم تحديد موعد', closedWon: 'تم التعاقد', lost: 'غير مهتم', available: 'متاح', reserved: 'محجوز', sold: 'مباع', active: 'نشط', inactive: 'غير نشط', pending: 'قيد الانتظار', completed: 'مكتمل', overdue: 'متأخر'
  },
  en: {
    menu: 'Main menu', dashboard: 'Dashboard', customers: 'Customers / Customer 360', folders: 'Customer folders', addEmployee: 'Add employee', pipeline: 'Deal pipeline', followups: 'Follow-ups', projects: 'Projects & units', tasks: 'Tasks', campaigns: 'Campaigns', operations: 'Deals & reservations', reports: 'Reports', leaderboard: 'Sales performance', audit: 'Audit log', duplicates: 'Duplicate review', team: 'Team & permissions', settings: 'Settings', system: 'Customer and real-estate management system',
    login: 'Sign in', logout: 'Sign out', back: 'Back', save: 'Save', cancel: 'Cancel', close: 'Close', edit: 'Edit', delete: 'Delete', add: 'Add', update: 'Update', search: 'Search', filter: 'Filter', refresh: 'Refresh data', loading: 'Loading...', processing: 'Processing...', confirm: 'Confirm', yes: 'Yes', no: 'No', actions: 'Actions', details: 'Details', status: 'Status', date: 'Date', notes: 'Notes', name: 'Name', email: 'Email', phone: 'Phone', owner: 'Owner', source: 'Source', project: 'Project', unit: 'Unit', budget: 'Budget', location: 'Location', type: 'Type', amount: 'Amount', total: 'Total', paid: 'Paid', remaining: 'Remaining', dueDate: 'Due date', payment: 'Payment', payments: 'Payments', installment: 'Installment', installments: 'Installments', deal: 'Deal', deals: 'Deals', reservation: 'Reservation', reservations: 'Reservations', customer: 'Customer', customersTitle: 'Customer management', customer360: 'Customer 360', timeline: 'Timeline', tasksTitle: 'Task management', addTask: 'Add task', addCustomer: 'Add customer', editCustomer: 'Edit customer', deleteCustomer: 'Delete customer', deleteTask: 'Delete task', deleteConfirm: 'Are you sure you want to delete this record? This action cannot be undone.', language: 'Language', systemLanguage: 'System language', arabic: 'العربية', english: 'English', saveLanguage: 'Save language', changePassword: 'Change password', newPassword: 'New password', confirmPassword: 'Confirm password', passwordMin: 'Password must contain at least 8 characters.', passwordsMismatch: 'Passwords do not match.', saved: 'Saved successfully.', deleted: 'Deleted successfully.', errorGeneric: 'An unexpected error occurred. Please try again.', noData: 'No data to display.', accessDenied: 'You do not have permission to perform this action.',
    newLead: 'New lead', contacted: 'Contacted', interested: 'Interested', meetingSet: 'Meeting set', closedWon: 'Closed won', lost: 'Not interested', available: 'Available', reserved: 'Reserved', sold: 'Sold', active: 'Active', inactive: 'Inactive', pending: 'Pending', completed: 'Completed', overdue: 'Overdue'
  }
};

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState('ar');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const local = typeof window !== 'undefined' ? window.localStorage.getItem('arcova-language') : null;
      const { data } = await supabase.auth.getSession();
      let next = local === 'en' ? 'en' : 'ar';
      if (data?.session?.user?.id) {
        const { data: pref } = await supabase.from('user_preferences').select('value').eq('user_id', data.session.user.id).eq('key', 'language').maybeSingle();
        if (pref?.value === 'en' || pref?.value === 'ar') next = pref.value;
      }
      if (active) { setLanguageState(next); setReady(true); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.body.dataset.arcovaLanguage = language;
  }, [language]);

  const setLanguage = async (next) => {
    const normalized = next === 'en' ? 'en' : 'ar';
    setLanguageState(normalized);
    if (typeof window !== 'undefined') window.localStorage.setItem('arcova-language', normalized);
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user?.id) await supabase.from('user_preferences').upsert({ user_id: data.session.user.id, key: 'language', value: normalized }, { onConflict: 'user_id,key' });
  };

  const value = useMemo(() => ({ language, setLanguage, ready, isArabic: language === 'ar', t: (key) => translations[language]?.[key] || translations.ar[key] || key }), [language, ready]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}

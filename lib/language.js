import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

const LanguageContext = createContext(null);

export const translations = {
  ar: { menu: 'القائمة الرئيسية', dashboard: 'الرئيسية', customers: 'العملاء / Customer 360', folders: 'مجلدات العملاء', addEmployee: 'إضافة موظف', pipeline: 'مراحل الصفقات', followups: 'المتابعات', projects: 'المشاريع والوحدات', tasks: 'المهام', campaigns: 'الحملات', operations: 'الصفقات والحجوزات', reports: 'التقارير', leaderboard: 'أداء المبيعات', audit: 'سجل التدقيق', team: 'فريق العمل والصلاحيات', settings: 'الإعدادات', system: 'نظام إدارة العملاء والعقارات' },
  en: { menu: 'Main menu', dashboard: 'Dashboard', customers: 'Customers / Customer 360', folders: 'Customer folders', addEmployee: 'Add employee', pipeline: 'Deal pipeline', followups: 'Follow-ups', projects: 'Projects & units', tasks: 'Tasks', campaigns: 'Campaigns', operations: 'Deals & reservations', reports: 'Reports', leaderboard: 'Sales performance', audit: 'Audit log', team: 'Team & permissions', settings: 'Settings', system: 'Customer and real-estate management system' }
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

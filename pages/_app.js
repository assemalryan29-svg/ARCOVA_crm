import { useEffect } from 'react';
import { useRouter } from 'next/router';

const LEGACY_NAV_LABELS = [
  'الرئيسية', 'العملاء', 'Customer 360', 'Pipeline', 'المتابعات', 'المشاريع والوحدات',
  'المهام', 'الحملات', 'الصفقات والحجوزات', 'التقارير', 'أداء المبيعات', 'سجل التدقيق', 'فريق العمل'
];

function removeLegacyCenterNavigation() {
  if (typeof document === 'undefined') return;
  const sidebar = '.arcova-sidebar';
  document.querySelectorAll('button, a').forEach((element) => {
    if (element.closest(sidebar)) return;
    const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || !LEGACY_NAV_LABELS.some((label) => text === label || text.startsWith(`${label} `) || text.includes(`${label} `))) return;
    const parent = element.parentElement;
    const looksLikeLegacyButton = element.tagName === 'BUTTON' || element.getAttribute('href')?.startsWith('#');
    if (looksLikeLegacyButton) {
      element.style.setProperty('display', 'none', 'important');
      element.setAttribute('aria-hidden', 'true');
    }
    if (parent && parent.children.length <= 2 && !parent.closest('header')) {
      const parentText = (parent.textContent || '').replace(/\s+/g, ' ').trim();
      if (LEGACY_NAV_LABELS.some((label) => parentText === label || parentText.startsWith(`${label} `))) {
        parent.style.setProperty('display', 'none', 'important');
      }
    }
  });
}

export default function App({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => console.error('ARCOVA service worker registration failed:', error));
    }

    const enableNotificationMode = () => {
      const audioButton = Array.from(document.querySelectorAll('button')).find((button) => (button.textContent || '').includes('تفعيل الصوت'));
      if (audioButton) audioButton.click();
    };

    const cleanPage = () => {
      enableNotificationMode();
      removeLegacyCenterNavigation();
    };

    const observer = new MutationObserver(cleanPage);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setTimeout(cleanPage, 700);
    const unlockAudio = () => enableNotificationMode();
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  return <><Component {...pageProps} />{router.pathname === '/dashboard' && <a href="/folders" style={{ position: 'fixed', left: 14, bottom: 14, zIndex: 2000, background: '#fbbf24', color: '#0c0f17', border: '1px solid #f59e0b', borderRadius: 12, padding: '10px 14px', fontWeight: 700, textDecoration: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.3)' }}>📁 مجلدات العملاء</a>}</>;
}

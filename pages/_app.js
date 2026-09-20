import { useEffect } from 'react';
import { useRouter } from 'next/router';

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
    const observer = new MutationObserver(() => enableNotificationMode());
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setTimeout(enableNotificationMode, 700);
    const unlockAudio = () => enableNotificationMode();
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => { window.clearTimeout(timer); observer.disconnect(); window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', unlockAudio); };
  }, []);

  return <><Component {...pageProps} />{router.pathname === '/dashboard' && <a href="/folders" style={{ position: 'fixed', left: 14, bottom: 14, zIndex: 2000, background: '#fbbf24', color: '#0c0f17', border: '1px solid #f59e0b', borderRadius: 12, padding: '10px 14px', fontWeight: 700, textDecoration: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.3)' }}>📁 مجلدات العملاء</a>}</>;
}

import { useEffect } from 'react';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('ARCOVA service worker registration failed:', error);
      });
    }

    // Keep notification mode enabled after login. Browsers may block audible
    // playback until the first real user interaction, so retry on first touch.
    const enableNotificationMode = () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const audioButton = buttons.find((button) =>
        (button.textContent || '').includes('تفعيل الصوت')
      );
      if (audioButton) audioButton.click();
    };

    const observer = new MutationObserver(() => enableNotificationMode());
    observer.observe(document.body, { childList: true, subtree: true });
    const initialTimer = window.setTimeout(enableNotificationMode, 700);
    const unlockAudio = () => {
      enableNotificationMode();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    return () => {
      window.clearTimeout(initialTimer);
      observer.disconnect();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  return <Component {...pageProps} />;
}

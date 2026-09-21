import { useEffect } from 'react';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => console.error('ARCOVA service worker registration failed:', error));
  }, []);

  return <Component {...pageProps} />;
}

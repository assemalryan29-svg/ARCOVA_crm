import { useEffect } from 'react';
import '../styles/arcova-theme.css';
import '../styles/arcova-dashboard-theme.css';
import '../styles/arcova-overrides.css';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((error) => console.error('ARCOVA service worker registration failed:', error));
  }, []);
  return <Component {...pageProps} />;
}

import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="ar" dir="rtl">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0c0f17" />
        <meta name="application-name" content="ARCOVA CRM" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" />
        <style>{`
          html, body { margin: 0; padding: 0; width: 100%; min-width: 0; overflow-x: hidden; }
          *, *::before, *::after { box-sizing: border-box; }
          button, input, select, textarea { max-width: 100%; font-family: inherit; }
          button { touch-action: manipulation; -webkit-tap-highlight-color: transparent; min-height: 40px; border-radius: 10px !important; transition: transform .18s ease, filter .18s ease, box-shadow .18s ease; }
          button:hover { filter: brightness(1.08); transform: translateY(-1px); }
          button:active { transform: translateY(0); }
          button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid #fbbf24; outline-offset: 2px; }

          @media (max-width: 768px) {
            .arcova-dashboard-content > header { padding: 12px !important; gap: 10px !important; flex-wrap: wrap !important; }
            .arcova-dashboard-content > header > div { max-width: 100%; min-width: 0; flex-wrap: wrap; }
            .arcova-dashboard-content main { padding: 12px !important; width: 100% !important; min-width: 0 !important; max-width: 100vw !important; overflow-x: hidden !important; }
            .arcova-dashboard-content main table { width: 100%; max-width: 100%; min-width: 0 !important; table-layout: auto; }
            .arcova-dashboard-content main > div { max-width: 100%; min-width: 0; }
            .arcova-dashboard-content input, .arcova-dashboard-content select, .arcova-dashboard-content textarea { min-width: 0 !important; width: 100%; }
          }
        `}</style>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

import './globals.css';

export const metadata = {
  title: 'Sonyria — Studio de chansons',
  description: 'Colle tes paroles : mélodies, accords, beats, enregistrement, karaoké et vidéoclips.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Sonyria', statusBarStyle: 'black-translucent' },
};
export const viewport = { themeColor: '#05040b', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" />
        {/* Installation PWA : capter l'événement dès le chargement, sans bloquer la bannière native de Chrome */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('beforeinstallprompt', function (e) { window.__bip = e; window.dispatchEvent(new Event('sonyria-bip')); });
          window.addEventListener('appinstalled', function () { window.__bip = null; window.__installed = true; window.dispatchEvent(new Event('sonyria-bip')); });
          if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); }); }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

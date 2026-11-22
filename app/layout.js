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
          // si l'app ne démarre pas (réseau, ancienne version en cache), bouton pour réparer
          window.__sonyriaRepair = function () { try { (navigator.serviceWorker ? navigator.serviceWorker.getRegistrations() : Promise.resolve([])).then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }).then(function () { return window.caches ? caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }) : 0; }).then(function () { location.reload(); }); } catch (e) { location.reload(); } };
          setTimeout(function () { if (window.__sonyriaReady) return; var en = (localStorage.getItem('sonyria-lang') || navigator.language || 'fr').slice(0, 2) === 'en'; var b = document.createElement('button'); b.textContent = en ? 'Sonyria won’t open? Tap to repair' : 'Sonyria ne s’ouvre pas ? Touche ici pour réparer'; b.style.cssText = 'position:fixed;left:50%;bottom:calc(30px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;padding:14px 20px;border-radius:14px;border:0;font:700 15px sans-serif;color:#fff;background:linear-gradient(90deg,#22d3ee,#a855f7,#fb923c);box-shadow:0 8px 30px rgba(0,0,0,.5)'; b.onclick = window.__sonyriaRepair; document.body.appendChild(b); }, 9000);
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

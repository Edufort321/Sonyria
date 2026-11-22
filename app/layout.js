import './globals.css';

export const metadata = {
  title: 'Sonyra — Studio de chansons',
  description: 'Colle tes paroles : mélodies, accords, beats, enregistrement, karaoké et vidéoclips.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Sonyra', statusBarStyle: 'black-translucent' },
};
export const viewport = { themeColor: '#05040b', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}

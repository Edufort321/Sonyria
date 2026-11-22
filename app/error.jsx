'use client';
// filet de sécurité : si une erreur bloque l'app, on peut réessayer ou réparer sans perdre ses chansons
export default function Error({ error, reset }) {
  const en = typeof navigator !== 'undefined' && ((typeof localStorage !== 'undefined' && localStorage.getItem('sonyria-lang')) || navigator.language || 'fr').slice(0, 2) === 'en';
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#05040b', color: '#fff', fontFamily: 'Sora, sans-serif', textAlign: 'center' }}>
      <div style={{ maxWidth: 420 }}>
        <img src="/logo.png" alt="" style={{ width: 90, height: 90, borderRadius: 22, marginBottom: 16 }} />
        <h2>{en ? 'Something went wrong' : 'Oups, un problème est survenu'}</h2>
        <p style={{ opacity: 0.75, fontSize: 14 }}>{en ? 'Your songs are safe on this device.' : 'Tes chansons sont en sécurité sur cet appareil.'}</p>
        <p style={{ opacity: 0.5, fontSize: 11, wordBreak: 'break-word' }}>{String(error?.message || '')}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          <button onClick={() => reset()} style={{ padding: '12px 18px', borderRadius: 12, border: 0, fontWeight: 700, background: 'linear-gradient(90deg,#22d3ee,#a855f7)', color: '#fff' }}>{en ? 'Try again' : 'Réessayer'}</button>
          <button onClick={() => { try { localStorage.setItem('sonyria-tab', 'paroles'); } catch (e) {} if (window.__sonyriaRepair) window.__sonyriaRepair(); else location.reload(); }} style={{ padding: '12px 18px', borderRadius: 12, border: '1px solid #555', fontWeight: 700, background: 'transparent', color: '#fff' }}>{en ? 'Repair and reload' : 'Réparer et recharger'}</button>
        </div>
      </div>
    </div>
  );
}

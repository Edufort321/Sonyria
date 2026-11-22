// relais pour récupérer le fichier Pexels sans blocage CORS (seulement les domaines Pexels)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const src = new URL(req.url).searchParams.get('u') || '';
  let host = ''; try { host = new URL(src).hostname; } catch (e) {}
  if (!/(^|\.)pexels\.com$/.test(host)) return new Response('refusé', { status: 400 });
  const r = await fetch(src);
  if (!r.ok || !r.body) return new Response('introuvable', { status: 502 });
  return new Response(r.body, { headers: { 'Content-Type': r.headers.get('content-type') || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' } });
}

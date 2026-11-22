// Sonyria — synchro entre appareils et équipes (Vercel Blob). Chaque espace = empreinte SHA-256 du code de synchro.
// Accès au stockage : jeton BLOB_READ_WRITE_TOKEN, ou connexion OIDC du projet (BLOB_STORE_ID), selon comment le stockage a été relié.
import { list, del, put, get } from '@vercel/blob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const ok = (p) => /^sonyria\/[a-f0-9]{64}\/[\w\-.:]+(\/[\w\-.:%]+)*$/.test(p);
const H = { 'Cache-Control': 'no-store' };
const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN || Object.entries(process.env).find(([k, v]) => /READ_WRITE_TOKEN$/.test(k) && String(v).startsWith('vercel_blob_rw_'))?.[1] || undefined;
const auth = () => (TOKEN() ? { token: TOKEN() } : {});
const isReady = () => !!(TOKEN() || process.env.BLOB_STORE_ID);

export async function GET(req) {
  const u = new URL(req.url), ready = isReady();
  const space = u.searchParams.get('space') || '';
  if (u.searchParams.get('selftest')) {
    try {
      const p = 'sonyria/' + '0'.repeat(64) + '/selftest.txt';
      const b = await put(p, 'ok ' + Date.now(), { access: 'private', addRandomSuffix: false, allowOverwrite: true, ...auth() });
      const g = await get(p, { access: 'private', useCache: false, ...auth() }); const txt = g ? await new Response(g.stream).text() : 'absent';
      await del(b.url, auth());
      return Response.json({ ok: true, read: txt.startsWith('ok') }, { headers: H });
    } catch (e) { return Response.json({ ok: false, error: String(e.message || e) }, { headers: H }); }
  }
  const file = u.searchParams.get('file');
  if (file) {
    if (!ok(file)) return new Response('refusé', { status: 400 });
    try { const g = await get(file, { access: 'private', useCache: false, ...auth() }); if (!g) return new Response('absent', { status: 404 }); return new Response(g.stream, { headers: { 'Content-Type': g.blob?.contentType || 'application/octet-stream', ...H } }); }
    catch (e) { return new Response(String(e.message || e), { status: 500 }); }
  }
  if (!space) return Response.json({ ready, mode: TOKEN() ? 'token' : process.env.BLOB_STORE_ID ? 'oidc' : 'none' }, { headers: H });
  if (!ready) return Response.json({ ready, error: 'not-configured' }, { status: 503, headers: H });
  if (!/^[a-f0-9]{64}$/.test(space)) return Response.json({ error: 'bad space' }, { status: 400, headers: H });
  try {
    const out = []; let cursor;
    do { const r = await list({ prefix: `sonyria/${space}/`, cursor, limit: 1000, ...auth() }); out.push(...r.blobs.map((b) => ({ p: b.pathname, url: b.url, at: new Date(b.uploadedAt).getTime(), size: b.size }))); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
    return Response.json({ ready, blobs: out }, { headers: H });
  } catch (e) { return Response.json({ error: String(e.message || e) }, { status: 500, headers: H }); }
}

// envoi d'un morceau (≤ 4 Mo) : le client découpe les gros fichiers
export async function POST(req) {
  const path = new URL(req.url).searchParams.get('path') || '';
  if (!ok(path)) return Response.json({ error: 'chemin refusé' }, { status: 400, headers: H });
  if (!isReady()) return Response.json({ error: 'not-configured' }, { status: 503, headers: H });
  try {
    const body = await req.arrayBuffer();
    if (body.byteLength > 4.3 * 1024 * 1024) return Response.json({ error: 'trop gros' }, { status: 413, headers: H });
    const b = await put(path, Buffer.from(body), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: req.headers.get('content-type') || 'application/octet-stream', cacheControlMaxAge: 60, ...auth() });
    return Response.json({ url: b.url }, { headers: H });
  } catch (e) { return Response.json({ error: String(e.message || e) }, { status: 500, headers: H }); }
}

export async function DELETE(req) {
  const { urls = [] } = await req.json().catch(() => ({}));
  const good = urls.filter((x) => { try { return ok(new URL(x).pathname.slice(1)); } catch (e) { return false; } });
  try { if (good.length) await del(good, auth()); } catch (e) { return Response.json({ error: String(e.message || e) }, { status: 500, headers: H }); }
  return Response.json({ deleted: good.length }, { headers: H });
}

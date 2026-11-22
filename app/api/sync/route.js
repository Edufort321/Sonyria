// Sonyria — synchro entre appareils et équipes (Vercel Blob). Chaque espace = empreinte SHA-256 du code de synchro.
import { handleUpload } from '@vercel/blob/client';
import { list, del } from '@vercel/blob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ok = (p) => /^sonyria\/[a-f0-9]{64}\/[\w\-.:]+(\/[\w\-.:%]+)*$/.test(p);
const H = { 'Cache-Control': 'no-store' };

export async function GET(req) {
  const ready = !!process.env.BLOB_READ_WRITE_TOKEN;
  const space = new URL(req.url).searchParams.get('space') || '';
  if (!space) return Response.json({ ready }, { headers: H });
  if (!ready) return Response.json({ ready, error: 'not-configured' }, { status: 503, headers: H });
  if (!/^[a-f0-9]{64}$/.test(space)) return Response.json({ error: 'bad space' }, { status: 400, headers: H });
  const out = []; let cursor;
  do { const r = await list({ prefix: `sonyria/${space}/`, cursor, limit: 1000 }); out.push(...r.blobs.map((b) => ({ p: b.pathname, url: b.url, at: new Date(b.uploadedAt).getTime(), size: b.size }))); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
  return Response.json({ ready, blobs: out }, { headers: H });
}

export async function POST(req) {
  const body = await req.json();
  try {
    const r = await handleUpload({
      body, request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!ok(pathname)) throw new Error('chemin refusé');
        return { addRandomSuffix: false, allowOverwrite: true, maximumSizeInBytes: 300 * 1024 * 1024, cacheControlMaxAge: 60 };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(r, { headers: H });
  } catch (e) { return Response.json({ error: String(e.message || e) }, { status: 400, headers: H }); }
}

export async function DELETE(req) {
  const { urls = [] } = await req.json().catch(() => ({}));
  const good = urls.filter((u) => { try { return ok(new URL(u).pathname.slice(1)); } catch (e) { return false; } });
  if (good.length) await del(good);
  return Response.json({ deleted: good.length }, { headers: H });
}

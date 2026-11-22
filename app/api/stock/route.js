// Sonyria — vidéos et photos réelles libres de droits (Pexels). Clé : PEXELS_API_KEY dans Vercel.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const H = { 'Cache-Control': 'no-store' };

export async function GET(req) {
  const key = process.env.PEXELS_API_KEY;
  const u = new URL(req.url), q = (u.searchParams.get('q') || '').slice(0, 80), kind = u.searchParams.get('kind') === 'photo' ? 'photo' : 'video';
  const orient = ['portrait', 'landscape', 'square'].includes(u.searchParams.get('orient')) ? u.searchParams.get('orient') : 'portrait';
  if (!q) return Response.json({ ready: !!key }, { headers: H });
  if (!key) return Response.json({ ready: false, error: 'not-configured' }, { status: 503, headers: H });
  const loc = u.searchParams.get('lang') === 'en' ? 'en-US' : 'fr-FR';
  const api = kind === 'video' ? `https://api.pexels.com/videos/search?locale=${loc}&query=${encodeURIComponent(q)}&orientation=${orient}&per_page=18&size=medium`
    : `https://api.pexels.com/v1/search?locale=${loc}&query=${encodeURIComponent(q)}&orientation=${orient}&per_page=24`;
  const r = await fetch(api, { headers: { Authorization: key } });
  if (!r.ok) return Response.json({ error: 'Pexels ' + r.status }, { status: 502, headers: H });
  const j = await r.json();
  const items = kind === 'video'
    ? (j.videos || []).map((v) => {
        const files = (v.video_files || []).filter((f) => f.file_type === 'video/mp4' && f.width && f.height);
        const best = files.filter((f) => Math.max(f.width, f.height) <= 1920).sort((a, b) => b.width * b.height - a.width * a.height)[0] || files[0];
        return best && { id: v.id, thumb: v.image, url: best.link, w: best.width, h: best.height, dur: v.duration, by: v.user?.name || '', page: v.url };
      }).filter(Boolean)
    : (j.photos || []).map((p) => ({ id: p.id, thumb: p.src?.medium, url: p.src?.large2x || p.src?.original, w: p.width, h: p.height, by: p.photographer || '', page: p.url }));
  return Response.json({ ready: true, items }, { headers: H });
}

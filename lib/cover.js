// Sonyria — pochette d'album : fond (thème animé figé ou photo), titre, artiste, style de texte
import { ClipRenderer, THEMES } from './video';

export const COVER_FONTS = {
  sora: { n: 'Moderne', f: (s) => `800 ${s}px Sora, sans-serif` },
  serif: { n: 'Élégant', f: (s) => `italic 700 ${s}px Georgia, 'Times New Roman', serif` },
  mono: { n: 'Rétro', f: (s) => `700 ${s}px 'JetBrains Mono', monospace` },
  script: { n: 'Manuscrit', f: (s) => `700 ${s}px 'Brush Script MT', 'Segoe Script', cursive` },
  impact: { n: 'Affiche', f: (s) => `900 ${s}px Impact, 'Arial Black', sans-serif` },
};
export const COVER_LAYOUTS = { bas: 'En bas', centre: 'Au centre', haut: 'En haut' };

const key = (album) => 'sonyria-cover:' + (album || '');
export function loadCover(album) { try { return localStorage.getItem(key(album)) || ''; } catch (e) { return ''; } }
export function saveCover(album, url) { try { if (url) localStorage.setItem(key(album), url); else localStorage.removeItem(key(album)); } catch (e) {} }

function wrap(g, text, maxW) {
  const words = String(text || '').split(/\s+/).filter(Boolean); const rows = []; let cur = '';
  words.forEach((w) => { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { rows.push(cur); cur = w; } else cur = t; });
  if (cur) rows.push(cur); return rows.slice(0, 3);
}

export function drawCover(cv, o) {
  const S = 1000; cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#05040b'; g.fillRect(0, 0, S, S);
  if (o.bg === 'photo' && o.photo?.width) {
    const sc = Math.max(S / o.photo.width, S / o.photo.height) * (o.zoom || 1), iw = o.photo.width * sc, ih = o.photo.height * sc;
    g.drawImage(o.photo, (S - iw) / 2, (S - ih) / 2, iw, ih);
  } else {
    const th = THEMES[o.theme] || THEMES.neon;
    const r = new ClipRenderer(cv); r.seed = o.seed || 7; r.setup({ theme: o.theme }, [], null);
    const bg = g.createLinearGradient(0, 0, S, S); bg.addColorStop(0, '#030208'); bg.addColorStop(0.5, th.pal[1] + '30'); bg.addColorStop(1, '#05030c');
    g.fillStyle = bg; g.fillRect(0, 0, S, S);
    try { r[o.theme]?.(g, S, S, o.t ?? 8.4, th.pal, 0.35, 0.3, 0.2, 0.6); } catch (e) {}
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  // voile pour la lisibilité
  const lay = o.layout || 'bas';
  const vg = g.createLinearGradient(0, lay === 'haut' ? S : 0, 0, lay === 'haut' ? 0 : S);
  vg.addColorStop(lay === 'centre' ? 0.2 : 0.45, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.65)');
  if (lay === 'centre') { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, S, S); } else { g.fillStyle = vg; g.fillRect(0, 0, S, S); }
  const F = COVER_FONTS[o.font] || COVER_FONTS.sora;
  const ts = o.font === 'script' ? 120 : 100;
  g.font = F.f(ts); g.textAlign = 'center';
  const rows = wrap(g, o.title, S * 0.84);
  const lh = ts * 1.08, block = rows.length * lh + (o.artist ? 70 : 0);
  let y = lay === 'haut' ? 150 : lay === 'centre' ? S / 2 - block / 2 + ts * 0.8 : S - 90 - block + ts * 0.8;
  g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 24;
  rows.forEach((row) => {
    if (o.color === 'grad') { const gr = g.createLinearGradient(S * 0.15, 0, S * 0.85, 0); gr.addColorStop(0, '#22d3ee'); gr.addColorStop(0.5, '#a855f7'); gr.addColorStop(1, '#fb923c'); g.fillStyle = gr; }
    else g.fillStyle = o.color || '#ffffff';
    g.fillText(row, S / 2, y); y += lh;
  });
  if (o.artist) { g.font = `600 46px Sora, sans-serif`; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(String(o.artist).toUpperCase(), S / 2, y + 14); }
  g.shadowBlur = 0;
  return cv.toDataURL('image/jpeg', 0.86);
}

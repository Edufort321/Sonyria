// Sonyria — vidéoclip animé : rendu canvas réactif au son, paroles karaoké, scénario (IA ou thème)
import { s16 } from './engine';
import { Cutter } from './cutout';

export const THEMES = {
  // Lumières
  neon: { n: 'Néon rétro', c: 'lum', pal: ['#22d3ee', '#a855f7', '#fb923c'] },
  onde: { n: 'Ondes sonores', c: 'lum', pal: ['#22d3ee', '#d946ef', '#fb923c'] },
  bokeh: { n: 'Lumières floues', c: 'lum', pal: ['#fbbf24', '#f472b6', '#60a5fa'] },
  club: { n: 'Club & lasers', c: 'lum', pal: ['#22d3ee', '#d946ef', '#84cc16'] },
  concert: { n: 'Scène de concert', c: 'lum', pal: ['#f59e0b', '#a855f7', '#38bdf8'] },
  feux: { n: 'Feux d’artifice', c: 'lum', pal: ['#f43f5e', '#facc15', '#38bdf8'] },
  // Nature
  coucher: { n: 'Coucher de soleil', c: 'nat', pal: ['#fb923c', '#f43f5e', '#7c3aed'] },
  plage: { n: 'Plage', c: 'nat', pal: ['#38bdf8', '#fde68a', '#fb923c'] },
  ocean: { n: 'Océan', c: 'nat', pal: ['#06b6d4', '#2563eb', '#a7f3d0'] },
  sousmarin: { n: 'Sous l’eau', c: 'nat', pal: ['#0891b2', '#22d3ee', '#a7f3d0'] },
  montagnes: { n: 'Montagnes à l’aube', c: 'nat', pal: ['#fda4af', '#818cf8', '#1e3a8a'] },
  foret: { n: 'Forêt et lucioles', c: 'nat', pal: ['#166534', '#facc15', '#a3e635'] },
  neige: { n: 'Neige', c: 'nat', pal: ['#e0f2fe', '#93c5fd', '#1e3a8a'] },
  desert: { n: 'Désert la nuit', c: 'nat', pal: ['#f59e0b', '#7c2d12', '#312e81'] },
  ciel: { n: 'Ciel et nuages', c: 'nat', pal: ['#38bdf8', '#e0f2fe', '#ffffff'] },
  cerisiers: { n: 'Cerisiers en fleurs', c: 'nat', pal: ['#f9a8d4', '#fbcfe8', '#a78bfa'] },
  aurore: { n: 'Aurore boréale', c: 'nat', pal: ['#34d399', '#22d3ee', '#c084fc'] },
  etoiles: { n: 'Voie lactée', c: 'nat', pal: ['#c7d2fe', '#a78bfa', '#f0abfc'] },
  galaxie: { n: 'Galaxie', c: 'nat', pal: ['#3b82f6', '#a855f7', '#f0abfc'] },
  // Ville
  ville: { n: 'Ville la nuit', c: 'vil', pal: ['#fb923c', '#facc15', '#38bdf8'] },
  skyline: { n: 'Gratte-ciel', c: 'vil', pal: ['#fbbf24', '#38bdf8', '#f472b6'] },
  route: { n: 'Route de nuit', c: 'vil', pal: ['#f87171', '#fde68a', '#60a5fa'] },
  pluie: { n: 'Pluie', c: 'vil', pal: ['#60a5fa', '#94a3b8', '#e0f2fe'] },
  vitre: { n: 'Pluie sur la vitre', c: 'vil', pal: ['#f59e0b', '#38bdf8', '#f472b6'] },
  // Émotions
  amour: { n: 'Amour', c: 'emo', pal: ['#f43f5e', '#f9a8d4', '#fb7185'] },
  chandelles: { n: 'Chandelles', c: 'emo', pal: ['#f59e0b', '#fde68a', '#b45309'] },
  lumiere: { n: 'Rayons de lumière', c: 'emo', pal: ['#fde68a', '#fef3c7', '#93c5fd'] },
  fumee: { n: 'Fumée', c: 'emo', pal: ['#a78bfa', '#94a3b8', '#22d3ee'] },
  feu: { n: 'Feu', c: 'emo', pal: ['#f97316', '#ef4444', '#fde047'] },
  // Fêtes
  noel: { n: 'Noël', c: 'fet', pal: ['#ef4444', '#22c55e', '#fde68a'] },
  halloween: { n: 'Halloween', c: 'fet', pal: ['#f97316', '#7c3aed', '#84cc16'] },
  // Rétro
  vhs: { n: 'Cassette VHS', c: 'old', pal: ['#22d3ee', '#f43f5e', '#facc15'] },
  film: { n: 'Vieux film', c: 'old', pal: ['#d6b98c', '#8b6b3e', '#f5e6c8'] },
  vinyle: { n: 'Vinyle', c: 'ret', pal: ['#f59e0b', '#ef4444', '#fde68a'] },
  orage: { n: 'Orage', c: 'nat', pal: ['#a5b4fc', '#64748b', '#e0e7ff'] },
  automne: { n: 'Automne', c: 'nat', pal: ['#f97316', '#b45309', '#fde047'] },
  lavande: { n: 'Champ de lavande', c: 'nat', pal: ['#a78bfa', '#f9a8d4', '#fde68a'] },
  lac: { n: 'Lac de montagne', c: 'nat', pal: ['#38bdf8', '#a5b4fc', '#fef3c7'] },
  espace: { n: 'Planètes', c: 'nat', pal: ['#f59e0b', '#38bdf8', '#e879f9'] },
  cyberpunk: { n: 'Ville néon sous la pluie', c: 'vil', pal: ['#f0abfc', '#22d3ee', '#facc15'] },
};
export const THEME_CATS = { nat: 'Nature', vil: 'Ville', lum: 'Lumières & scène', emo: 'Émotions', fet: 'Fêtes', ret: 'Rétro' };
// visuel : couleurs (une), effets (plusieurs), spectre (un), texte (un) — séparés du décor
export const LOOKS = { naturel: 'Naturel', vif: 'Couleurs vives', chaud: 'Chaud', froid: 'Froid', pastel: 'Pastel', contraste: 'Contrasté', reve: 'Rêve', nb: 'Noir et blanc', sepia: 'Sépia', duotone: 'Duotone' };
export const OVERLAYS = { vignette: 'Vignette', grain: 'Grain de film', vhs: 'VHS', film: 'Vieux film', fuites: 'Fuites de lumière', flare: 'Reflet d’objectif', bokeh: 'Bokeh', poussiere: 'Poussière dorée', neige: 'Neige', confettis: 'Confettis', coeurs: 'Cœurs', glitch: 'Glitch', cinema: 'Bandes cinéma' };
export const SPECTRA = { cercle: 'Cercle', barres: 'Barres', onde: 'Onde', aucun: 'Aucun' };
export const TEXT_STYLES = { karaoke: 'Karaoké', bounce: 'Rebond', glow: 'Néon lumineux', typewriter: 'Machine à écrire', fade: 'Fondu doux' };

export const FORMATS = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };
export const PLATFORMS = {
  shorts: { n: 'TikTok · Reels · Shorts', f: '9:16' },
  youtube: { n: 'YouTube', f: '16:9' },
  insta: { n: 'Instagram carré', f: '1:1' },
  feed: { n: 'Instagram / Facebook fil', f: '4:5' },
};

const hexA = (h, a) => {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export function defaultScenario(song) {
  const theme = { ballade: 'coucher', pop: 'neon', edm: 'club', lofi: 'vitre', trap: 'skyline', hiphop: 'route', rock: 'concert', folk: 'foret', jazz: 'chandelles', rnb: 'bokeh', reggaeton: 'plage', afro: 'coucher' }[song.style] || (song.mode === 'min' ? 'etoiles' : 'onde');
  return { title: song.title || 'Ma chanson', theme, sections: {}, keywords: [], textStyle: 'karaoke' };
}

export class ClipRenderer {
  constructor(canvas) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.parts = []; this.seed = 1; this.photos = []; this.lastBeat = 0;
  }
  rand() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  setup(scn, photos, video) {
    this.scn = scn; this.photos = photos || []; this.video = video || null;
    this.parts = Array.from({ length: 140 }, () => ({ x: this.rand(), y: this.rand(), z: this.rand(), s: this.rand(), a: this.rand() * 6.28 }));
  }
  // st : temps chanson (s), tl : timeline, song, freq : Uint8Array spectre
  draw(st, tl, song, freq) {
    const { cv, g } = this;
    const W = cv.width, H = cv.height, t = st ?? 0;
    const line = currentLine(tl, song, t);
    const sec = line ? (this.scn.sections?.[line.label] || {}) : {};
    const themeKey = sec.theme || this.scn.theme;
    const th = THEMES[themeKey] || THEMES.neon;
    const pal = sec.palette?.length === 3 ? sec.palette : this.scn.palette?.length === 3 ? this.scn.palette : th.pal;
    let bass = 0, mid = 0, hi = 0;
    if (freq) { for (let i = 1; i < 8; i++) bass += freq[i]; for (let i = 8; i < 60; i++) mid += freq[i]; for (let i = 60; i < 200; i++) hi += freq[i]; bass /= 7 * 255; mid /= 52 * 255; hi /= 140 * 255; }
    const energy = (sec.intensity ?? 0.7) * (0.4 + bass);
    // fond
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#030208'); bg.addColorStop(0.5, hexA(pal[1], 0.18 + bass * 0.15)); bg.addColorStop(1, '#05030c');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // vidéo de fond importée, calée sur le temps de la chanson
    const vd = this.video, vc = song?.clip || {};
    const cut = !!(vd && vc.cutout);
    const full = !!(vd && vc.vMode !== 'fond' && !cut);
    if (vd && !vd.srcObject && vd.readyState >= 2) {
      let target = t - (vc.vOff || 0);
      if (vc.vLoop !== false && vd.duration) target = ((target % vd.duration) + vd.duration) % vd.duration;
      else target = Math.max(0, Math.min(target, (vd.duration || 0.1) - 0.05));
      if (Math.abs(vd.currentTime - target) > 0.4 && !vd.seeking) { try { vd.currentTime = target; } catch (e) {} }
    }
    if (!cut && vd && vd.readyState >= 2 && vd.videoWidth) {
      const sc = Math.max(W / vd.videoWidth, H / vd.videoHeight), iw = vd.videoWidth * sc, ih = vd.videoHeight * sc;
      g.save(); if (vc.mirror) { g.translate(W, 0); g.scale(-1, 1); }
      g.globalAlpha = full ? 1 : 0.7; g.drawImage(vd, (W - iw) / 2, (H - ih) / 2, iw, ih); g.globalAlpha = 1; g.restore();
      const vg = g.createLinearGradient(0, H * (full ? 0.55 : 0.45), 0, H); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, full ? 'rgba(0,0,0,.6)' : 'rgba(0,0,0,.75)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    } else if (this.photos.length) {
      const idx = line ? (line.idx % this.photos.length) : Math.floor(t / 6) % this.photos.length;
      const img = this.photos[idx];
      if (img?.width) {
        const z = 1.08 + 0.06 * Math.sin(t * 0.15 + idx), sc = Math.max(W / img.width, H / img.height) * z;
        const iw = img.width * sc, ih = img.height * sc;
        g.globalAlpha = cut ? 0.95 : 0.55; g.drawImage(img, (W - iw) / 2 + Math.sin(t * 0.1) * 20, (H - ih) / 2 + Math.cos(t * 0.12) * 20, iw, ih); g.globalAlpha = 1;
        const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, cut ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.8)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
      }
    }
    const photoBg = cut && this.photos.length;
    if (full || photoBg) g.globalAlpha = 0.3;
    this[themeKey]?.(g, W, H, t, pal, bass, mid, hi, energy);
    g.globalAlpha = 1;
    // mots-clés flottants (scénario IA)
    const kws = (sec.keywords?.length ? sec.keywords : this.scn.keywords) || [];
    if (kws.length) {
      g.textAlign = 'center';
      kws.slice(0, 6).forEach((k, i) => {
        const x = W * (0.15 + 0.7 * ((i * 0.37 + t * 0.01) % 1)), y = H * (0.15 + 0.5 * ((i * 0.53 + t * 0.006 * (i + 1)) % 1));
        g.font = `600 ${Math.round(W * 0.035)}px Sora, sans-serif`; g.fillStyle = hexA(pal[i % 3], 0.12 + 0.1 * Math.sin(t + i)); g.fillText(k.toUpperCase(), x, y);
      });
    }
    // spectre au choix
    const spec = (song.clip || {}).spectrum || 'cercle';
    if (freq && spec === 'barres') {
      const n = 48, bw = W / n;
      for (let i = 0; i < n; i++) { const v = freq[2 + i * 3] / 255, h = v * H * 0.22; const gr = g.createLinearGradient(0, H * 0.62 - h, 0, H * 0.62); gr.addColorStop(0, hexA(pal[0], 0.9)); gr.addColorStop(1, hexA(pal[1], 0.2)); g.fillStyle = gr; g.fillRect(i * bw + 2, H * 0.62 - h, bw - 4, h); }
    } else if (freq && spec === 'onde') {
      g.strokeStyle = hexA(pal[0], 0.85); g.lineWidth = Math.max(3, W * 0.005); g.shadowColor = pal[0]; g.shadowBlur = 16; g.beginPath();
      for (let i = 0; i <= 96; i++) { const v = freq[2 + i * 2] / 255, x = (i / 96) * W, y = H * 0.42 + Math.sin(i * 0.5 + t * 4) * v * H * 0.06; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); g.shadowBlur = 0;
    } else if (freq && spec === 'cercle') {
      const cx = W / 2, cy = H * 0.4, r0 = Math.min(W, H) * (0.14 + bass * 0.04);
      g.save(); g.translate(cx, cy); g.rotate(t * 0.15);
      for (let i = 0; i < 96; i++) {
        const v = freq[2 + Math.floor(i * 1.6)] / 255, a = (i / 96) * Math.PI * 2;
        g.strokeStyle = hexA(pal[i % 3], 0.5 + v * 0.5); g.lineWidth = Math.max(2, W * 0.004);
        g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * (r0 + v * r0 * 0.9), Math.sin(a) * (r0 + v * r0 * 0.9)); g.stroke();
      }
      g.restore();
      const glow = g.createRadialGradient(cx, cy, 0, cx, cy, r0);
      glow.addColorStop(0, hexA(pal[2], 0.25 + bass * 0.4)); glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, r0, 0, 6.29); g.fill();
    }
    // moi, détouré, entre le fond et les paroles
    if (cut) { if (!this.cutter && typeof document !== 'undefined') this.cutter = new Cutter(); this.cutter?.draw(g, W, H, vd, vc.mirror); }
    // pastille de la pochette qui tourne (style TikTok)
    if (this.cover?.width && (song.clip || {}).disc !== false) {
      const r = Math.min(W, H) * 0.075, cx = W - r * 1.7, cy = H * 0.6;
      g.save(); g.translate(cx, cy); g.rotate(t * 1.1);
      g.fillStyle = '#111'; g.beginPath(); g.arc(0, 0, r * 1.18, 0, 6.29); g.fill();
      g.beginPath(); g.arc(0, 0, r, 0, 6.29); g.clip(); g.drawImage(this.cover, -r, -r, r * 2, r * 2);
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r * 1.18, 0, 6.29); g.stroke();
    }
    // visuel : couleurs et effets
    this.post(g, W, H, t, song, pal, bass);
    // paroles
    this.lyrics(g, W, H, t, tl, song, pal, line);
    // titre
    const introEnd = (tl.lines[0]?.b0 || 0) * 16 * s16(song.bpm);
    if (t < Math.max(3, introEnd)) {
      const a = Math.min(1, t * 1.5) * Math.min(1, (Math.max(3, introEnd) - t) * 1.5);
      g.globalAlpha = Math.max(0, a); g.textAlign = 'center'; g.fillStyle = '#fff';
      g.font = `800 ${Math.round(Math.min(W, H) * 0.075)}px Sora, sans-serif`; g.shadowColor = pal[1]; g.shadowBlur = 30;
      g.fillText(this.scn.title || song.title || '', W / 2, H * 0.72); g.shadowBlur = 0;
      if (song.artist) { g.font = `500 ${Math.round(W * 0.035)}px Sora, sans-serif`; g.fillStyle = pal[0]; g.fillText(song.artist, W / 2, H * 0.72 + W * 0.07); }
      g.globalAlpha = 1;
    }
    g.font = `600 ${Math.round(W * 0.022)}px Sora, sans-serif`; g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,.35)'; g.fillText('Sonyria', W - 20, H - 20);
  }

  lyrics(g, W, H, t, tl, song, pal, line) {
    if (!line) return;
    const d = s16(song.bpm);
    const fs = Math.round(Math.min(W * 0.062, H * 0.05));
    g.font = `700 ${fs}px Sora, sans-serif`;
    const words = line.syl.map((s) => s);
    // découpe en lignes visuelles
    const maxW = W * 0.86;
    const rows = [[]]; let rw = 0;
    words.forEach((s) => { const w = g.measureText(s.t).width; if (rw + w > maxW && rows[rows.length - 1].length) { rows.push([]); rw = 0; } rows[rows.length - 1].push({ ...s, w }); rw += w; });
    const y0 = H * 0.78 - (rows.length - 1) * fs * 0.6;
    const nxl = tl.lines[line.idx + 1];
    if ((song.clip || {}).lyrBox !== false) this.box(g, W, H, W * 0.04, y0 - fs * 1.15, W * 0.92, rows.length * fs * 1.25 + fs * (nxl ? 1.15 : 0.5));
    rows.forEach((row, ri) => {
      const total = row.reduce((a, s) => a + s.w, 0);
      let x = (W - total) / 2; const y = y0 + ri * fs * 1.25;
      row.forEach((s) => {
        const st = s.g * d, en = (s.g + s.dur) * d;
        const p = Math.max(0, Math.min(1, (t - st) / Math.max(0.05, en - st)));
        const ts = (song.clip || {}).textStyle || this.scn.textStyle || 'karaoke';
        const bounce = ts === 'bounce' && p > 0 && p < 1 ? -fs * 0.15 * Math.sin(p * Math.PI) : 0;
        g.textAlign = 'left';
        if (ts === 'typewriter') { if (p > 0) { g.fillStyle = '#fff'; g.fillText(s.t, x, y); } x += s.w; return; }
        if (ts === 'fade') { g.globalAlpha = 0.25 + 0.75 * Math.min(1, p * 1.5); g.fillStyle = '#fff'; g.fillText(s.t, x, y); g.globalAlpha = 1; x += s.w; return; }
        if (ts === 'glow') { g.save(); g.shadowColor = pal[0]; g.shadowBlur = p > 0 ? 34 : 8; g.fillStyle = p > 0 ? '#fff' : 'rgba(255,255,255,.55)'; g.fillText(s.t, x, y); g.restore(); x += s.w; return; }
        g.fillStyle = 'rgba(255,255,255,.45)'; g.fillText(s.t, x, y + bounce);
        if (p > 0) {
          g.save(); g.beginPath(); g.rect(x, y - fs, s.w * p, fs * 1.4); g.clip();
          const gr = g.createLinearGradient(x, 0, x + s.w, 0); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]);
          g.fillStyle = gr; g.shadowColor = pal[0]; g.shadowBlur = 18; g.fillText(s.t, x, y + bounce); g.restore();
        }
        x += s.w;
      });
    });
    // ligne suivante
    const nx = tl.lines[line.idx + 1];
    if (nx) { g.font = `500 ${Math.round(fs * 0.6)}px Sora, sans-serif`; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.35)'; g.fillText(nx.text, W / 2, y0 + rows.length * fs * 1.25 + fs * 0.3); }
  }

  // case des paroles : verre dépoli qui capte le fond, assombri selon sa luminosité pour garder le texte lisible
  box(g, W, H, x, y, w, h) {
    if (!this.bt) { this.bt = document.createElement('canvas'); this.btg = this.bt.getContext('2d', { willReadFrequently: true }); this.lum = document.createElement('canvas'); this.lum.width = 8; this.lum.height = 4; this.lg = this.lum.getContext('2d', { willReadFrequently: true }); }
    const sw = Math.max(8, Math.round(w / 4)), sh = Math.max(4, Math.round(h / 4));
    if (this.bt.width !== sw || this.bt.height !== sh) { this.bt.width = sw; this.bt.height = sh; }
    this.btg.drawImage(this.cv, x, y, w, h, 0, 0, sw, sh);
    let L = 0.3;
    try { this.lg.drawImage(this.bt, 0, 0, 8, 4); const d = this.lg.getImageData(0, 0, 8, 4).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; L = s / (d.length / 4); } catch (e) {}
    this.L = this.L == null ? L : this.L * 0.85 + L * 0.15; // transition douce
    const r = Math.min(w, h) * 0.18;
    g.save(); g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); g.clip();
    g.filter = 'blur(14px)'; g.drawImage(this.bt, x - 20, y - 20, w + 40, h + 40); g.filter = 'none';
    g.fillStyle = `rgba(6,4,14,${(0.32 + this.L * 0.5).toFixed(3)})`; g.fillRect(x, y, w, h);
    g.restore();
    g.save(); g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2; g.stroke(); g.restore();
  }

  // ---- thèmes ----
  neon(g, W, H, t, pal, bass) {
    const hy = H * 0.55; g.strokeStyle = hexA(pal[1], 0.5); g.lineWidth = 2;
    for (let i = 0; i < 14; i++) { const z = ((i + (t * 1.5) % 1) / 14); const y = hy + Math.pow(z, 2) * (H - hy); g.globalAlpha = z; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.globalAlpha = 0.6; for (let i = -10; i <= 10; i++) { g.beginPath(); g.moveTo(W / 2 + i * W * 0.02, hy); g.lineTo(W / 2 + i * W * 0.25, H); g.stroke(); }
    g.globalAlpha = 1;
    const sun = g.createLinearGradient(0, hy - W * 0.3, 0, hy); sun.addColorStop(0, pal[2]); sun.addColorStop(1, pal[1]);
    g.fillStyle = sun; g.globalAlpha = 0.35 + bass * 0.3; g.beginPath(); g.arc(W / 2, hy, W * 0.22, Math.PI, 0); g.fill(); g.globalAlpha = 1;
  }
  galaxie(g, W, H, t, pal, bass) {
    this.parts.forEach((p, i) => {
      const z = (p.z + t * 0.05) % 1, sc = 1 / (1.05 - z);
      const x = W / 2 + (p.x - 0.5) * W * sc * 0.6, y = H / 2 + (p.y - 0.5) * H * sc * 0.6;
      g.fillStyle = hexA(pal[i % 3], z); g.beginPath(); g.arc(x, y, (0.5 + z * 2.5) * (1 + bass), 0, 6.29); g.fill();
    });
  }
  ville(g, W, H, t, pal, bass) {
    this.parts.slice(0, 40).forEach((p, i) => {
      const x = (p.x * W + t * 15 * (p.s + 0.2)) % W, y = H * 0.2 + p.y * H * 0.6, r = 10 + p.s * W * 0.06;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, hexA(pal[i % 3], 0.25 + bass * 0.2)); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.29); g.fill();
    });
    g.fillStyle = '#05040a';
    for (let i = 0; i < 18; i++) { const bw = W / 18, bh = H * (0.12 + ((i * 7919) % 13) / 60); g.fillRect(i * bw, H - bh, bw - 2, bh); }
  }
  pluie(g, W, H, t, pal) {
    g.strokeStyle = hexA(pal[2], 0.35); g.lineWidth = 1.5;
    this.parts.forEach((p) => { const y = ((p.y + t * (0.6 + p.s)) % 1) * H, x = p.x * W; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + 18 + p.s * 20); g.stroke(); });
  }
  ocean(g, W, H, t, pal, bass) {
    for (let k = 0; k < 4; k++) {
      g.fillStyle = hexA(pal[k % 3], 0.12 + k * 0.03); g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 10) g.lineTo(x, H * (0.6 + k * 0.08) + Math.sin(x * 0.01 + t * (0.8 + k * 0.3)) * (20 + bass * 40));
      g.lineTo(W, H); g.fill();
    }
  }
  feu(g, W, H, t, pal, bass) {
    this.parts.forEach((p, i) => {
      const life = (p.z + t * (0.2 + p.s * 0.3)) % 1, x = p.x * W + Math.sin(t * 2 + p.a) * 20, y = H - life * H * 0.9;
      g.fillStyle = hexA(pal[i % 3], (1 - life) * (0.6 + bass * 0.4)); g.beginPath(); g.arc(x, y, 1 + (1 - life) * 4, 0, 6.29); g.fill();
    });
  }
  aurore(g, W, H, t, pal, bass) {
    for (let k = 0; k < 3; k++) {
      const gr = g.createLinearGradient(0, 0, 0, H * 0.6); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.6, hexA(pal[k], 0.25 + bass * 0.2)); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, H * 0.1);
      for (let x = 0; x <= W; x += 12) g.lineTo(x, H * (0.25 + k * 0.08) + Math.sin(x * 0.006 + t * 0.4 + k) * 60);
      g.lineTo(W, H * 0.7); g.lineTo(0, H * 0.7); g.fill();
    }
    this.galaxie(g, W, H, t * 0.2, ['#ffffff', pal[1], pal[2]], 0);
  }
  onde(g, W, H, t, pal, bass, mid) {
    for (let k = 0; k < 5; k++) {
      g.strokeStyle = hexA(pal[k % 3], 0.5); g.lineWidth = 2; g.beginPath();
      for (let x = 0; x <= W; x += 6) g.lineTo(x, H * 0.55 + Math.sin(x * (0.008 + k * 0.002) + t * (1 + k * 0.4)) * (30 + (bass + mid) * 120) * Math.sin((x / W) * Math.PI));
      g.stroke();
    }
  }
  // couleurs (filtre global) + effets superposés
  post(g, W, H, t, song, pal, bass) {
    const c = song.clip || {}, look = c.look || 'naturel', ov = c.overlays || [];
    const F = { vif: 'saturate(1.6) contrast(1.08)', chaud: 'sepia(.28) saturate(1.35) hue-rotate(-8deg)', froid: 'hue-rotate(-14deg) saturate(1.1) brightness(.96)', pastel: 'saturate(.55) brightness(1.15) contrast(.88)', contraste: 'contrast(1.4) saturate(1.2)', reve: 'blur(2px) brightness(1.12) saturate(1.25)', nb: 'grayscale(1) contrast(1.15)', sepia: 'sepia(.85) contrast(1.05)', duotone: 'grayscale(1) contrast(1.2)' };
    if (F[look]) {
      if (!this.pp) { this.pp = document.createElement('canvas'); this.ppg = this.pp.getContext('2d'); }
      if (this.pp.width !== W || this.pp.height !== H) { this.pp.width = W; this.pp.height = H; }
      this.ppg.clearRect(0, 0, W, H); this.ppg.drawImage(this.cv, 0, 0);
      g.save(); g.filter = F[look]; g.drawImage(this.pp, 0, 0); g.restore(); g.filter = 'none';
      if (look === 'duotone') { g.save(); g.globalCompositeOperation = 'color'; const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore(); }
    }
    const has = (k) => ov.includes(k);
    if (has('fuites')) { g.save(); g.globalCompositeOperation = 'screen'; [[0.1, 0.2, '#fb923c'], [0.9, 0.7, '#f43f5e']].forEach(([x, y, col], i) => this._glow(g, W * (x + 0.05 * Math.sin(t * 0.3 + i)), H * y, W * (0.55 + 0.1 * Math.sin(t * 0.5 + i)), col, 0.35)); g.restore(); }
    if (has('flare')) { const fx = W * (0.75 + 0.05 * Math.sin(t * 0.4)), fy = H * 0.15; g.save(); g.globalCompositeOperation = 'screen'; this._glow(g, fx, fy, W * 0.25, '#ffffff', 0.5 + bass * 0.2); [0.3, 0.55, 0.8].forEach((k, i) => this._glow(g, fx + (W / 2 - fx) * k * 2, fy + (H / 2 - fy) * k * 2, W * (0.03 + i * 0.02), pal[i % 3], 0.35)); g.restore(); }
    if (has('bokeh')) { g.save(); g.globalCompositeOperation = 'screen'; this.parts.slice(0, 24).forEach((p, i) => { g.fillStyle = hexA(pal[i % 3], 0.1 + 0.08 * Math.sin(t + p.a)); g.beginPath(); g.arc(p.x * W + Math.sin(t * 0.2 + p.a) * 30, p.y * H, W * (0.03 + p.s * 0.05), 0, 6.29); g.fill(); }); g.restore(); }
    if (has('poussiere')) this.parts.slice(0, 80).forEach((p) => { const x = (p.x * W + Math.sin(t * 0.3 + p.a) * 40) % W, y = ((p.y - t * 0.01 * (0.5 + p.s)) % 1 + 1) % 1 * H; this._glow(g, x, y, 4 + p.s * 6, '#fde68a', 0.5 * Math.abs(Math.sin(t + p.a))); });
    if (has('neige')) this.parts.forEach((p) => { const y = ((p.y + t * (0.04 + p.s * 0.05)) % 1) * H; g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc((p.x * W + Math.sin(t + p.a) * 20) % W, y, 1 + p.s * 3, 0, 6.29); g.fill(); });
    if (has('confettis')) this.parts.slice(0, 90).forEach((p, i) => { const y = ((p.y + t * (0.06 + p.s * 0.08)) % 1) * H, x = (p.x * W + Math.sin(t * 2 + p.a) * 30) % W; g.save(); g.translate(x, y); g.rotate(t * 3 + p.a); g.fillStyle = ['#f43f5e', '#facc15', '#22d3ee', '#a855f7', '#34d399'][i % 5]; g.fillRect(-6, -3, 12, 6); g.restore(); });
    if (has('coeurs')) this.parts.slice(0, 26).forEach((p, i) => { const y = H - ((p.y + t * (0.03 + p.s * 0.04)) % 1) * H, x = p.x * W + Math.sin(t + p.a) * 25, s = 10 + p.s * 18; g.save(); g.translate(x, y); g.fillStyle = hexA(['#f43f5e', '#f9a8d4', '#fb7185'][i % 3], 0.75); g.beginPath(); g.moveTo(0, s * 0.3); g.bezierCurveTo(-s, -s * 0.4, -s * 0.4, -s, 0, -s * 0.45); g.bezierCurveTo(s * 0.4, -s, s, -s * 0.4, 0, s * 0.3); g.fill(); g.restore(); });
    if (has('glitch') && Math.sin(t * 7) > 0.85) { if (!this.pp) { this.pp = document.createElement('canvas'); this.ppg = this.pp.getContext('2d'); } this.pp.width = W; this.pp.height = H; this.ppg.drawImage(this.cv, 0, 0); for (let i = 0; i < 6; i++) { const y = Math.random() * H, h = 10 + Math.random() * 60, dx = (Math.random() - 0.5) * 60; g.drawImage(this.pp, 0, y, W, h, dx, y, W, h); } g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.25; g.drawImage(this.pp, 6, 0); g.restore(); }
    if (has('vhs')) { g.fillStyle = 'rgba(0,0,0,.22)'; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2); const by = (t * 120) % H; g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, by, W, 30); g.fillStyle = '#fff'; g.font = `700 ${Math.round(W * 0.035)}px monospace`; g.textAlign = 'left'; g.fillText('▶ PLAY', W * 0.06, H * 0.06); }
    if (has('film')) { g.fillStyle = 'rgba(80,60,30,.18)'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(255,240,210,.22)'; g.lineWidth = 1.5; for (let i = 0; i < 2; i++) { const x = (Math.sin(t * 7 + i * 13) * 0.5 + 0.5) * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 6, H); g.stroke(); } }
    if (has('grain') || has('film') || has('vhs')) this._grain(g, W, H, 0.07);
    if (has('vignette') || has('film')) { const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.7)'); g.fillStyle = vg; g.fillRect(0, 0, W, H); }
    if (has('cinema')) { const bh = W > H ? H * 0.1 : H * 0.07; g.fillStyle = '#000'; g.fillRect(0, 0, W, bh); g.fillRect(0, H - bh, W, bh); }
  }

  // ---- thèmes réalistes ----
  _sky(g, W, H, stops) { const gr = g.createLinearGradient(0, 0, 0, H); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  _ridge(g, W, H, y0, amp, f, ph, color) { g.fillStyle = color; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 8) { const n = Math.sin(x * f + ph) * 0.6 + Math.sin(x * f * 2.3 + ph * 1.7) * 0.3 + Math.sin(x * f * 5.1 + ph) * 0.1; g.lineTo(x, y0 - n * amp); } g.lineTo(W, H); g.fill(); }
  _glow(g, x, y, r, c, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, hexA(c, a)); gr.addColorStop(1, hexA(c, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.29); g.fill(); }
  _stars(g, W, H, t, n, hmax = 1) { this.parts.slice(0, n).forEach((p) => { g.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * Math.abs(Math.sin(t * (0.5 + p.s) + p.a))})`; g.fillRect(p.x * W, p.y * H * hmax, 1 + p.s * 2, 1 + p.s * 2); }); }
  _grain(g, W, H, a) { g.fillStyle = `rgba(255,255,255,${a})`; for (let i = 0; i < 400; i++) g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  coucher(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#1e1b4b'], [0.35, pal[2]], [0.55, pal[1]], [0.68, pal[0]], [0.7, '#0c4a6e'], [1, '#020617']]);
    const sy = H * 0.66; this._glow(g, W / 2, sy, W * 0.5, '#fde68a', 0.45 + bass * 0.2);
    g.fillStyle = '#fff7ed'; g.beginPath(); g.arc(W / 2, sy, W * 0.08, Math.PI, 0); g.fill();
    for (let i = 0; i < 40; i++) { const y = sy + 8 + i * i * 0.4, w = W * 0.12 * (1 - i / 50) * (0.7 + 0.3 * Math.sin(t * 2 + i)); g.fillStyle = hexA('#fde68a', 0.5 * (1 - i / 40)); g.fillRect(W / 2 - w / 2 + Math.sin(t + i) * 6, y, w, 2); }
  }
  plage(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#0ea5e9'], [0.45, '#bae6fd'], [0.55, '#fdba74']]);
    this._glow(g, W * 0.75, H * 0.2, W * 0.25, '#ffffff', 0.7);
    g.fillStyle = '#0369a1'; g.fillRect(0, H * 0.55, W, H * 0.2);
    for (let k = 0; k < 3; k++) { g.fillStyle = hexA('#e0f2fe', 0.35 + k * 0.1); g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 10) g.lineTo(x, H * (0.68 + k * 0.03) + Math.sin(x * 0.01 + t * (1 + k * 0.4)) * (6 + bass * 10)); g.lineTo(W, H); g.fill(); }
    g.fillStyle = '#fcd9a8'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 10) g.lineTo(x, H * 0.8 + Math.sin(x * 0.004) * 20 + Math.sin(t * 0.8) * 8); g.lineTo(W, H); g.fill();
    g.strokeStyle = '#1f2937'; g.lineWidth = W * 0.012; g.beginPath(); g.moveTo(W * 0.12, H); g.quadraticCurveTo(W * 0.1, H * 0.6, W * 0.2, H * 0.42); g.stroke();
    for (let i = 0; i < 6; i++) { const a = -2.6 + i * 0.6 + Math.sin(t * 1.3 + i) * 0.06; g.fillStyle = '#14532d'; g.beginPath(); g.ellipse(W * 0.2 + Math.cos(a) * W * 0.08, H * 0.42 + Math.sin(a) * W * 0.04, W * 0.09, W * 0.018, a, 0, 6.29); g.fill(); }
  }
  sousmarin(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#0e7490'], [0.5, '#164e63'], [1, '#020617']]);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) { const x = W * (i / 6) + Math.sin(t * 0.3 + i) * W * 0.05; const gr = g.createLinearGradient(x, 0, x + W * 0.15, H); gr.addColorStop(0, 'rgba(165,243,252,.18)'); gr.addColorStop(1, 'rgba(165,243,252,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x - 20, 0); g.lineTo(x + 30, 0); g.lineTo(x + W * 0.2, H); g.lineTo(x + W * 0.05, H); g.fill(); }
    this.parts.slice(0, 50).forEach((p) => { const y = H - ((p.y + t * (0.05 + p.s * 0.1)) % 1) * H, x = p.x * W + Math.sin(t * 2 + p.a) * 10, r = 2 + p.s * 7 * (1 + bass); g.strokeStyle = 'rgba(207,250,254,.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r, 0, 6.29); g.stroke(); });
    g.globalCompositeOperation = 'source-over';
  }
  montagnes(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#0f172a'], [0.4, pal[1]], [0.7, pal[0]], [1, '#fde68a']]);
    this._glow(g, W * 0.5, H * 0.62, W * 0.45, '#fde68a', 0.4 + bass * 0.15);
    this._ridge(g, W, H, H * 0.58, H * 0.12, 0.004, 1 + t * 0.01, hexA(pal[2], 0.55));
    this._ridge(g, W, H, H * 0.68, H * 0.1, 0.006, 3 + t * 0.02, hexA('#1e1b4b', 0.8));
    this._ridge(g, W, H, H * 0.8, H * 0.07, 0.009, 5 + t * 0.04, '#0b0a1a');
    g.fillStyle = 'rgba(255,255,255,.06)'; for (let k = 0; k < 3; k++) g.fillRect(0, H * (0.6 + k * 0.06) + Math.sin(t * 0.3 + k) * 10, W, H * 0.03);
  }
  foret(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#052e16'], [0.6, '#14532d'], [1, '#020617']]);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) { const x = W * (0.2 + i * 0.22); const gr = g.createLinearGradient(x, 0, x - W * 0.2, H); gr.addColorStop(0, 'rgba(254,240,138,.22)'); gr.addColorStop(1, 'rgba(254,240,138,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + W * 0.06, 0); g.lineTo(x - W * 0.1, H); g.lineTo(x - W * 0.3, H); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 14; i++) { const x = ((i * 0.37) % 1) * W, w = W * (0.02 + ((i * 7) % 5) * 0.006); g.fillStyle = i % 2 ? '#022c16' : '#03200f'; g.fillRect(x, 0, w, H); }
    this.parts.slice(0, 45).forEach((p) => { const x = p.x * W + Math.sin(t * 0.7 + p.a) * 40, y = H * 0.4 + p.y * H * 0.55 + Math.cos(t * 0.5 + p.a) * 30; this._glow(g, x, y, 10 + bass * 8, '#facc15', 0.6 * Math.abs(Math.sin(t * (1 + p.s) + p.a))); });
  }
  neige(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#0b1730'], [0.6, '#1e3a8a'], [1, '#93c5fd']]);
    this._glow(g, W * 0.8, H * 0.15, W * 0.12, '#f1f5f9', 0.8); g.fillStyle = '#f8fafc'; g.beginPath(); g.arc(W * 0.8, H * 0.15, W * 0.04, 0, 6.29); g.fill();
    this._ridge(g, W, H, H * 0.78, H * 0.05, 0.005, 2, '#cbd5e1'); this._ridge(g, W, H, H * 0.86, H * 0.04, 0.008, 4, '#f1f5f9');
    for (let i = 0; i < 9; i++) { const x = W * (0.05 + i * 0.11), y = H * 0.84 - (i % 3) * 8, h = H * (0.08 + (i % 3) * 0.03); g.fillStyle = '#0f2a1d'; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x - h * 0.35, y); g.lineTo(x + h * 0.35, y); g.fill(); }
    this.parts.forEach((p) => { const y = ((p.y + t * (0.04 + p.s * 0.06)) % 1) * H, x = (p.x * W + Math.sin(t + p.a) * 25) % W; g.fillStyle = `rgba(255,255,255,${0.5 + p.s * 0.5})`; g.beginPath(); g.arc(x, y, 1 + p.s * 3.5, 0, 6.29); g.fill(); });
  }
  desert(g, W, H, t, pal) {
    this._sky(g, W, H, [[0, '#0b0820'], [0.55, '#312e81'], [0.72, '#9a3412']]);
    this._stars(g, W, H, t, 110, 0.6);
    this._glow(g, W * 0.3, H * 0.25, W * 0.1, '#fef3c7', 0.6); g.fillStyle = '#fef3c7'; g.beginPath(); g.arc(W * 0.3, H * 0.25, W * 0.035, 0, 6.29); g.fill();
    this._ridge(g, W, H, H * 0.75, H * 0.06, 0.003, 1, '#7c2d12'); this._ridge(g, W, H, H * 0.85, H * 0.05, 0.005, 2.5, '#431407');
  }
  ciel(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#0284c7'], [0.7, '#7dd3fc'], [1, '#e0f2fe']]);
    this._glow(g, W * 0.2, H * 0.1, W * 0.4, '#ffffff', 0.5);
    this.parts.slice(0, 14).forEach((p, i) => { const x = ((p.x + t * 0.008 * (0.5 + p.s)) % 1.4 - 0.2) * W, y = H * (0.1 + p.y * 0.6), r = W * (0.06 + p.s * 0.08);
      for (let k = 0; k < 6; k++) this._glow(g, x + Math.cos(k + p.a) * r, y + Math.sin(k * 2 + p.a) * r * 0.3, r, '#ffffff', 0.35); });
  }
  cerisiers(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#fdf2f8'], [0.6, '#fbcfe8'], [1, '#a78bfa']]);
    g.strokeStyle = '#3f2a2a'; g.lineWidth = W * 0.02; g.beginPath(); g.moveTo(-10, H * 0.25); g.quadraticCurveTo(W * 0.3, H * 0.2, W * 0.55, H * 0.05); g.stroke(); g.lineWidth = W * 0.008; g.beginPath(); g.moveTo(W * 0.25, H * 0.21); g.quadraticCurveTo(W * 0.35, H * 0.32, W * 0.45, H * 0.3); g.stroke();
    for (let i = 0; i < 26; i++) this._glow(g, W * (0.05 + (i * 0.618 % 0.55)), H * (0.05 + ((i * 0.37) % 0.3)), W * 0.06, '#f9a8d4', 0.5);
    this.parts.forEach((p) => { const y = ((p.y + t * (0.03 + p.s * 0.05)) % 1) * H, x = (p.x * W + t * 20 + Math.sin(t * 1.5 + p.a) * 30) % W; g.save(); g.translate(x, y); g.rotate(t * 2 + p.a); g.fillStyle = hexA('#f472b6', 0.6 + p.s * 0.4); g.beginPath(); g.ellipse(0, 0, 4 + p.s * 5, 2 + p.s * 3, 0, 0, 6.29); g.fill(); g.restore(); });
  }
  etoiles(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#020617'], [1, '#0b1023']]);
    g.save(); g.translate(W / 2, H / 2); g.rotate(-0.6 + t * 0.005);
    const band = g.createLinearGradient(0, -H * 0.15, 0, H * 0.15); band.addColorStop(0, 'rgba(0,0,0,0)'); band.addColorStop(0.5, hexA(pal[1], 0.28)); band.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = band; g.fillRect(-W * 1.5, -H * 0.15, W * 3, H * 0.3);
    this.parts.forEach((p) => { g.fillStyle = `rgba(255,255,255,${0.4 + 0.6 * Math.abs(Math.sin(t + p.a))})`; g.fillRect((p.x - 0.5) * W * 2, (p.y - 0.5) * H * 0.3 * (p.s + 0.3), 1.5, 1.5); });
    g.restore(); this._stars(g, W, H, t, 140);
    const sh = (t * 0.25) % 1; if (sh < 0.12) { const k = sh / 0.12, x = W * (0.2 + k * 0.5), y = H * (0.1 + k * 0.2); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 90, y - 35); g.stroke(); }
    this._ridge(g, W, H, H * 0.9, H * 0.04, 0.006, 1, '#000');
  }
  skyline(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#0b0820'], [0.7, '#312e81'], [1, '#7c3aed']]);
    for (let L = 0; L < 2; L++) for (let i = 0; i < 16; i++) {
      const bw = W / 12, x = (i * bw * 0.85 + L * bw * 0.4) % (W + bw) - bw * 0.3, bh = H * (0.25 + (((i + L * 5) * 7919) % 17) / 40) * (L ? 1 : 0.75), y = H * 0.8 - bh;
      g.fillStyle = L ? '#06040f' : '#140f2e'; g.fillRect(x, y, bw * 0.8, bh);
      if (L) for (let wy = y + 10; wy < H * 0.8 - 8; wy += 16) for (let wx = x + 6; wx < x + bw * 0.8 - 6; wx += 12) { const on = Math.sin(wx * 13.1 + wy * 7.7 + Math.floor(t * 0.5) * (wx % 3 === 0 ? 1 : 0)) > 0.2; if (on) { g.fillStyle = hexA(pal[(wx + wy) % 3 | 0], 0.75); g.fillRect(wx, wy, 6, 8); } }
    }
    g.save(); g.translate(0, H * 1.6); g.scale(1, -1); g.globalAlpha = 0.2; g.drawImage(this.cv, 0, H * 0.4, W, H * 0.4, 0, H * 0.8, W, H * 0.4); g.restore(); g.globalAlpha = 1;
    g.fillStyle = 'rgba(2,6,23,.55)'; g.fillRect(0, H * 0.8, W, H * 0.2);
  }
  route(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#020617'], [0.45, '#1e1b4b'], [0.5, '#0b0820'], [1, '#000']]);
    const hy = H * 0.48, vx = W / 2; this._glow(g, vx, hy, W * 0.4, pal[0], 0.25 + bass * 0.2);
    g.fillStyle = '#111827'; g.beginPath(); g.moveTo(vx - 4, hy); g.lineTo(vx + 4, hy); g.lineTo(W * 1.1, H); g.lineTo(-W * 0.1, H); g.fill();
    for (let i = 0; i < 12; i++) { const z = (i / 12 + t * 0.6) % 1, z2 = z + 0.03, y1 = hy + (H - hy) * z * z, y2 = hy + (H - hy) * z2 * z2; g.fillStyle = '#fde68a'; g.beginPath(); g.moveTo(vx - 1 - z * 6, y1); g.lineTo(vx + 1 + z * 6, y1); g.lineTo(vx + 1 + z2 * 6, y2); g.lineTo(vx - 1 - z2 * 6, y2); g.fill(); }
    for (let i = 0; i < 14; i++) { const z = (i / 14 + t * 0.35) % 1, y = hy + (H - hy) * z * z, s = 0.5 + z * 6; [[-1, '#f87171'], [1, '#fef9c3']].forEach(([d, c]) => { const x = vx + d * (W * 0.55) * z * z + d * 10; this._glow(g, x, y - 20 * z, 6 * s, c, 0.6); }); }
  }
  vitre(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#0f172a'], [1, '#1e293b']]);
    this.parts.slice(0, 26).forEach((p, i) => this._glow(g, p.x * W, H * (0.2 + p.y * 0.7), W * (0.05 + p.s * 0.08), pal[i % 3], 0.35 + bass * 0.2));
    g.fillStyle = 'rgba(148,163,184,.08)'; g.fillRect(0, 0, W, H);
    this.parts.forEach((p) => { const y = p.s > 0.7 ? ((p.y + t * (0.05 + p.s * 0.1)) % 1) * H : p.y * H, x = p.x * W, r = 2 + p.s * 6;
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(255,255,255,.3)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * 0.8, r, 0, 0, 6.29); g.fill(); if (p.s > 0.7) { g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = r * 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 60); g.stroke(); } });
  }
  bokeh(g, W, H, t, pal, bass) {
    g.globalCompositeOperation = 'lighter';
    this.parts.slice(0, 40).forEach((p, i) => { const x = (p.x * W + Math.sin(t * 0.2 + p.a) * 40), y = (p.y * H + Math.cos(t * 0.15 + p.a) * 40), r = W * (0.03 + p.s * 0.07) * (1 + bass * 0.2);
      g.fillStyle = hexA(pal[i % 3], 0.12 + 0.1 * Math.sin(t + p.a)); g.beginPath(); g.arc(x, y, r, 0, 6.29); g.fill(); g.strokeStyle = hexA(pal[i % 3], 0.18); g.lineWidth = 2; g.stroke(); });
    g.globalCompositeOperation = 'source-over';
  }
  club(g, W, H, t, pal, bass, mid) {
    g.fillStyle = 'rgba(10,5,20,.6)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) { const a = Math.sin(t * (0.6 + i * 0.13) + i) * 0.9, ox = W * (i % 2 ? 0.15 : 0.85); g.strokeStyle = hexA(pal[i % 3], 0.5 + bass * 0.5); g.lineWidth = 2 + bass * 3; g.beginPath(); g.moveTo(ox, 0); g.lineTo(ox + Math.sin(a) * H * 1.2, Math.cos(a) * H * 1.2); g.stroke(); }
    const bx = W / 2, by = H * 0.12; this._glow(g, bx, by, W * 0.08, '#ffffff', 0.4);
    this.parts.slice(0, 60).forEach((p, i) => { const a = p.a + t * 0.6, x = bx + Math.cos(a) * p.x * W, y = H * 0.2 + p.y * H * 0.8; g.fillStyle = hexA(pal[i % 3], 0.5 * Math.abs(Math.sin(t * 3 + p.a))); g.fillRect(x, y, 4, 4); });
    g.globalCompositeOperation = 'source-over';
  }
  concert(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#05030c'], [1, '#110a22']]);
    g.fillStyle = 'rgba(180,160,220,.06)'; g.fillRect(0, H * 0.3, W, H * 0.5);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { const x = W * (0.1 + i * 0.16), a = Math.sin(t * 0.8 + i) * 0.35 + (i < 3 ? 0.15 : -0.15), L = H * 1.1;
      const gr = g.createLinearGradient(x, 0, x + Math.sin(a) * L, L); gr.addColorStop(0, hexA(pal[i % 3], 0.55 + bass * 0.3)); gr.addColorStop(1, hexA(pal[i % 3], 0));
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - 8, 0); g.lineTo(x + 8, 0); g.lineTo(x + Math.sin(a) * L + W * 0.12, L); g.lineTo(x + Math.sin(a) * L - W * 0.12, L); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000'; for (let i = 0; i < 26; i++) { const x = (i / 25) * W, j = Math.abs(Math.sin(t * 4 + i * 1.7)) * bass * 30, r = W * 0.03; g.beginPath(); g.arc(x, H - r * 2.6 - j, r, 0, 6.29); g.fill(); g.fillRect(x - r * 1.3, H - r * 2 - j, r * 2.6, r * 3); if (i % 4 === 1) { g.fillRect(x + r * 0.6, H - r * 6 - j * 1.5, r * 0.45, r * 3.5); } }
  }
  feux(g, W, H, t, pal) {
    g.fillStyle = 'rgba(2,2,12,.35)'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 5; k++) { const per = 2.6 + k * 0.4, ph = ((t + k * 0.9) % per) / per, cx = W * (0.15 + ((k * 0.37 + Math.floor((t + k * 0.9) / per) * 0.29) % 0.7)), cy = H * (0.18 + (k % 3) * 0.1);
      if (ph < 0.25) { g.fillStyle = '#fde68a'; g.fillRect(cx, H - (H - cy) * (ph / 0.25), 3, 14); continue; }
      const e = (ph - 0.25) / 0.75; for (let i = 0; i < 36; i++) { const a = (i / 36) * 6.283, r = e * W * 0.18, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r + e * e * 60; g.fillStyle = hexA(pal[(i + k) % 3], 1 - e); g.beginPath(); g.arc(x, y, 2.5 * (1 - e) + 0.5, 0, 6.29); g.fill(); }
      this._glow(g, cx, cy, W * 0.15 * e, pal[k % 3], 0.25 * (1 - e)); }
    this._ridge(g, W, H, H * 0.92, H * 0.03, 0.01, 1, '#000');
  }
  amour(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#4c0519'], [1, '#1f0410']]);
    this.parts.slice(0, 30).forEach((p, i) => this._glow(g, p.x * W, p.y * H, W * 0.07, pal[1], 0.12));
    this.parts.slice(30, 70).forEach((p, i) => { const y = H - ((p.y + t * (0.03 + p.s * 0.05)) % 1) * H, x = p.x * W + Math.sin(t + p.a) * 30, s = (8 + p.s * 22) * (1 + bass * 0.3);
      g.save(); g.translate(x, y); g.rotate(Math.sin(t + p.a) * 0.3); g.fillStyle = hexA(pal[i % 3], 0.35 + p.s * 0.5); g.beginPath(); g.moveTo(0, s * 0.3); g.bezierCurveTo(-s, -s * 0.4, -s * 0.4, -s, 0, -s * 0.45); g.bezierCurveTo(s * 0.4, -s, s, -s * 0.4, 0, s * 0.3); g.fill(); g.restore(); });
  }
  chandelles(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#0c0603'], [1, '#1c0f05']]);
    for (let i = 0; i < 7; i++) { const x = W * (0.12 + i * 0.13), h = H * (0.12 + (i % 3) * 0.06), y = H * 0.92 - h, f = 1 + Math.sin(t * 9 + i * 3) * 0.08 + Math.sin(t * 13 + i) * 0.05;
      this._glow(g, x, y - 20, W * 0.16 * f, '#f59e0b', 0.25 + bass * 0.1);
      g.fillStyle = '#fef3c7'; g.fillRect(x - W * 0.025, y, W * 0.05, h);
      g.fillStyle = '#fbbf24'; g.beginPath(); g.ellipse(x + Math.sin(t * 5 + i) * 2, y - 16 * f, 7, 18 * f, 0, 0, 6.29); g.fill();
      g.fillStyle = '#fff7ed'; g.beginPath(); g.ellipse(x, y - 10, 3, 8, 0, 0, 6.29); g.fill(); }
  }
  lumiere(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#1e293b'], [1, '#0f172a']]);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) { const a = -0.5 + i * 0.12 + Math.sin(t * 0.2 + i) * 0.03; const gr = g.createLinearGradient(W * 0.5, 0, W * 0.5 + Math.sin(a) * H, H); gr.addColorStop(0, hexA(pal[0], 0.35 + bass * 0.1)); gr.addColorStop(1, hexA(pal[1], 0)); g.fillStyle = gr; g.beginPath(); g.moveTo(W * 0.5, -10); g.lineTo(W * 0.5 + Math.sin(a) * H * 1.2 - 40, H * 1.2); g.lineTo(W * 0.5 + Math.sin(a) * H * 1.2 + 40, H * 1.2); g.fill(); }
    this._glow(g, W * 0.5, 0, W * 0.4, '#ffffff', 0.5);
    this.parts.slice(0, 60).forEach((p) => { const x = p.x * W + Math.sin(t * 0.3 + p.a) * 20, y = (p.y * H + t * 8 * p.s) % H; g.fillStyle = `rgba(255,251,235,${0.3 * Math.abs(Math.sin(t + p.a))})`; g.fillRect(x, y, 2, 2); });
    g.globalCompositeOperation = 'source-over';
  }
  fumee(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#05030c'], [1, '#0f0a1e']]);
    this.parts.slice(0, 40).forEach((p, i) => { const life = (p.z + t * 0.04 * (0.5 + p.s)) % 1, x = p.x * W + Math.sin(t * 0.3 + p.a + life * 4) * W * 0.1, y = H - life * H * 1.1, r = W * (0.08 + life * 0.25);
      this._glow(g, x, y, r, pal[i % 3], 0.12 * Math.sin(life * Math.PI) * (1 + bass)); });
  }
  noel(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#0b1229'], [1, '#1e1b4b']]);
    g.strokeStyle = '#1f2937'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, H * 0.12); g.quadraticCurveTo(W / 2, H * 0.22, W, H * 0.12); g.stroke();
    for (let i = 0; i < 18; i++) { const u = i / 17, x = u * W, y = H * 0.12 + Math.sin(u * Math.PI) * H * 0.075 + 10, on = Math.sin(t * 3 + i * 1.3) > -0.2; this._glow(g, x, y, 26, pal[i % 3], on ? 0.8 : 0.15); }
    const tx = W * 0.5, ty = H * 0.35, th = H * 0.45; for (let k = 0; k < 4; k++) { const w = th * (0.2 + k * 0.1); g.fillStyle = '#14532d'; g.beginPath(); g.moveTo(tx, ty + k * th * 0.18); g.lineTo(tx - w, ty + th * (0.28 + k * 0.22)); g.lineTo(tx + w, ty + th * (0.28 + k * 0.22)); g.fill(); }
    g.fillStyle = '#facc15'; g.beginPath(); g.arc(tx, ty, 12 + bass * 6, 0, 6.29); g.fill();
    this.parts.slice(0, 30).forEach((p, i) => this._glow(g, tx + (p.x - 0.5) * th * 0.7 * p.y, ty + p.y * th * 0.85, 10, pal[i % 3], 0.6 * Math.abs(Math.sin(t * 2 + p.a))));
    this.parts.slice(30).forEach((p) => { const y = ((p.y + t * (0.04 + p.s * 0.05)) % 1) * H; g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(p.x * W + Math.sin(t + p.a) * 15, y, 1 + p.s * 2.5, 0, 6.29); g.fill(); });
  }
  halloween(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#1a0b2e'], [1, '#3b0764']]);
    this._glow(g, W * 0.7, H * 0.25, W * 0.3, '#fb923c', 0.4); g.fillStyle = '#fed7aa'; g.beginPath(); g.arc(W * 0.7, H * 0.25, W * 0.13, 0, 6.29); g.fill();
    this.parts.slice(0, 8).forEach((p) => { const x = (p.x * W + t * 60 * (0.5 + p.s)) % (W + 80) - 40, y = H * (0.1 + p.y * 0.4) + Math.sin(t * 3 + p.a) * 20, f = Math.sin(t * 14 + p.a) * 0.6; g.fillStyle = '#000'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 18, y - 14 * f, x - 34, y + 2); g.quadraticCurveTo(x - 18, y + 4, x, y + 6); g.quadraticCurveTo(x + 18, y + 4, x + 34, y + 2); g.quadraticCurveTo(x + 18, y - 14 * f, x, y); g.fill(); });
    this._ridge(g, W, H, H * 0.85, H * 0.05, 0.006, 1, '#0a0512');
    for (let i = 0; i < 3; i++) { const x = W * (0.2 + i * 0.3), y = H * 0.88; g.fillStyle = '#ea580c'; g.beginPath(); g.ellipse(x, y, 40, 30, 0, 0, 6.29); g.fill(); this._glow(g, x, y, 60, '#fde047', 0.3 + 0.2 * Math.sin(t * 7 + i) + bass * 0.2); }
  }
  orage(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#0b1020'], [0.6, '#1e293b'], [1, '#0f172a']]);
    this.parts.slice(0, 10).forEach((p, i) => { for (let k = 0; k < 5; k++) this._glow(g, ((p.x + t * 0.006) % 1.3 - 0.15) * W + k * W * 0.06, H * (0.08 + p.y * 0.25) + Math.sin(k) * 20, W * 0.12, '#475569', 0.35); });
    const fl = Math.max(0, Math.sin(t * 1.7) * Math.sin(t * 5.3)) > 0.82 || bass > 0.75;
    if (fl) { g.fillStyle = 'rgba(224,231,255,.35)'; g.fillRect(0, 0, W, H); g.strokeStyle = '#eef2ff'; g.lineWidth = 4; g.shadowColor = '#c7d2fe'; g.shadowBlur = 30; g.beginPath(); let x = W * (0.3 + 0.4 * ((Math.floor(t * 1.7) * 0.37) % 1)), y = 0; g.moveTo(x, y); while (y < H * 0.7) { x += (Math.random() - 0.5) * 80; y += 40 + Math.random() * 40; g.lineTo(x, y); } g.stroke(); g.shadowBlur = 0; }
    g.strokeStyle = 'rgba(203,213,225,.35)'; g.lineWidth = 1.5; this.parts.forEach((p) => { const y = ((p.y + t * (0.9 + p.s)) % 1) * H, x = p.x * W; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 8, y + 26); g.stroke(); });
    this._ridge(g, W, H, H * 0.9, H * 0.04, 0.007, 2, '#020617');
  }
  automne(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#7c2d12'], [0.5, '#c2410c'], [1, '#fcd34d']]);
    this._glow(g, W * 0.7, H * 0.3, W * 0.35, '#fde68a', 0.5);
    this._ridge(g, W, H, H * 0.75, H * 0.05, 0.004, 1, '#78350f'); this._ridge(g, W, H, H * 0.86, H * 0.03, 0.007, 3, '#451a03');
    g.strokeStyle = '#3f1d0b'; g.lineWidth = W * 0.025; g.beginPath(); g.moveTo(W * 0.18, H); g.lineTo(W * 0.2, H * 0.45); g.stroke();
    for (let i = 0; i < 22; i++) this._glow(g, W * (0.05 + ((i * 0.618) % 0.35)), H * (0.25 + ((i * 0.37) % 0.25)), W * 0.08, ['#ea580c', '#f59e0b', '#b91c1c'][i % 3], 0.55);
    this.parts.slice(0, 50).forEach((p, i) => { const y = ((p.y + t * (0.03 + p.s * 0.05)) % 1) * H, x = (p.x * W + t * 25 + Math.sin(t * 1.3 + p.a) * 40) % W; g.save(); g.translate(x, y); g.rotate(t * 1.5 + p.a); g.fillStyle = ['#ea580c', '#f59e0b', '#b91c1c', '#ca8a04'][i % 4]; g.beginPath(); g.ellipse(0, 0, 9 + p.s * 8, 4 + p.s * 4, 0, 0, 6.29); g.fill(); g.restore(); });
  }
  lavande(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#fde68a'], [0.35, '#fbcfe8'], [0.5, '#c4b5fd']]);
    this._glow(g, W * 0.5, H * 0.45, W * 0.3, '#fff7ed', 0.6);
    this._ridge(g, W, H, H * 0.5, H * 0.03, 0.004, 1, '#a78bfa');
    for (let r = 0; r < 14; r++) { const y = H * 0.52 + Math.pow(r / 14, 1.6) * H * 0.5, sp = 6 + r * 5; g.strokeStyle = r % 2 ? '#7c3aed' : '#8b5cf6'; g.lineWidth = 2 + r * 1.2; for (let x = -sp; x < W + sp; x += sp) { const sw = Math.sin(t * 1.2 + x * 0.01 + r) * (2 + r * 0.4); g.beginPath(); g.moveTo(x, y + r * 3); g.lineTo(x + sw, y - 4 - r * 2.2); g.stroke(); } }
    this.parts.slice(0, 12).forEach((p) => { const x = (p.x * W + t * 30 * (p.s + 0.3)) % W, y = H * (0.45 + p.y * 0.3) + Math.sin(t * 6 + p.a) * 6; g.fillStyle = '#fde047'; g.beginPath(); g.arc(x, y, 3, 0, 6.29); g.fill(); });
  }
  lac(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#0c4a6e'], [0.45, '#7dd3fc'], [0.5, '#fef3c7']]);
    this._ridge(g, W, H, H * 0.48, H * 0.16, 0.005, 1, '#334155'); this._ridge(g, W, H, H * 0.5, H * 0.07, 0.009, 4, '#1e293b');
    g.save(); g.translate(0, H); g.scale(1, -1); g.globalAlpha = 0.45; g.drawImage(this.cv, 0, 0, W, H * 0.5, 0, 0, W, H * 0.5); g.restore(); g.globalAlpha = 1;
    g.fillStyle = 'rgba(14,116,144,.35)'; g.fillRect(0, H * 0.5, W, H * 0.5);
    g.strokeStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 26; i++) { const y = H * (0.52 + i * 0.018), x = ((i * 0.37 + t * 0.03) % 1) * W; g.beginPath(); g.moveTo(x, y); g.lineTo(x + W * 0.12, y); g.stroke(); }
  }
  espace(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#020617'], [1, '#0b0820']]); this._stars(g, W, H, t, 140);
    const R = Math.min(W, H) * 0.28, px = W * 0.62, py = H * 0.38;
    const pg = g.createRadialGradient(px - R * 0.4, py - R * 0.4, R * 0.1, px, py, R); pg.addColorStop(0, '#fde68a'); pg.addColorStop(0.5, pal[0]); pg.addColorStop(1, '#431407'); g.fillStyle = pg; g.beginPath(); g.arc(px, py, R, 0, 6.29); g.fill();
    g.save(); g.translate(px, py); g.rotate(-0.35); g.strokeStyle = 'rgba(253,230,138,.55)'; g.lineWidth = R * 0.08; g.beginPath(); g.ellipse(0, 0, R * 1.6, R * 0.35, 0, Math.PI * 0.05, Math.PI * 0.95, true); g.stroke(); g.restore();
    const m = t * 0.25, mx = px + Math.cos(m) * R * 2.1, my = py + Math.sin(m) * R * 0.6; g.fillStyle = pal[1]; g.beginPath(); g.arc(mx, my, R * 0.16, 0, 6.29); g.fill();
    this._glow(g, W * 0.15, H * 0.8, W * 0.3, pal[2], 0.25 + bass * 0.2);
  }
  cyberpunk(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#0f0524'], [0.7, '#3b0764'], [1, '#0f0524']]);
    for (let i = 0; i < 12; i++) { const bw = W / 9, x = i * bw * 0.8 - bw * 0.2, bh = H * (0.35 + ((i * 7919) % 11) / 30), y = H * 0.85 - bh; g.fillStyle = '#0a0418'; g.fillRect(x, y, bw * 0.75, bh); g.fillStyle = hexA(pal[i % 3], 0.7 + 0.3 * Math.sin(t * 3 + i)); g.fillRect(x + bw * 0.1, y + bh * 0.15, bw * 0.55, 10); this._glow(g, x + bw * 0.37, y + bh * 0.15, bw * 0.6, pal[i % 3], 0.25 + bass * 0.2); }
    g.fillStyle = 'rgba(15,5,36,.6)'; g.fillRect(0, H * 0.85, W, H * 0.15);
    for (let i = 0; i < 8; i++) { g.fillStyle = hexA(pal[i % 3], 0.18); g.fillRect(i * W / 8, H * 0.86, W / 16, H * 0.14); }
    g.strokeStyle = 'rgba(240,171,252,.35)'; g.lineWidth = 1.5; this.parts.forEach((p) => { const y = ((p.y + t * (0.8 + p.s)) % 1) * H, x = p.x * W; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y + 22); g.stroke(); });
  }

  vhs(g, W, H, t, pal, bass) {
    this.onde(g, W, H, t, pal, bass, 0.2);
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);
    const by = (t * 120) % H; g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, by, W, 30);
    g.fillStyle = '#fff'; g.font = `700 ${Math.round(W * 0.035)}px monospace`; g.fillText('▶ PLAY', W * 0.06, H * 0.08); if (Math.floor(t * 2) % 2) { g.fillStyle = '#ef4444'; g.beginPath(); g.arc(W * 0.9, H * 0.07, 10, 0, 6.29); g.fill(); }
    this._grain(g, W, H, 0.08);
  }
  film(g, W, H, t, pal, bass) {
    g.fillStyle = 'rgba(80,60,30,.35)'; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,10,0,.85)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,240,210,.25)'; g.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const x = (Math.sin(t * 7 + i * 13) * 0.5 + 0.5) * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + Math.sin(t * 3 + i) * 10, H); g.stroke(); }
    if (Math.random() < 0.08) { g.fillStyle = 'rgba(255,240,210,.12)'; g.fillRect(0, 0, W, H); }
    this._grain(g, W, H, 0.12);
  }
  vinyle(g, W, H, t, pal, bass) {
    this._sky(g, W, H, [[0, '#1c1008'], [1, '#0a0603']]);
    const cx = W / 2, cy = H * 0.42, R = Math.min(W, H) * 0.36;
    this._glow(g, cx, cy, R * 1.5, pal[0], 0.15 + bass * 0.15);
    g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(cx, cy, R, 0, 6.29); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.05)'; for (let r = R * 0.4; r < R; r += 5) { g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r, 0, 6.29); g.stroke(); }
    g.save(); g.translate(cx, cy); g.rotate(t * 3.5); const sh = g.createLinearGradient(-R, 0, R, 0); sh.addColorStop(0.4, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,.12)'); sh.addColorStop(0.6, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.beginPath(); g.arc(0, 0, R, 0, 6.29); g.fill();
    g.fillStyle = pal[1]; g.beginPath(); g.arc(0, 0, R * 0.33, 0, 6.29); g.fill(); g.fillStyle = pal[2]; g.fillRect(-R * 0.2, -4, R * 0.4, 8); g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, 6, 0, 6.29); g.fill(); g.restore();
    g.strokeStyle = '#d4d4d8'; g.lineWidth = 8; g.beginPath(); g.moveTo(cx + R * 1.05, cy - R * 0.9); g.lineTo(cx + R * 0.95, cy + R * 0.1); g.lineTo(cx + R * 0.55, cy + R * 0.4); g.stroke();
  }
}

export function currentLine(tl, song, t) {
  const d = s16(song.bpm);
  let cur = null;
  tl.lines.forEach((l, i) => {
    const st = (l.b0 * 16 + (l.syl[0]?.g ?? l.b0 * 16) - l.b0 * 16) * d - 0.6;
    if (t >= st) cur = { ...l, idx: i };
  });
  return cur;
}

export function loadImage(file) {
  return new Promise((res) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = URL.createObjectURL(file); });
}

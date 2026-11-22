// Sonyra — vidéoclip animé : rendu canvas réactif au son, paroles karaoké, scénario (IA ou thème)
import { s16 } from './engine';

export const THEMES = {
  neon: { n: 'Néon rétro', pal: ['#22d3ee', '#a855f7', '#fb923c'] },
  galaxie: { n: 'Galaxie', pal: ['#3b82f6', '#a855f7', '#f0abfc'] },
  ville: { n: 'Ville la nuit', pal: ['#fb923c', '#facc15', '#38bdf8'] },
  pluie: { n: 'Pluie', pal: ['#60a5fa', '#94a3b8', '#e0f2fe'] },
  ocean: { n: 'Océan', pal: ['#06b6d4', '#2563eb', '#a7f3d0'] },
  feu: { n: 'Feu', pal: ['#f97316', '#ef4444', '#fde047'] },
  aurore: { n: 'Aurore boréale', pal: ['#34d399', '#22d3ee', '#c084fc'] },
  onde: { n: 'Ondes sonores', pal: ['#22d3ee', '#d946ef', '#fb923c'] },
};

export const FORMATS = { '9:16': [720, 1280], '16:9': [1280, 720], '1:1': [1080, 1080] };

const hexA = (h, a) => {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export function defaultScenario(song) {
  const theme = song.style === 'ballade' || song.mode === 'min' ? 'galaxie' : song.style === 'edm' || song.style === 'pop' ? 'neon' : song.style === 'lofi' ? 'pluie' : song.style === 'trap' || song.style === 'hiphop' ? 'ville' : 'onde';
  return { title: song.title || 'Ma chanson', theme, sections: {}, keywords: [], textStyle: 'karaoke' };
}

export class ClipRenderer {
  constructor(canvas) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.parts = []; this.seed = 1; this.photos = []; this.lastBeat = 0;
  }
  rand() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  setup(scn, photos) {
    this.scn = scn; this.photos = photos || [];
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
    // photo utilisateur (Ken Burns)
    if (this.photos.length) {
      const idx = line ? (line.idx % this.photos.length) : Math.floor(t / 6) % this.photos.length;
      const img = this.photos[idx];
      if (img?.width) {
        const z = 1.08 + 0.06 * Math.sin(t * 0.15 + idx), sc = Math.max(W / img.width, H / img.height) * z;
        const iw = img.width * sc, ih = img.height * sc;
        g.globalAlpha = 0.55; g.drawImage(img, (W - iw) / 2 + Math.sin(t * 0.1) * 20, (H - ih) / 2 + Math.cos(t * 0.12) * 20, iw, ih); g.globalAlpha = 1;
        const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.8)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
      }
    }
    this[themeKey]?.(g, W, H, t, pal, bass, mid, hi, energy);
    // mots-clés flottants (scénario IA)
    const kws = (sec.keywords?.length ? sec.keywords : this.scn.keywords) || [];
    if (kws.length) {
      g.textAlign = 'center';
      kws.slice(0, 6).forEach((k, i) => {
        const x = W * (0.15 + 0.7 * ((i * 0.37 + t * 0.01) % 1)), y = H * (0.15 + 0.5 * ((i * 0.53 + t * 0.006 * (i + 1)) % 1));
        g.font = `600 ${Math.round(W * 0.035)}px Sora, sans-serif`; g.fillStyle = hexA(pal[i % 3], 0.12 + 0.1 * Math.sin(t + i)); g.fillText(k.toUpperCase(), x, y);
      });
    }
    // spectre circulaire
    if (freq) {
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
    // paroles
    this.lyrics(g, W, H, t, tl, song, pal, line);
    // titre
    const introEnd = (tl.lines[0]?.b0 || 0) * 16 * s16(song.bpm);
    if (t < Math.max(3, introEnd)) {
      const a = Math.min(1, t * 1.5) * Math.min(1, (Math.max(3, introEnd) - t) * 1.5);
      g.globalAlpha = Math.max(0, a); g.textAlign = 'center'; g.fillStyle = '#fff';
      g.font = `800 ${Math.round(W * 0.075)}px Sora, sans-serif`; g.shadowColor = pal[1]; g.shadowBlur = 30;
      g.fillText(this.scn.title || song.title || '', W / 2, H * 0.72); g.shadowBlur = 0;
      if (song.artist) { g.font = `500 ${Math.round(W * 0.035)}px Sora, sans-serif`; g.fillStyle = pal[0]; g.fillText(song.artist, W / 2, H * 0.72 + W * 0.07); }
      g.globalAlpha = 1;
    }
    g.font = `600 ${Math.round(W * 0.022)}px Sora, sans-serif`; g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,.35)'; g.fillText('Sonyra', W - 20, H - 20);
  }

  lyrics(g, W, H, t, tl, song, pal, line) {
    if (!line) return;
    const d = s16(song.bpm);
    const fs = Math.round(Math.min(W * 0.062, H * 0.045));
    g.font = `700 ${fs}px Sora, sans-serif`;
    const words = line.syl.map((s) => s);
    // découpe en lignes visuelles
    const maxW = W * 0.86;
    const rows = [[]]; let rw = 0;
    words.forEach((s) => { const w = g.measureText(s.t).width; if (rw + w > maxW && rows[rows.length - 1].length) { rows.push([]); rw = 0; } rows[rows.length - 1].push({ ...s, w }); rw += w; });
    const y0 = H * 0.78 - (rows.length - 1) * fs * 0.6;
    rows.forEach((row, ri) => {
      const total = row.reduce((a, s) => a + s.w, 0);
      let x = (W - total) / 2; const y = y0 + ri * fs * 1.25;
      row.forEach((s) => {
        const st = s.g * d, en = (s.g + s.dur) * d;
        const p = Math.max(0, Math.min(1, (t - st) / Math.max(0.05, en - st)));
        const bounce = this.scn.textStyle === 'bounce' && p > 0 && p < 1 ? -fs * 0.15 * Math.sin(p * Math.PI) : 0;
        g.textAlign = 'left';
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

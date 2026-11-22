// Sonyria — back vocals : doublage ou harmonie (tierce, quinte, octave) créés à partir de ta voix enregistrée
import { SCALES } from './music';
import { pitchTrack } from './hum';

export const BACKS = {
  double: { n: 'Doubler ma voix', pan: [-0.6, 0.6] },
  third: { n: 'Harmonie à la tierce', pan: [-0.45] },
  fifth: { n: 'Harmonie à la quinte', pan: [0.45] },
  choir: { n: 'Chœur (tierce + quinte)', pan: [-0.5, 0.5] },
  low: { n: 'Octave en dessous', pan: [0] },
};

// note de la gamme la plus proche + note `steps` degrés plus haut (diatonique)
function diatonic(midi, key, mode, steps) {
  const sc = SCALES[mode] || SCALES.maj;
  const rel = midi - key, oct = Math.floor(rel / 12), pc = ((rel % 12) + 12) % 12;
  let deg = 0, best = 99; sc.forEach((s, i) => { const d = Math.abs(s - pc); if (d < best) { best = d; deg = i; } });
  const snapped = key + oct * 12 + sc[deg];
  const td = deg + steps, tgt = key + (oct + Math.floor(td / 7)) * 12 + sc[td % 7];
  return tgt - snapped;
}

// décalage de hauteur qui garde la durée (deux têtes de lecture glissantes en fondu croisé)
function shift(x, sr, ratioAt) {
  const W = Math.round(sr * 0.045), out = new Float32Array(x.length);
  let phase = 0, r = ratioAt(0);
  for (let n = 0; n < x.length; n++) {
    if ((n & 255) === 0) r = ratioAt(n / sr);
    phase += (1 - r) / W; phase -= Math.floor(phase);
    let v = 0;
    for (let k = 0; k < 2; k++) {
      const ph = (phase + k * 0.5) % 1, pos = n + W / 2 - ph * W;
      const i0 = Math.floor(pos), f = pos - i0;
      if (i0 >= 0 && i0 + 1 < x.length) { const g = Math.sin(Math.PI * ph); v += (x[i0] * (1 - f) + x[i0 + 1] * f) * g * g; }
    }
    out[n] = v;
  }
  return out;
}

export function makeBacking(data, sr, kind, key = 0, mode = 'maj') {
  if (kind === 'double') {
    const d = Math.round(sr * 0.024);
    return [1.006, 0.994].map((r, k) => { const y = shift(data, sr, () => r); const o = new Float32Array(data.length); for (let i = 0; i + d * (k + 1) < data.length; i++) o[i + d * (k + 1)] = y[i]; return o; });
  }
  if (kind === 'low') return [shift(data, sr, () => 0.5)];
  const tr = pitchTrack(data, sr);
  const at = (steps) => (t) => {
    const f = tr.frames[Math.min(tr.frames.length - 1, Math.max(0, Math.round(t / tr.hop)))];
    const semis = f?.midi != null ? diatonic(f.midi, key, mode, steps) : steps === 2 ? (mode === 'min' ? 3 : 4) : 7;
    return Math.pow(2, semis / 12);
  };
  if (kind === 'third') return [shift(data, sr, at(2))];
  if (kind === 'fifth') return [shift(data, sr, at(4))];
  return [shift(data, sr, at(2)), shift(data, sr, at(4))];
}

// ---------- améliorer une prise (sans toucher l'original, gardé à part) ----------
// justesse : ramène chaque note vers la note de la gamme la plus proche (léger, moyen, robot)
export function tune(data, sr, key = 0, mode = 'maj', amount = 0.6) {
  const sc = SCALES[mode] || SCALES.maj, tr = pitchTrack(data, sr);
  const corr = tr.frames.map((f) => {
    if (f.midi == null) return 0;
    const rel = f.midi - key, base = Math.floor(rel / 12) * 12; let best = 99, tgt = f.midi;
    for (const o of [-12, 0, 12]) for (const n of sc) { const m = key + base + o + n, d = Math.abs(m - f.midi); if (d < best) { best = d; tgt = m; } }
    return (tgt - f.midi) * amount;
  });
  // lissage (sauf mode robot) pour éviter les sauts
  const sm = amount >= 1 ? corr : corr.map((_, i) => { let a = 0, n = 0; for (let k = -3; k <= 3; k++) { const v = corr[i + k]; if (v != null) { a += v; n++; } } return a / n; });
  return shift(data, sr, (t) => Math.pow(2, (sm[Math.min(sm.length - 1, Math.max(0, Math.round(t / tr.hop)))] || 0) / 12));
}
// nettoyer le bruit entre les phrases (porte douce)
export function gate(data, sr) {
  const w = Math.round(sr * 0.01), n = Math.ceil(data.length / w), rms = new Float32Array(n); let peak = 1e-6;
  for (let i = 0; i < n; i++) { let s = 0; for (let k = i * w; k < Math.min(data.length, (i + 1) * w); k++) s += data[k] * data[k]; rms[i] = Math.sqrt(s / w); peak = Math.max(peak, rms[i]); }
  const th = peak * 0.045, out = new Float32Array(data.length); let g = 0;
  for (let i = 0; i < n; i++) { const open = rms[i] > th || rms[i + 1] > th || rms[i + 2] > th; for (let k = i * w; k < Math.min(data.length, (i + 1) * w); k++) { g += ((open ? 1 : 0.03) - g) * (open ? 0.02 : 0.0015); out[k] = data[k] * g; } }
  return out;
}
export function normalize(data, target = 0.9) { let p = 1e-6; for (let i = 0; i < data.length; i++) p = Math.max(p, Math.abs(data[i])); const g = target / p, o = new Float32Array(data.length); for (let i = 0; i < data.length; i++) o[i] = data[i] * g; return o; }
export function fades(data, sr, fin = 0.03, fout = 0.4) { const o = Float32Array.from(data), a = Math.round(sr * fin), b = Math.round(sr * fout); for (let i = 0; i < a && i < o.length; i++) o[i] *= i / a; for (let i = 0; i < b && i < o.length; i++) o[o.length - 1 - i] *= i / b; return o; }
// enlever le silence au début : renvoie les données coupées et le décalage (s)
export function trimStart(data, sr) { let p = 1e-6; for (let i = 0; i < data.length; i++) p = Math.max(p, Math.abs(data[i])); const th = p * 0.06; let i0 = 0; while (i0 < data.length && Math.abs(data[i0]) < th) i0++; i0 = Math.max(0, i0 - Math.round(sr * 0.04)); return { data: data.slice(i0), off: i0 / sr }; }

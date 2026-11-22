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

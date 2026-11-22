// Sonyria — fredonner / chanter : suivi de hauteur (YIN), notes, tonalité, harmonisation, reconstruction
import * as M from './music';

// ---------- suivi de hauteur (YIN simplifié, 8 kHz, pas de 10 ms) ----------
export function pitchTrack(samples, sr) {
  const f = Math.max(1, Math.round(sr / 8000)), fs = sr / f;
  const n = Math.floor(samples.length / f), x = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < f; k++) s += samples[i * f + k]; x[i] = s / f; }
  const W = 512, hop = Math.round(fs * 0.01), minLag = Math.floor(fs / 900), maxLag = Math.floor(fs / 70);
  const frames = [];
  let peak = 1e-6;
  for (let a = 0; a + W + maxLag < n; a += hop) { let e = 0; for (let i = 0; i < W; i++) e += x[a + i] * x[a + i]; e = Math.sqrt(e / W); peak = Math.max(peak, e); frames.push({ t: a / fs, e }); }
  const d = new Float32Array(maxLag + 1);
  frames.forEach((fr) => {
    fr.midi = null;
    if (fr.e < peak * 0.06) return;
    const a = Math.round(fr.t * fs);
    // fonction de différence normalisée (YIN)
    let run = 0; d[0] = 1;
    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < W; i++) { const v = x[a + i] - x[a + i + lag]; sum += v * v; }
      run += sum; d[lag] = run ? (sum * lag) / run : 1;
    }
    let best = -1;
    for (let lag = minLag; lag <= maxLag; lag++) if (d[lag] < 0.15) { while (lag + 1 <= maxLag && d[lag + 1] < d[lag]) lag++; best = lag; break; }
    if (best < 0) { let mi = minLag; for (let lag = minLag; lag <= maxLag; lag++) if (d[lag] < d[mi]) mi = lag; if (d[mi] < 0.3) best = mi; }
    if (best > 0) {
      // interpolation parabolique
      const a0 = d[best - 1] ?? d[best], b0 = d[best], c0 = d[best + 1] ?? d[best];
      const den = a0 - 2 * b0 + c0, off = den ? (0.5 * (a0 - c0)) / den : 0;
      const hz = fs / (best + Math.max(-0.5, Math.min(0.5, off)));
      fr.midi = 69 + 12 * Math.log2(hz / 440);
    }
  });
  // lissage médian sur 5 trames
  const med = frames.map((fr, i) => {
    const w = frames.slice(Math.max(0, i - 2), i + 3).map((q) => q.midi).filter((m) => m != null).sort((p, q) => p - q);
    return fr.midi == null || w.length < 3 ? null : w[Math.floor(w.length / 2)];
  });
  frames.forEach((fr, i) => (fr.midi = med[i]));
  return { frames, hop: hop / fs, peak };
}

// ---------- trames -> notes ----------
export function framesToNotes(track, onsets = []) {
  const { frames, hop } = track;
  const notes = [];
  let cur = null;
  const onsetSet = new Set(onsets.map((o) => Math.round(o / hop)));
  const close = () => { if (cur && cur.n * hop >= 0.08) { cur.dur = cur.n * hop; cur.midi = cur.sum / cur.n; notes.push(cur); } cur = null; };
  frames.forEach((fr, i) => {
    if (fr.midi == null) { close(); return; }
    const isOnset = onsetSet.has(i) || onsetSet.has(i - 1);
    if (cur && (Math.abs(fr.midi - cur.sum / cur.n) > 0.9 || (isOnset && cur.n * hop > 0.2))) close();
    if (!cur) cur = { t: fr.t, n: 0, sum: 0 };
    cur.n++; cur.sum += fr.midi;
  });
  close();
  return notes;
}
// fredonnement : fusionner les morceaux de même hauteur presque collés, absorber les glissés très courts
export function cleanNotes(notes, { merge = true } = {}) {
  const out = [];
  notes.forEach((n) => {
    const p = out[out.length - 1];
    const gap = p ? n.t - (p.t + p.dur) : 1;
    if (p && merge && Math.round(p.midi) === Math.round(n.midi) && gap < 0.05) { p.dur = n.t + n.dur - p.t; return; }
    if (p && n.dur < 0.11 && gap < 0.03) { p.dur = n.t + n.dur - p.t; return; } // glissé
    out.push({ ...n });
  });
  return out;
}

// ---------- tonalité d'après les notes (Krumhansl) ----------
const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
function corr(a, b) { const ma = a.reduce((x, y) => x + y) / 12, mb = b.reduce((x, y) => x + y) / 12; let n = 0, da = 0, db = 0; for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return n / Math.sqrt(da * db || 1); }
export function keyFromNotes(notes) {
  const h = new Array(12).fill(0);
  notes.forEach((n) => (h[M.mod(Math.round(n.midi), 12)] += n.dur));
  let key = 0, mode = 'maj', best = -2;
  for (let k = 0; k < 12; k++) {
    const rot = (p) => Array.from({ length: 12 }, (_, i) => p[M.mod(i - k, 12)]);
    const a = corr(h, rot(MAJ)), b = corr(h, rot(MIN));
    if (a > best) { best = a; key = k; mode = 'maj'; }
    if (b > best) { best = b; key = k; mode = 'min'; }
  }
  return { key, mode };
}

// ---------- harmonisation : un accord diatonique par mesure ----------
export function harmonizeBar(pcWeights, key, mode, prev) {
  let bd = 1, bs = -1e9;
  for (let d = 1; d <= 7; d++) {
    const { pc, q } = M.chordInfo(d, key, mode);
    const tones = [pc, M.mod(pc + (q === '' ? 4 : 3), 12), M.mod(pc + (q === 'dim' ? 6 : 7), 12)];
    let s = 0;
    for (let i = 0; i < 12; i++) s += tones.includes(i) ? pcWeights[i] * (i === pc ? 1.3 : 1) : -0.45 * pcWeights[i];
    s += { 1: 0.35, 4: 0.25, 5: 0.25, 6: 0.18, 2: 0.05, 3: 0, 7: -0.4 }[d];
    if (d === prev) s += 0.05;
    if (s > bs) { bs = s; bd = d; }
  }
  return bd;
}

// ---------- reconstruction d'une chanson à partir des notes chantées ----------
// opts: { bpm, t0 (s, temps du 1er temps fort dans la prise), introBars, lyricsBlocks|null, key, mode }
export function buildFromNotes(song, notes, opts) {
  const { bpm } = opts, d16 = 15 / bpm, barDur = 16 * d16;
  const intro = opts.introBars ?? 1;
  // temps chanson de chaque note (grille en doubles-croches)
  const q = notes.map((n) => ({ ...n, g: Math.max(0, Math.round((n.t - opts.t0) / d16)) + intro * 16, d: Math.max(1, Math.round(n.dur / d16)) }));
  for (let i = 1; i < q.length; i++) if (q[i].g <= q[i - 1].g) q[i].g = q[i - 1].g + 1;
  const key = opts.key, mode = opts.mode;
  const shift = (() => { const ms = q.map((n) => n.midi).sort((a, b) => a - b); const med = ms[Math.floor(ms.length / 2)] || 64; return Math.round((M.tonicMidi(key) + 5 - med) / 12) * 12; })();

  // vers : paroles existantes (syllabes) ou « la » par note
  let lines;
  if (opts.lyricsBlocks && opts.lyricsBlocks.length) {
    lines = opts.lyricsBlocks;
  } else {
    // phrases : silence ≥ 1/2 mesure ou 2 mesures pleines
    const phrases = []; let cur = [];
    q.forEach((n, i) => {
      const gap = i ? n.g - (q[i - 1].g + q[i - 1].d) : 0;
      if (cur.length && (gap >= 8 || n.g - cur[0].g >= 32)) { phrases.push(cur); cur = []; }
      cur.push(n);
    });
    if (cur.length) phrases.push(cur);
    const txt = phrases.map((p) => p.map(() => 'la').join(' '));
    const en = (() => { try { return localStorage.getItem('sonyria-lang') === 'en'; } catch (e) { return false; } })();
    song.lyrics = (en ? '[Melody]\n' : '[Mélodie]\n') + txt.join('\n');
    song.blocks = M.parseLyrics(song.lyrics);
    lines = song.blocks;
  }
  // répartir les notes sur les syllabes, dans l'ordre
  const flatLines = lines.flatMap((b) => b.lines);
  const need = flatLines.reduce((a, l) => a + l.syls.length, 0);
  let seq = q.slice();
  while (seq.length > need && seq.length > 1) { // fusionner la plus courte avec sa voisine
    let i = 0; seq.forEach((n, k) => { if (n.d < seq[i].d) i = k; });
    const j = i > 0 ? i - 1 : i + 1; const a = Math.min(i, j), b = Math.max(i, j);
    seq.splice(a, 2, { ...seq[a], d: seq[b].g + seq[b].d - seq[a].g });
  }
  while (seq.length < need && seq.length) { // couper la plus longue
    let i = 0; seq.forEach((n, k) => { if (n.d > seq[i].d) i = k; });
    const n = seq[i]; if (n.d < 2) { seq.push({ ...seq[seq.length - 1], g: seq[seq.length - 1].g + seq[seq.length - 1].d, d: 2 }); continue; }
    const h = Math.floor(n.d / 2);
    seq.splice(i, 1, { ...n, d: h }, { ...n, g: n.g + h, d: n.d - h });
  }
  // placer chaque vers sur des mesures contiguës
  let k = 0, B = Math.floor((seq[0]?.g ?? intro * 16) / 16);
  song.introBars = B; song.intro = false;
  const barPcs = {};
  flatLines.forEach((line, li) => {
    const n = line.syls.length;
    const part = seq.slice(k, k + n); k += n;
    const nx = seq[k];
    if (!part.length) { line.bars = 1; line.notes = []; line.chords = [1]; return; }
    const base = B * 16;
    const lastEnd = part[part.length - 1].g + part[part.length - 1].d - base;
    let bars = nx ? Math.max(Math.floor(nx.g / 16) - B, Math.ceil(lastEnd / 16)) : Math.ceil((lastEnd + 2) / 16);
    bars = Math.max(1, Math.min(8, bars));
    const L16 = bars * 16; let prevEnd = 0;
    line.notes = part.map((p, j) => {
      const st = Math.min(Math.max(p.g - base, prevEnd), L16 - 1);
      const nxt = j < part.length - 1 ? part[j + 1].g - base : L16;
      const dur = Math.max(1, Math.min(p.d, nxt - st, L16 - st));
      const note = { p: M.midiToPos(p.midi + shift, key, mode), rest: st - prevEnd, dur };
      prevEnd = st + dur;
      const bar = B + Math.floor(st / 16);
      (barPcs[bar] = barPcs[bar] || new Array(12).fill(0))[M.mod(Math.round(p.midi), 12)] += p.d;
      return note;
    });
    line.bars = bars; line.custom = true; line._B = B;
    B += bars;
  });
  // accords par mesure
  let prev = 1;
  const introChords = [];
  for (let b = 0; b < song.introBars; b++) introChords.push(1);
  song.introChords = introChords;
  flatLines.forEach((line, i) => {
    line.chords = Array.from({ length: line.bars }, (_, j) => {
      const w = barPcs[line._B + j];
      const c = w ? harmonizeBar(w, key, mode, prev) : prev;
      prev = c; return c;
    });
    if (i === flatLines.length - 1) line.chords[line.chords.length - 1] = 1;
    delete line._B;
  });
  song.key = key; song.mode = mode; song.bpm = bpm;
  return song;
}

// Sonyria — professeur de chant (analyse de ta prise) et remix pro automatique (back vocals + échos aux bons endroits)
import { posToMidi } from './music';
import { s16 } from './engine';
import { pitchTrack } from './hum';
import { makeBacking } from './backing';

const FUNC = /^(le|la|les|un|une|des|de|du|d|l|et|ou|à|a|au|aux|en|dans|sur|je|tu|il|elle|on|nous|vous|ils|elles|me|te|se|ma|ta|sa|mon|ton|son|mes|tes|ses|ce|cet|cette|ces|qui|que|qu|ne|pas|y|the|a|an|and|or|to|of|in|on|i|you|he|she|it|we|they|my|your|is|are|be)$/i;

// fenêtres de temps de chaque ligne (temps de la chanson, en secondes)
export function lineWindows(tl, song) {
  const d = s16(song.bpm);
  return tl.lines.filter((l) => !l.inst && l.syl.length).map((l, i) => ({ ...l, idx: i, t0: l.syl[0].g * d, t1: (l.syl[l.syl.length - 1].g + l.syl[l.syl.length - 1].dur) * d }));
}

export function analyzeTake(data, sr, start, tl, song) {
  const tr = pitchTrack(data, sr), d = s16(song.bpm);
  const frameAt = (songT) => tr.frames[Math.round((songT - start) / tr.hop)];
  const rmsWin = (a, b) => { const i0 = Math.max(0, Math.floor((a - start) * sr)), i1 = Math.min(data.length, Math.floor((b - start) * sr)); if (i1 <= i0) return 0; let s = 0; for (let i = i0; i < i1; i++) s += data[i] * data[i]; return Math.sqrt(s / (i1 - i0)); };
  const lines = [];
  for (const L of lineWindows(tl, song)) {
    if (L.t1 < start || L.t0 > start + data.length / sr) continue;
    const devs = []; let voiced = 0, total = 0, firstVoiced = null, best = { dur: 0 };
    // notes attendues de la ligne
    const ln = song.blocks[L.bi]?.lines[L.li]; const notes = ln?.notes || [];
    let g = L.b0 * 16;
    notes.forEach((n, ni) => {
      g += n.rest || 0;
      const a = g * d, b = (g + n.dur) * d, target = posToMidi(n.p, song.key, song.mode);
      const ms = [];
      for (let t = a + 0.03; t < b - 0.02; t += tr.hop) { const f = frameAt(t); total++; if (f?.midi != null) { voiced++; ms.push(f.midi); if (firstVoiced == null) firstVoiced = t; } }
      if (ms.length >= 2) { ms.sort((x, y) => x - y); const sung = ms[Math.floor(ms.length / 2)]; let c = ((sung - target) % 12 + 18) % 12 - 6; devs.push(c * 100); }
      const syl = ln.syls[ni];
      if (syl && n.dur > best.dur && syl.t && !FUNC.test(syl.word || syl.t)) best = { dur: n.dur, ni };
      g += n.dur;
    });
    const cents = devs.length ? devs.reduce((x, y) => x + y, 0) / devs.length : null;
    const spread = devs.length ? Math.sqrt(devs.reduce((x, y) => x + (y - cents) ** 2, 0) / devs.length) : null;
    const db = 20 * Math.log10(rmsWin(L.t0, L.t1) + 1e-6);
    // mot fort : le plus long sur un mot qui porte le sens
    const words = L.text.split(/\s+/).filter(Boolean);
    const strong = words.filter((w) => !FUNC.test(w.replace(/[^\p{L}']/gu, '').replace(/^[ldjmtsnqu]'/i, ''))).sort((a, b) => b.length - a.length)[0] || words[0] || '';
    lines.push({ idx: L.idx, bi: L.bi, li: L.li, text: L.text, label: L.label, type: L.type, dyn: L.dyn, t0: L.t0, t1: L.t1, cents, spread, db, voiced: total ? voiced / total : 0, late: firstVoiced != null ? (firstVoiced - L.t0) * 1000 : null, strong });
  }
  // comparaisons entre sections (le refrain doit monter en énergie)
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const vDb = avg(lines.filter((l) => l.type === 'verse').map((l) => l.db)), cDb = avg(lines.filter((l) => l.type === 'chorus').map((l) => l.db));
  lines.forEach((l) => {
    const tips = [];
    if (l.voiced < 0.45) tips.push({ k: 'miss', s: 2 });
    if (l.cents != null && Math.abs(l.cents) > 100) tips.push({ k: 'off', v: Math.round(Math.abs(l.cents) / 100), up: l.cents < 0, s: 2 });
    else if (l.cents != null && Math.abs(l.cents) > 35) tips.push({ k: l.cents > 0 ? 'high' : 'low', v: Math.round(Math.abs(l.cents)), s: Math.abs(l.cents) > 60 ? 2 : 1 });
    if (l.spread != null && l.spread > 55) tips.push({ k: 'wobble', s: 1 });
    if (l.late != null && l.late > 140) tips.push({ k: 'late', v: Math.round(l.late), s: 1 });
    if (l.late != null && l.late < -140) tips.push({ k: 'early', v: Math.round(-l.late), s: 1 });
    if (l.type === 'chorus' && vDb != null && l.db < vDb + 1) tips.push({ k: 'more', s: 1 });
    if ((l.dyn === 'soft' || l.dyn === 'emo') && vDb != null && l.db > vDb + 3) tips.push({ k: 'less', s: 1 });
    if (l.voiced >= 0.45) tips.push({ k: 'emph', w: l.strong, s: 0 });
    l.tips = tips; l.ok = !tips.some((t) => t.s > 0);
  });
  const pitched = lines.filter((l) => l.cents != null);
  const pitchScore = pitched.length ? Math.round(100 * pitched.filter((l) => Math.abs(l.cents) <= 35).length / pitched.length) : null;
  const timed = lines.filter((l) => l.late != null);
  const timeScore = timed.length ? Math.round(100 * timed.filter((l) => Math.abs(l.late) <= 140).length / timed.length) : null;
  const dynOk = vDb == null || cDb == null ? null : cDb >= vDb + 1;
  return { lines, pitchScore, timeScore, dynOk, chorusGain: vDb != null && cDb != null ? +(cDb - vDb).toFixed(1) : null };
}

// garde seulement les passages voulus d'une piste (fondus de 30 ms)
function mask(data, sr, start, wins) {
  const out = new Float32Array(data.length), r = Math.round(sr * 0.03);
  wins.forEach(([a, b]) => {
    const i0 = Math.max(0, Math.floor((a - start) * sr)), i1 = Math.min(data.length, Math.floor((b - start) * sr));
    for (let i = i0; i < i1; i++) { const e = Math.min(1, (i - i0) / r, (i1 - i) / r); out[i] = data[i] * e; }
  });
  return out;
}

// remix pro : doublage + harmonies sur les refrains, échos en fin de phrase, réglages de mixage
export function remixPlan(data, sr, start, tl, song) {
  const W = lineWindows(tl, song);
  const chorus = W.filter((l) => l.type === 'chorus').map((l) => [l.t0 - 0.05, l.t1 + 0.25]);
  const ends = W.map((l) => [Math.max(l.t0, l.t1 - 0.55), l.t1 + 0.15]);
  const last = W.length ? [[W[W.length - 1].t0 - 0.05, W[W.length - 1].t1 + 0.3]] : [];
  const out = [];
  if (chorus.length) {
    const [dl, dr] = makeBacking(data, sr, 'double', song.key, song.mode);
    out.push({ name: 'Doublage refrain G', data: mask(dl, sr, start, chorus), pan: -0.7, vol: 0.42, fx: 'studio', echo: 0.05, reverb: 0.35 });
    out.push({ name: 'Doublage refrain D', data: mask(dr, sr, start, chorus), pan: 0.7, vol: 0.42, fx: 'studio', echo: 0.05, reverb: 0.35 });
    const [third] = makeBacking(data, sr, 'third', song.key, song.mode);
    out.push({ name: 'Harmonie refrain (tierce)', data: mask(third, sr, start, chorus), pan: -0.35, vol: 0.32, fx: 'stade', echo: 0.18, reverb: 0.55 });
    const finale = chorus.slice(-2);
    const [fifth] = makeBacking(data, sr, 'fifth', song.key, song.mode);
    out.push({ name: 'Harmonie finale (quinte)', data: mask(fifth, sr, start, finale.length ? finale : last), pan: 0.35, vol: 0.28, fx: 'stade', echo: 0.18, reverb: 0.6 });
  }
  out.push({ name: 'Échos de fin de phrase', data: mask(data, sr, start, ends), pan: 0, vol: 0.4, fx: 'stade', echo: 0.6, fb: 0.5, echoTime: '1/4', reverb: 0.55 });
  return out;
}

// ---------- montage (comping) : la meilleure prise pour chaque ligne, raccords transparents ----------
const rmsOf = (d) => { let s = 0, n = 0; for (let i = 0; i < d.length; i += 4) { s += d[i] * d[i]; n++; } return Math.sqrt(s / Math.max(1, n)) + 1e-6; };
export const covers = (t, L) => t.data && t.start <= L.t0 + 0.05 && t.start + t.data.length / t.sr >= L.t1 - 0.05;
// score simple d'une prise sur une ligne : notes chantées, justesse, départ à temps
export function bestTakes(takes, tl, song) {
  const W = lineWindows(tl, song), pick = {};
  const res = takes.map((t) => ({ t, a: analyzeTake(t.data, t.sr, t.start, tl, song) }));
  W.forEach((L) => {
    let best = null, bs = -1e9;
    res.forEach(({ t, a }) => {
      if (!covers(t, L)) return;
      const r = a.lines.find((x) => x.idx === L.idx); if (!r) return;
      const sc = r.voiced * 100 - (r.cents == null ? 30 : Math.min(100, Math.abs(r.cents)) * 0.6) - (r.late == null ? 10 : Math.min(300, Math.abs(r.late)) * 0.05);
      if (sc > bs) { bs = sc; best = t.id; }
    });
    if (best) pick[L.idx] = best;
  });
  return pick;
}
export function buildComp(takes, tl, song, choice) {
  const W = lineWindows(tl, song); if (!W.length) return null;
  const sr = takes[0].sr, end = W[W.length - 1].t1 + 2, out = new Float32Array(Math.ceil(end * sr));
  const target = 0.08, gainOf = {}; takes.forEach((t) => { gainOf[t.id] = Math.min(4, target / rmsOf(t.data)); }); // même niveau d'une prise à l'autre
  const X = Math.round(sr * 0.06); // fondu enchaîné de 60 ms
  W.forEach((L, i) => {
    const id = choice[L.idx]; const t = takes.find((x) => x.id === id && covers(x, L)); if (!t) return;
    const a = Math.max(0, (i ? (W[i - 1].t1 + L.t0) / 2 : L.t0 - 0.6)), b = i < W.length - 1 ? (L.t1 + W[i + 1].t0) / 2 : L.t1 + 1.5;
    const i0 = Math.floor(a * sr), i1 = Math.min(out.length, Math.floor(b * sr)), g = gainOf[t.id];
    const h = X / 2, first = i === 0, last = i === W.length - 1;
    for (let k = i0 - h; k < i1 + h; k++) {
      if (k < 0 || k >= out.length) continue;
      const src = Math.round(k - t.start * sr); if (src < 0 || src >= t.data.length) continue;
      // fondus centrés sur chaque raccord : deux prises voisines se croisent et la somme reste à 1
      const e = k < i0 + h ? (first ? 1 : (k - (i0 - h)) / X) : k >= i1 - h ? (last ? 1 : 1 - (k - (i1 - h)) / X) : 1;
      out[k] += t.data[src] * g * Math.max(0, Math.min(1, e));
    }
  });
  return { data: out, sr };
}

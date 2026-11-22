// Sonyria — théorie musicale, découpage des syllabes et génération (logique pure, sans DOM)

export const NOTE_EN = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const NOTE_FR = ['Do', 'Do#', 'Ré', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
export const SCALES = { maj: [0, 2, 4, 5, 7, 9, 11], min: [0, 2, 3, 5, 7, 8, 10] };

export const mod = (n, m) => ((n % m) + m) % m;

// ---------- Styles ----------
// hits: [pas16, durée16] des accords ; bass: [pas, durée, intervalle] ; prog: progressions en degrés 1..7
export const STYLES = {
  pop: { n: 'Pop', e: '🎤', bpm: 104, range: [96, 118], swing: 0, chord: 'piano', lead: 'voix',
    hits: [[0, 6], [6, 2], [8, 6], [14, 2]], bass: [[0, 3, 0], [6, 2, 0], [8, 3, 0], [12, 2, 7], [14, 2, 0]],
    prog: { maj: [[1, 5, 6, 4], [6, 4, 1, 5], [1, 6, 4, 5]], min: [[1, 6, 3, 7], [1, 4, 6, 5], [6, 7, 1, 1]] }, drums: 'pop' },
  ballade: { n: 'Ballade', e: '🌙', bpm: 72, range: [62, 80], swing: 0, chord: 'pad', lead: 'voix',
    hits: [[0, 16]], bass: [[0, 8, 0], [8, 8, 7]],
    prog: { maj: [[1, 5, 6, 3], [4, 1, 5, 6], [1, 3, 4, 5]], min: [[1, 6, 4, 5], [1, 7, 6, 5], [6, 4, 1, 5]] }, drums: 'ballade' },
  hiphop: { n: 'Hip-hop', e: '🎧', bpm: 88, range: [82, 96], swing: 0.25, chord: 'epiano', lead: 'synth',
    hits: [[0, 12]], bass: [[0, 6, 0], [7, 3, 0], [10, 6, 0]],
    prog: { maj: [[6, 4, 1, 5], [2, 5, 1, 6], [4, 3, 6, 1]], min: [[1, 6, 7, 1], [1, 4, 1, 5], [1, 7, 6, 7]] }, drums: 'hiphop' },
  trap: { n: 'Trap', e: '🔥', bpm: 140, range: [130, 150], swing: 0, chord: 'pad', lead: 'synth',
    hits: [[0, 16]], bass: [[0, 10, 0], [10, 3, 0], [14, 2, 7]],
    prog: { maj: [[6, 4, 6, 5], [1, 6, 4, 4]], min: [[1, 6, 1, 7], [1, 1, 6, 5], [1, 4, 6, 5]] }, drums: 'trap' },
  rnb: { n: 'R&B', e: '💜', bpm: 76, range: [68, 90], swing: 0.3, chord: 'epiano', lead: 'voix',
    hits: [[0, 7], [7, 9]], bass: [[0, 5, 0], [6, 2, 0], [8, 4, 7], [13, 3, 0]],
    prog: { maj: [[2, 5, 1, 6], [4, 3, 2, 1], [1, 6, 2, 5]], min: [[1, 4, 7, 3], [6, 5, 1, 1], [4, 5, 1, 6]] }, drums: 'rnb' },
  rock: { n: 'Rock', e: '🎸', bpm: 128, range: [116, 150], swing: 0, chord: 'power', lead: 'synth',
    hits: [[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]], bass: [[0, 2, 0], [2, 2, 0], [4, 2, 0], [6, 2, 0], [8, 2, 0], [10, 2, 0], [12, 2, 0], [14, 2, 0]],
    prog: { maj: [[1, 4, 5, 4], [1, 5, 6, 4], [6, 4, 1, 5]], min: [[1, 7, 6, 7], [1, 6, 7, 1]] }, drums: 'rock' },
  folk: { n: 'Folk', e: '🪕', bpm: 96, range: [84, 110], swing: 0.1, chord: 'pluck', lead: 'flute',
    hits: [[0, 3], [4, 2], [6, 2], [8, 3], [12, 2], [14, 2]], bass: [[0, 4, 0], [8, 4, 7]],
    prog: { maj: [[1, 4, 1, 5], [1, 5, 4, 1], [6, 4, 1, 5]], min: [[1, 7, 1, 5], [1, 4, 7, 1]] }, drums: 'folk' },
  reggaeton: { n: 'Reggaeton', e: '🌴', bpm: 94, range: [88, 100], swing: 0, chord: 'pluck', lead: 'synth',
    hits: [[3, 2], [6, 2], [11, 2], [14, 2]], bass: [[0, 3, 0], [3, 3, 0], [8, 3, 0], [11, 3, 7]],
    prog: { maj: [[6, 4, 1, 5], [1, 5, 6, 4]], min: [[1, 6, 3, 7], [1, 4, 5, 1]] }, drums: 'reggaeton' },
  afro: { n: 'Afro', e: '🥁', bpm: 104, range: [96, 112], swing: 0.15, chord: 'pluck', lead: 'voix',
    hits: [[0, 2], [3, 2], [6, 2], [10, 2], [12, 2]], bass: [[0, 3, 0], [4, 2, 7], [7, 3, 0], [12, 3, 5]],
    prog: { maj: [[1, 4, 6, 5], [2, 5, 1, 1], [4, 5, 6, 6]], min: [[1, 4, 1, 5], [6, 7, 1, 1]] }, drums: 'afro' },
  edm: { n: 'EDM', e: '⚡', bpm: 124, range: [120, 128], swing: 0, chord: 'supersaw', lead: 'synth',
    hits: [[2, 2], [6, 2], [10, 2], [14, 2]], bass: [[2, 2, 0], [6, 2, 0], [10, 2, 0], [14, 2, 12]],
    prog: { maj: [[6, 4, 1, 5], [4, 5, 6, 6], [1, 5, 6, 4]], min: [[1, 6, 3, 7], [6, 7, 1, 1]] }, drums: 'edm' },
  lofi: { n: 'Lo-fi', e: '☕', bpm: 80, range: [70, 88], swing: 0.55, chord: 'epiano', lead: 'piano',
    hits: [[0, 7], [7, 9]], bass: [[0, 6, 0], [7, 3, 0], [10, 4, 7]],
    prog: { maj: [[2, 5, 1, 6], [4, 3, 6, 2], [1, 6, 2, 5]], min: [[1, 4, 7, 3], [4, 7, 1, 1]] }, drums: 'lofi' },
  jazz: { n: 'Jazz', e: '🎷', bpm: 116, range: [96, 160], swing: 0.6, chord: 'epiano', lead: 'flute',
    hits: [[0, 3], [6, 2], [10, 4]], bass: [[0, 4, 0], [4, 4, 4], [8, 4, 7], [12, 4, 9]],
    prog: { maj: [[2, 5, 1, 1], [1, 6, 2, 5], [3, 6, 2, 5]], min: [[2, 5, 1, 1], [1, 4, 2, 5]] }, drums: 'jazz' },
};

export const DRUM_ROWS = ['kick', 'snare', 'clap', 'hat', 'open'];
export const DRUM_LABELS = { kick: 'Grosse caisse', snare: 'Caisse claire', clap: 'Clap', hat: 'Charley', open: 'Charley ouv.' };
const P = (s) => s.split('').map((c) => (c === 'x' ? 1 : 0));
export const DRUM_PRESETS = {
  pop: { kick: 'x.......x.x.....', snare: '....x.......x...', clap: '............x...', hat: 'x.x.x.x.x.x.x.x.', open: '..............x.' },
  ballade: { kick: 'x.........x.....', snare: '........x.......', clap: '................', hat: 'x...x...x...x...', open: '................' },
  hiphop: { kick: 'x......x..x.....', snare: '....x.......x...', clap: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx', open: '................' },
  trap: { kick: 'x......x..x.....', snare: '........x.......', clap: '........x.......', hat: 'xxxxx.xxxxxxx.xx', open: '...........x....' },
  rnb: { kick: 'x.....x...x.....', snare: '....x.......x...', clap: '............x...', hat: 'x.x.x.x.x.x.x.x.', open: '......x.........' },
  rock: { kick: 'x.....x.x.......', snare: '....x.......x...', clap: '................', hat: 'x.x.x.x.x.x.x.x.', open: '................' },
  folk: { kick: 'x.......x.......', snare: '....x.......x...', clap: '................', hat: 'x.xxx.xxx.xxx.xx', open: '................' },
  reggaeton: { kick: 'x...x...x...x...', snare: '...x..x....x..x.', clap: '................', hat: '..x...x...x...x.', open: '................' },
  afro: { kick: 'x..x....x..x....', snare: '......x.......x.', clap: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', open: '..........x.....' },
  edm: { kick: 'x...x...x...x...', snare: '....x.......x...', clap: '....x.......x...', hat: '..x...x...x...x.', open: '..x...x...x...x.' },
  lofi: { kick: 'x......x.x......', snare: '....x.......x...', clap: '................', hat: 'x.x.x.x.x.x.x.x.', open: '................' },
  jazz: { kick: 'x.........x.....', snare: '......x.......x.', clap: '................', hat: 'x..xx..xx..xx..x', open: '................' },
  vide: { kick: '................', snare: '................', clap: '................', hat: '................', open: '................' },
};
export function drumPreset(name) {
  const p = DRUM_PRESETS[name] || DRUM_PRESETS.pop;
  const o = {};
  DRUM_ROWS.forEach((r) => (o[r] = P(p[r])));
  return o;
}

// ---------- Accords ----------
export function chordInfo(deg, key, mode) {
  const sc = SCALES[mode];
  const r = sc[deg - 1], t = sc[(deg + 1) % 7], f = sc[(deg + 3) % 7];
  const third = mod(t - r, 12), fifth = mod(f - r, 12);
  const q = third === 4 ? '' : fifth === 6 ? 'dim' : 'm';
  return { pc: mod(key + r, 12), q };
}
export function chordName(deg, key, mode, fr) {
  const { pc, q } = chordInfo(deg, key, mode);
  return (fr ? NOTE_FR : NOTE_EN)[pc] + q;
}
// notes MIDI de l'accord, voicing autour de Do4
export function chordMidis(deg, key, mode, seventh) {
  const sc = SCALES[mode];
  const pos = [deg - 1, deg + 1, deg + 3];
  if (seventh) pos.push(deg + 5);
  return pos.map((p) => {
    let m = 48 + key + sc[mod(p, 7)] + 12 * Math.floor(p / 7);
    while (m > 67) m -= 12;
    while (m < 52) m += 12;
    return m;
  });
}
export function bassMidi(deg, key, mode) {
  const pc = mod(key + SCALES[mode][deg - 1], 12);
  return 36 + pc - (pc > 7 ? 12 : 0);
}
export function chordTonePcs(deg) {
  return [mod(deg - 1, 7), mod(deg + 1, 7), mod(deg + 3, 7)];
}

// position (degré, peut dépasser l'octave) -> MIDI
export function tonicMidi(key) {
  const t = 60 + key;
  return t > 65 ? t - 12 : t;
}
export function posToMidi(p, key, mode) {
  return tonicMidi(key) + SCALES[mode][mod(p, 7)] + 12 * Math.floor(p / 7);
}
export function midiName(m, fr) {
  return (fr ? NOTE_FR : NOTE_EN)[mod(m, 12)] + (Math.floor(m / 12) - 1);
}

// ---------- Syllabes ----------
const VOW = 'aeiouyàâäéèêëîïôöùûüÿœæ';
const isV = (c) => VOW.includes(c);
const INSEP = ['qu', 'gu', "qu'", 'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'tr', 'vr', 'ch', 'ph', 'th', 'gn', 'qu', 'gu', 'sh', 'wh'];

export function vowelOf(s) {
  const l = s.toLowerCase();
  if (/ou|oo|u(?!e)/.test(l) && !/eu|au/.test(l)) return /ou|oo/.test(l) ? 'u' : 'i';
  if (/eau|au|o|ô/.test(l) && !/oi/.test(l)) return 'o';
  if (/oi|a|à|â/.test(l)) return 'a';
  if (/i|y|î/.test(l)) return 'i';
  return 'e';
}

function splitWord(word, silentEnt) {
  const low = word.toLowerCase();
  const letters = low.replace(/[^a-zàâäéèêëîïôöùûüÿœæç'-]/g, '');
  if (!letters) return [];
  const groups = [];
  // « qu » et « gu » + voyelle : le u ne compte pas comme voyelle
  const vAt = (i) => isV(low[i]) && !(low[i] === 'u' && (low[i - 1] === 'q' || (low[i - 1] === 'g' && /[eiéèêy]/.test(low[i + 1] || ''))));
  for (let i = 0; i < low.length; ) {
    if (vAt(i)) {
      let j = i;
      while (j < low.length && vAt(j)) j++;
      groups.push([i, j]);
      i = j;
    } else i++;
  }
  if (groups.length <= 1) return [word];
  let g = groups;
  const last = g[g.length - 1];
  const tail = low.slice(last[0]).replace(/[^a-zàâäéèêëîïôöùûüÿœæç]/g, '');
  if (/^(e|es)$/.test(tail) || (silentEnt && tail === 'ent')) g = g.slice(0, -1);
  if (g.length <= 1) return [word];
  const cuts = [];
  for (let k = 0; k < g.length - 1; k++) {
    const a = g[k][1], b = g[k + 1][0];
    const cl = low.slice(a, b);
    const n = cl.replace(/[^a-zç]/g, '').length;
    const ap = cl.indexOf("'");
    if (ap >= 0) { const abs = a + ap; cuts.push(Math.max(a, low.slice(abs - 2, abs) === 'qu' ? abs - 2 : abs - 1)); continue; }
    if (n <= 1) cuts.push(a);
    else if (n === 2) cuts.push(INSEP.includes(cl) ? a : a + 1);
    else cuts.push(INSEP.includes(cl.slice(-2)) ? b - 2 : b - 1);
  }
  const out = [];
  let s = 0;
  cuts.forEach((c) => { out.push(word.slice(s, c)); s = c; });
  out.push(word.slice(s));
  return out.filter(Boolean);
}

// texte -> blocs/lignes/syllabes
const HEADER = /^\s*(\[.*\]|(couplet|refrain|pont|intro|outro|fin|chorus|verse|bridge|pré-refrain|pre-refrain|hook|dernier refrain)\b[^a-z]*\d*\s*(\(.*\))?\s*:?)\s*$/i;
// nuances écrites par l'auteur : « tout doucement », « plus puissant », « très émouvant »…
export function dynOf(h) {
  if (/(doucement|doux|douce|calme|soft|intime|chuchot)/.test(h)) return 'soft';
  if (/(puissant|fort|intense|explos|power|énergi)/.test(h)) return 'loud';
  if (/(émouv|emouv|émotion)/.test(h)) return 'emo';
  return 'normal';
}
export const DYN_LABEL = { soft: 'Tout doux', normal: 'Normal', emo: 'Émouvant', loud: 'Puissant' };
export function parseLyrics(text) {
  const blocks = [];
  let cur = null;
  const push = () => { if (cur && cur.lines.length) blocks.push(cur); cur = null; };
  text.replace(/\r/g, '').split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) { push(); return; }
    if (HEADER.test(line)) {
      push();
      const h = line.toLowerCase();
      cur = { type: /refrain|chorus|hook/.test(h) ? 'chorus' : /pont|bridge/.test(h) ? 'bridge' : 'verse', label: line.replace(/[\[\]():]/g, ' ').replace(/\s+/g, ' ').trim(), explicit: true, lines: [], dyn: dynOf(h) };
      return;
    }
    if (!cur) cur = { type: null, label: '', lines: [] };
    cur.lines.push(line);
  });
  push();
  // types automatiques : blocs répétés = refrain
  const norm = (b) => b.lines.join(' ').toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüÿœæç ]/g, '');
  const counts = {};
  blocks.forEach((b) => (counts[norm(b)] = (counts[norm(b)] || 0) + 1));
  let v = 0, alt = 0;
  blocks.forEach((b) => {
    if (!b.type) {
      if (counts[norm(b)] > 1) b.type = 'chorus';
      else if (!Object.values(counts).some((c) => c > 1) && blocks.length > 1) b.type = alt++ % 2 ? 'chorus' : 'verse';
      else b.type = 'verse';
    }
    if (!b.label) b.label = b.type === 'chorus' ? 'Refrain' : b.type === 'bridge' ? 'Pont' : `Couplet ${++v}`;
  });
  return blocks.map((b) => ({
    type: b.type, label: b.label, key: norm(b), dyn: b.dyn || 'normal',
    lines: b.lines.map((l) => ({ text: l, syls: syllabifyLine(l) })),
  }));
}

export function syllabifyLine(line) {
  // séparateur manuel : « / » ou « · » force une coupure, « _ » lie deux syllabes
  const words = line.split(/\s+/).filter(Boolean);
  const out = [];
  words.forEach((w, wi) => {
    const prev = (words[wi - 1] || '').toLowerCase();
    const silentEnt = /^(ils|elles|qu'ils|qu'elles)$/.test(prev);
    const manual = w.split(/[\/·]/);
    manual.forEach((part, pi) => {
      // élision l'amour -> une unité
      const parts = /[a-zàâäéèêëîïôöùûüÿœæç]/i.test(part) ? splitWord(part, silentEnt) : [];
      if (!parts.length) { if (out.length) out[out.length - 1].t += part; return; }
      parts.forEach((s, si) => out.push({ t: s, end: si === parts.length - 1 && pi === manual.length - 1, v: vowelOf(s) }));
    });
  });
  return out;
}

// ---------- Hasard reproductible ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const barsFor = (k) => (k <= 6 ? 1 : k <= 13 ? 2 : k <= 26 ? 4 : 6);

function genRhythm(k, bars, R, variant) {
  const L = bars * 16;
  let start = variant % 3 === 1 && k * 2 < L - 10 ? 2 : 0;
  let A = L - start - 4;
  const d = Array(k).fill(k * 2 <= A ? 2 : 1);
  if (k > A) { start = 0; A = L; d.fill(1); }
  let extra = A - d.reduce((a, b) => a + b, 0);
  const unit = d[0];
  const lastAdd = Math.max(0, Math.min(extra, unit === 2 ? 6 : 3));
  d[k - 1] += lastAdd; extra -= lastAdd;
  let guard = 0;
  while (extra >= unit && guard++ < 400) {
    const i = Math.floor(R() * Math.max(1, k - 1));
    if (d[i] < 6) { d[i] += unit; extra -= unit; }
  }
  if (variant % 3 === 2) for (let i = 0; i + 1 < k - 1; i += 2) if (d[i] === 2 && d[i + 1] === 2 && R() < 0.5) { d[i] = 3; d[i + 1] = 1; }
  return { start, d };
}

function contourAt(type, f) {
  switch (type) {
    case 'arch': return 2 + 4 * Math.sin(Math.PI * f);
    case 'wave': return 3 + 2.5 * Math.sin(2 * Math.PI * f);
    case 'desc': return 6 - 5 * f;
    default: return 1 + 5 * f;
  }
}
function nearest(x, ok, R, lo, hi) {
  let best = null, bd = 99;
  for (let p = lo; p <= hi; p++) if (ok(p)) { const dd = Math.abs(p - x) + R() * 0.3; if (dd < bd) { bd = dd; best = p; } }
  return best ?? Math.round(x);
}

export function genLine(line, chords, seed, opts) {
  const R = rng(seed);
  const k = line.syls.length;
  if (!k) return [];
  const { start, d } = genRhythm(k, line.bars, R, opts.variant);
  const reg = opts.reg || 0;
  const lo = reg - 3, hi = reg + 9;
  let pos = reg + (R() < 0.5 ? 2 : 4);
  let t = start;
  const notes = [];
  for (let i = 0; i < k; i++) {
    const f = k > 1 ? i / (k - 1) : 0;
    const target = reg + contourAt(opts.contour, f);
    const ch = chords[Math.min(Math.floor(t / 16), chords.length - 1)];
    const ct = chordTonePcs(ch);
    const isCt = (p) => ct.includes(mod(p, 7));
    const strong = t % 8 === 0 || d[i] >= 4;
    if (i === k - 1) {
      pos = opts.end === 'tonic' ? nearest(pos, (p) => mod(p, 7) === 0, R, lo, hi) : nearest(pos, (p) => isCt(p) && mod(p, 7) !== 0, R, lo, hi);
    } else if (i === 0) {
      pos = nearest(target, isCt, R, lo, hi);
    } else if (strong) {
      pos = nearest(pos + Math.sign(target - pos), isCt, R, lo, hi);
    } else {
      let step = target > pos + 0.5 ? 1 : target < pos - 0.5 ? -1 : R() < 0.5 ? 1 : -1;
      const r = R();
      if (r < 0.14) step *= 2; else if (r < 0.32) step = 0;
      pos = Math.max(lo, Math.min(hi, pos + step));
    }
    notes.push({ p: pos, rest: i === 0 ? start : 0, dur: d[i] });
    t += d[i];
  }
  return notes;
}

const CONTOURS = ['arch', 'wave', 'desc', 'asc'];

// Génère accords + mélodie pour toute la chanson
export function composeSong(song, variant) {
  const sty = STYLES[song.style];
  const progs = sty.prog[song.mode];
  const done = {};
  song.blocks.forEach((b, bi) => {
    const firstChorus = Object.values(done)[0];
    const src0 = b.type === 'chorus' ? (done[b.key] || firstChorus) : null;
    if (src0) {
      const src = src0;
      b.lines.forEach((l, li) => {
        const s = src.lines[li];
        if (s && s.syls.length === l.syls.length) { l.bars = s.bars; l.chords = [...s.chords]; l.notes = s.notes.map((n) => ({ ...n })); }
        else { l.bars = barsFor(l.syls.length); l.chords = s ? Array.from({ length: l.bars }, (_, i) => s.chords[i % s.chords.length]) : null; fillLine(l, bi, li, b, variant, progs, 0, li === b.lines.length - 1); }
      });
      return;
    }
    let ci = 0;
    const pi = mod(variant + (b.type === 'chorus' ? 1 : b.type === 'bridge' ? 2 : 0), progs.length);
    const prog = progs[pi];
    b.lines.forEach((l, li) => {
      l.bars = barsFor(l.syls.length);
      l.chords = Array.from({ length: l.bars }, () => prog[ci++ % prog.length]);
      const prev2 = b.lines[li - 2];
      if (prev2 && prev2.notes && prev2.syls.length === l.syls.length && li !== b.lines.length - 1) {
        l.notes = prev2.notes.map((n) => ({ ...n }));
      } else {
        fillLine(l, bi, li, b, variant, progs, -1);
      }
      if (li === b.lines.length - 1) {
        // dernière ligne : finir sur la tonique, accord I à la fin
        l.chords[l.chords.length - 1] = b.type === 'chorus' || bi === song.blocks.length - 1 ? 1 : l.chords[l.chords.length - 1];
        fillLine(l, bi, li, b, variant, progs, -1, true);
      }
    });
    if (b.type === 'chorus') done[b.key] = b;
  });
  return song;
}

function fillLine(l, bi, li, b, variant, progs, _x, last) {
  if (!l.bars) l.bars = barsFor(l.syls.length);
  if (!l.chords) l.chords = Array.from({ length: l.bars }, (_, i) => progs[0][i % 4]);
  l.notes = genLine(l, l.chords, variant * 7919 + bi * 131 + li * 17 + 3, {
    variant,
    contour: CONTOURS[mod(variant + bi, CONTOURS.length)],
    reg: b.type === 'chorus' ? 2 : b.type === 'bridge' ? 1 : 0,
    end: last ? 'tonic' : li % 2 ? 'tonic' : 'open',
  });
}

export function regenLine(song, bi, li, seed) {
  const b = song.blocks[bi], l = b.lines[li];
  l.notes = genLine(l, l.chords, seed, { variant: seed % 3, contour: CONTOURS[seed % 4], reg: b.type === 'chorus' ? 2 : 0, end: li === b.lines.length - 1 ? 'tonic' : 'open' });
}

// ---------- Suggestions d'ambiance (locales) ----------
const SAD = /(triste|larme|pleur|seul|nuit|froid|perdu|adieu|mal|manque|vide|ombre|pluie|cri|souvenir|alone|cry|tears|lost|night|cold|goodbye|pain|rain)/gi;
const HAPPY = /(soleil|danse|joie|rire|fête|lumière|amour|ensemble|libre|été|sourire|sun|dance|happy|love|party|light|free|summer|smile|feu|fire)/gi;
const STREET = /(rue|béton|quartier|hood|street|money|cash|flow|game|grind|block|squad|gang)/gi;

export function suggestAmbiances(blocks) {
  const all = blocks.flatMap((b) => b.lines);
  const text = all.map((l) => l.text).join(' ');
  const sad = (text.match(SAD) || []).length, happy = (text.match(HAPPY) || []).length, street = (text.match(STREET) || []).length;
  const avg = all.length ? all.reduce((a, l) => a + l.syls.length, 0) / all.length : 8;
  const dense = avg > 11;
  const minor = sad > happy;
  const list = [];
  const add = (style, mode, key, why) => {
    const s = STYLES[style];
    let bpm = s.bpm;
    if (dense && s.range) bpm = Math.max(s.range[0], Math.round(bpm * 0.92));
    if (!dense && avg < 7 && s.range) bpm = Math.min(s.range[1], Math.round(bpm * 1.06));
    list.push({ style, mode, key, bpm, why });
  };
  if (minor) {
    add('ballade', 'min', 9, 'Texte mélancolique : tempo lent, mineur, nappes douces');
    add('rnb', 'min', 2, 'Émotion intime, groove souple et accords riches');
    add(street ? 'trap' : 'lofi', 'min', 4, street ? 'Énergie urbaine sombre, charleys rapides' : 'Ambiance feutrée et nostalgique');
    add('pop', 'min', 7, 'Pop mineure accrocheuse pour un refrain fort');
  } else {
    add('pop', 'maj', 0, 'Texte lumineux : pop entraînante en majeur');
    add(street ? 'hiphop' : 'folk', 'maj', 7, street ? 'Flow rythmé, boom-bap posé' : 'Chaleur acoustique, guitare pincée');
    add(dense ? 'reggaeton' : 'afro', 'maj', 2, 'Groove dansant pour un refrain festif');
    add('edm', 'maj', 5, 'Version électro pour monter l’énergie');
  }
  if (dense) list.forEach((s) => (s.why += ' · lignes chargées, tempo ajusté'));
  return list;
}

// ---------- Analyse de la voix enregistrée ----------
// Détection des attaques (enveloppe d'énergie) et de la hauteur (autocorrélation)
export function detectOnsets(samples, sr) {
  const hop = Math.round(sr * 0.01), win = hop * 2;
  const env = [];
  for (let i = 0; i + win < samples.length; i += hop) {
    let s = 0;
    for (let j = 0; j < win; j++) s += samples[i + j] * samples[i + j];
    env.push(Math.sqrt(s / win));
  }
  const max = Math.max(...env, 1e-6);
  const norm = env.map((e) => e / max);
  const floor = 0.08;
  const onsets = [];
  let last = -999, prev = 0;
  // flux positif lissé
  for (let i = 2; i < norm.length; i++) {
    const rise = norm[i] - Math.min(norm[i - 1], norm[i - 2]);
    if (norm[i] > floor && rise > 0.06 && i - last > 7 && norm[i] >= prev) { onsets.push({ t: i * hop / sr, s: rise }); last = i; }
    prev = norm[i];
  }
  return { onsets, env: norm, hop: hop / sr };
}

export function detectPitch(samples, sr, t0, t1) {
  const a = Math.floor(t0 * sr), b = Math.min(samples.length, Math.floor(t1 * sr));
  const n = Math.min(2048, b - a);
  if (n < 512) return null;
  const off = a + Math.floor((b - a - n) / 2);
  const minLag = Math.floor(sr / 900), maxLag = Math.floor(sr / 70);
  let best = 0, bestLag = 0, energy = 0;
  for (let i = 0; i < n; i++) energy += samples[off + i] ** 2;
  if (energy / n < 1e-5) return null;
  for (let lag = minLag; lag <= maxLag && lag < n; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += samples[off + i] * samples[off + i + lag];
    if (s > best) { best = s; bestLag = lag; }
  }
  if (!bestLag || best / energy < 0.3) return null;
  return 69 + 12 * Math.log2(sr / bestLag / 440);
}

// midi -> position la plus proche dans la gamme
export function midiToPos(m, key, mode) {
  let best = 0, bd = 99;
  for (let p = -7; p <= 14; p++) { const d = Math.abs(posToMidi(p, key, mode) - m); if (d < bd) { bd = d; best = p; } }
  return best;
}

// Tempo d'un audio importé : autocorrélation de l'enveloppe d'attaques
export function detectBpm(samples, sr) {
  const hop = Math.round(sr * 0.01), win = hop * 2;
  const env = [];
  let prev = 0;
  for (let i = 0; i + win < samples.length && env.length < 6000; i += hop) {
    let s = 0;
    for (let j = 0; j < win; j += 2) s += samples[i + j] * samples[i + j];
    const e = Math.sqrt(s / (win / 2));
    env.push(Math.max(0, e - prev)); prev = e;
  }
  if (env.length < 300) return null;
  const m = env.reduce((a, b) => a + b, 0) / env.length;
  const x = env.map((e) => e - m);
  let best = 0, bestLag = 0;
  for (let bpm = 60; bpm <= 180; bpm++) {
    const lag = 6000 / bpm;
    let s = 0;
    for (let i = 0; i + lag * 2 < x.length; i++) s += x[i] * (x[Math.round(i + lag)] + 0.5 * x[Math.round(i + lag * 2)]);
    if (bpm >= 80 && bpm <= 140) s *= 1.08; // zone la plus courante
    if (s > best) { best = s; bestLag = bpm; }
  }
  return bestLag || null;
}

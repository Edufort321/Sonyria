// Sonyria — plusieurs beats (A, B, C…) de 1, 2 ou 4 mesures, joués par section ou enchaînés pour une chanson de la durée voulue
import { drumPreset, DRUM_ROWS } from './music';

export function ensurePatterns(song) {
  if (!Array.isArray(song.patterns) || !song.patterns.length) song.patterns = [{ id: 'A', name: 'Beat A', bars: 1, auto: true, drums: song.drums || drumPreset('pop') }];
  song.patterns.forEach((p) => { p.bars = p.bars || 1; DRUM_ROWS.forEach((r) => { if (!p.drums[r]) p.drums[r] = Array(16 * p.bars).fill(0); }); Object.keys(p.drums).forEach((r) => { const a = p.drums[r]; if (a.length < 16 * p.bars) p.drums[r] = [...a, ...Array(16 * p.bars - a.length).fill(0)]; }); });
  song.drums = song.patterns[0].drums; // compatibilité
  if (!song.secBeat) song.secBeat = {};
  if (!Array.isArray(song.beatSeq) || !song.beatSeq.length) song.beatSeq = [{ p: song.patterns[0].id, n: 4 }];
  return song.patterns;
}
export const patById = (song, id) => (song.patterns || []).find((p) => p.id === id) || song.patterns?.[0];
export function nextId(song) { const used = new Set((song.patterns || []).map((p) => p.id)); for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!used.has(c)) return c; return 'P' + Date.now(); }
export function addPattern(song, from, preset) {
  ensurePatterns(song);
  const id = nextId(song), src = from ? patById(song, from) : null;
  const drums = preset ? drumPreset(preset) : src ? JSON.parse(JSON.stringify(src.drums)) : Object.fromEntries(DRUM_ROWS.map((r) => [r, Array(16).fill(0)]));
  const p = { id, name: 'Beat ' + id, bars: src && !preset ? src.bars : 1, drums };
  song.patterns.push(p); return p;
}
export function setBars(p, n) {
  const old = p.bars || 1; p.bars = n;
  Object.keys(p.drums).forEach((r) => { const a = p.drums[r]; p.drums[r] = Array.from({ length: 16 * n }, (_, i) => (i < a.length ? a[i] : a[i % (16 * old)] || 0)); });
}
// beat seul : durée totale de l'enchaînement (une passe)
export const seqBars = (song) => (song.beatSeq || []).reduce((a, it) => a + (patById(song, it.p)?.bars || 1) * (it.n || 1), 0);

// ---------- arrangement automatique : un beat par partie, qui évolue et s'enchaîne ----------
const BLANK = (n) => Array(16 * n).fill(0);
function two(bar) { // 1 mesure → 2 mesures identiques
  const o = {}; Object.keys(bar).forEach((r) => (o[r] = [...bar[r], ...bar[r]])); return o;
}
function base(style) { return drumPreset(style); }
export function arrangeBeats(song) {
  const st = song.style || 'pop', b = base(st);
  const rows = [...DRUM_ROWS];
  const empty = () => Object.fromEntries(rows.map((r) => [r, BLANK(2)]));
  // Intro : charleston + kick léger, 2 mesures
  const intro = empty();
  for (let i = 0; i < 32; i += 4) intro.hat[i] = 1;
  intro.kick[0] = 1; intro.kick[16] = 1; intro.snare[28] = intro.snare[30] = 1;
  // Couplet : beat du style sans open/clap, variation de kick en 2e mesure
  const verse = two({ ...b, open: BLANK(1), clap: BLANK(1) });
  verse.kick[16 + 14] = 1;
  // Refrain : plein, clap sur 2 et 4, open hat en contretemps, crash au début, roulement à la fin
  const ch = two(b);
  ch.crash = BLANK(2); ch.crash[0] = 1;
  [4, 12, 20, 28].forEach((i) => (ch.clap[i] = 1));
  [6, 14, 22].forEach((i) => (ch.open[i] = 1));
  ch.snare[29] = ch.snare[30] = ch.snare[31] = 1;
  // Pont : demi-temps, plus aéré
  const br = empty();
  [0, 16, 26].forEach((i) => (br.kick[i] = 1)); [8, 24].forEach((i) => (br.snare[i] = 1));
  for (let i = 0; i < 32; i += 4) br.hat[i] = 1;
  br.ride = BLANK(2); for (let i = 2; i < 32; i += 4) br.ride[i] = 1;
  // Fin : un coup + crash
  const out = empty(); out.kick[0] = 1; out.crash = BLANK(2); out.crash[0] = 1; for (let i = 0; i < 16; i += 4) out.hat[i] = 1;
  const keepUser = (song.patterns || []).filter((p) => !p.auto);
  const mk = (id, name, drums) => ({ id, name, bars: 2, drums, auto: true });
  const used = new Set(keepUser.map((p) => p.id)); const ids = []; for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!used.has(c)) ids.push(c);
  const P = { intro: mk(ids[0], 'Intro', intro), verse: mk(ids[1], 'Couplet', verse), chorus: mk(ids[2], 'Refrain', ch), bridge: mk(ids[3], 'Pont', br), outro: mk(ids[4], 'Fin', out) };
  song.patterns = [P.verse, P.chorus, P.bridge, P.intro, P.outro, ...keepUser];
  // fixe toutes les lignes à 32 pas
  song.patterns.forEach((p) => { if (p.auto) Object.keys(p.drums).forEach((r) => { if (p.drums[r].length < 32) p.drums[r] = [...p.drums[r], ...BLANK(1)].slice(0, 32); }); });
  song.drums = song.patterns[0].drums;
  song.secBeat = { intro: P.intro.id, verse: P.verse.id, chorus: P.chorus.id, solo: P.chorus.id, bridge: P.bridge.id, outro: P.outro.id, prechorus: P.verse.id };
  // beat seul (sans paroles) : forme d'une vraie chanson, ~3-4 min selon la durée choisie
  song.beatSeq = [
    { p: P.intro.id, n: 2, sec: 'intro' }, { p: P.verse.id, n: 4, sec: 'verse' }, { p: P.chorus.id, n: 4, sec: 'chorus' },
    { p: P.verse.id, n: 4, sec: 'verse' }, { p: P.chorus.id, n: 4, sec: 'chorus' }, { p: P.bridge.id, n: 4, sec: 'bridge' },
    { p: P.chorus.id, n: 4, sec: 'chorus' }, { p: P.outro.id, n: 1, sec: 'outro' },
  ];
  song.drumsOn = true;
  return song.patterns;
}

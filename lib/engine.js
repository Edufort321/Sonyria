// Sonyria — moteur audio : synthés, batterie, pistes enregistrées, effets, lecture, enregistrement, export
import { STYLES, DRUM_ROWS, chordMidis, bassMidi, posToMidi } from './music';
import { pick, kitPiece, loadInstrument, loadKit } from './samples';

// ---------- quels vrais instruments pour quel rôle ----------
export const CHORD_SOUNDS = { piano: 'piano', epiano: 'epiano', pluck: 'guitar', nylon: 'nylon', eguitar: 'eguitar', power: 'drive', strings: 'strings', choir: 'choir', pad: 'strings', supersaw: null, synthpad: null };
export const LEAD_SOUNDS = { voix: 'choir', piano: 'piano', sax: 'sax', altosax: 'altosax', trumpet: 'trumpet', flute: 'flute', guitar: 'eguitar', nylon: 'nylon', strings: 'strings', synth: null };
const STYLE_KIT = { pop: 'acoustic', ballade: 'acoustic', rock: 'acoustic', folk: 'acoustic', jazz: 'acoustic', afro: 'acoustic', hiphop: '808', trap: '808', rnb: '808', reggaeton: '808', edm: '808', lofi: 'linn' };
export const kitFor = (song) => song.kit || STYLE_KIT[song.style] || 'acoustic';
export function chordInst(type, style) { if (type === 'pad' && (style === 'trap' || style === 'edm')) return null; return CHORD_SOUNDS[type] ?? null; }
export function bassInst(style) { return style === 'jazz' || style === 'folk' ? 'upright' : style === 'trap' || style === 'hiphop' || style === 'edm' ? null : 'bass'; }
export async function prepareSamples(ctx, song) {
  const sty = STYLES[song.style];
  const ch = chordInst(song.chordSound || sty.chord, song.style), ld = LEAD_SOUNDS[song.leadSound], bs = bassInst(song.style);
  await Promise.all([loadKit(ctx, kitFor(song)), ch && loadInstrument(ctx, ch), ld && loadInstrument(ctx, ld), bs && loadInstrument(ctx, bs)]);
}

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- Timeline (pure) ----------
export function buildTimeline(song) {
  const lines = [];
  const bars = [];
  const notes = new Map();
  const intro = song.introBars != null ? song.introBars : song.intro ? 2 : 0;
  const first = song.blocks[0]?.lines[0];
  for (let i = 0; i < intro; i++) bars.push({ chord: song.introChords?.[i] || first?.chords?.[i % (first?.chords?.length || 1)] || 1, li: -1 });
  song.blocks.forEach((b, bi) => b.lines.forEach((l, li) => {
    if (!l.chords || !l.notes) return;
    const b0 = bars.length;
    l.chords.forEach((c, ci) => bars.push({ chord: c, bi, li, dyn: b.dyn || 'normal', sectionStart: li === 0 && ci === 0 }));
    let t = 0;
    const syl = [];
    l.notes.forEach((n, ni) => {
      t += n.rest || 0;
      const g = b0 * 16 + t;
      const ev = { bi, li, ni, p: n.p, dur: n.dur, g, v: l.syls[ni]?.v || 'a' };
      if (!notes.has(g)) notes.set(g, []);
      notes.get(g).push(ev);
      syl.push({ g, dur: n.dur, t: (l.syls[ni]?.t || '') + (l.syls[ni]?.end ? ' ' : '') });
      t += n.dur;
    });
    lines.push({ bi, li, b0, bars: l.bars, syl, text: l.text, label: b.label, type: b.type, dyn: b.dyn || 'normal', first: li === 0 });
  }));
  if (song.intro && bars.length) bars.push({ chord: 1, li: -2, end: true });
  return { bars, notes, lines, steps: bars.length * 16 };
}
export const s16 = (bpm) => 60 / bpm / 4;

// ---------- Utilitaires audio ----------
function impulse(ctx, sec, decay = 3) {
  const len = Math.floor(ctx.sampleRate * sec);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}
function noiseBuf(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
const FORMANTS = {
  a: [[800, 1, 6], [1200, 0.5, 8], [2500, 0.25, 10]],
  e: [[450, 1, 6], [1900, 0.45, 9], [2600, 0.25, 10]],
  i: [[300, 1, 6], [2300, 0.4, 10], [3000, 0.25, 10]],
  o: [[480, 1, 6], [850, 0.6, 8], [2800, 0.2, 10]],
  u: [[330, 1, 6], [750, 0.4, 8], [2500, 0.15, 10]],
};
export const ECHO_TIMES = { '1/16': 0.25, '1/8': 0.5, '1/8.': 0.75, '1/4': 1, '1/2': 2, slap: 0 };
export const VOICE_FX = {
  naturel: { n: 'Naturel', lowcut: 80, lp: 18000, bright: 0, comp: false, echo: 0, reverb: 0.1, double: 0 },
  studio: { n: 'Studio', lowcut: 100, lp: 16000, bright: 3, comp: true, echo: 0.12, echoTime: '1/8.', fb: 0.25, reverb: 0.22, double: 0 },
  radio: { n: 'Radio', lowcut: 500, lp: 3200, bright: 0, comp: true, echo: 0, reverb: 0.05, double: 0 },
  stade: { n: 'Grand écho', lowcut: 120, lp: 14000, bright: 2, comp: true, echo: 0.35, echoTime: '1/4', fb: 0.45, reverb: 0.45, double: 0 },
  double: { n: 'Doublage', lowcut: 100, lp: 15000, bright: 2, comp: true, echo: 0.1, echoTime: '1/8', fb: 0.2, reverb: 0.2, double: 0.6 },
  rap: { n: 'Rap sec', lowcut: 120, lp: 15000, bright: 4, comp: true, echo: 0.15, echoTime: 'slap', fb: 0.1, reverb: 0.06, double: 0 },
};

// ---------- Moteur ----------
export class Engine {
  constructor(ctx) {
    this.ctx = ctx;
    const c = ctx;
    this.out = c.createGain();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -12; this.comp.ratio.value = 3.5; this.comp.attack.value = 0.005; this.comp.release.value = 0.2;
    this.analyser = c.createAnalyser(); this.analyser.fftSize = 1024;
    this.out.connect(this.comp).connect(this.analyser).connect(c.destination);
    this.rev = c.createConvolver(); this.rev.buffer = impulse(c, 2.6);
    this.revOut = c.createGain(); this.revOut.gain.value = 1;
    this.rev.connect(this.revOut).connect(this.out);
    this.noise = noiseBuf(c);
    this.bus = {};
    this.meters = {};
    ['lead', 'harm', 'chords', 'bass', 'drums', 'tracks', 'click'].forEach((k) => {
      const g = c.createGain(); g.connect(this.out); this.bus[k] = g;
      const a = c.createAnalyser(); a.fftSize = 256; g.connect(a); this.meters[k] = a;
    });
    this.meters.master = this.analyser;
    // effets de la mélodie guide
    this.leadSend = c.createGain(); this.leadSend.connect(this.rev);
    this.leadDelay = c.createDelay(4); this.leadFb = c.createGain(); this.leadWet = c.createGain();
    this.leadDelay.connect(this.leadFb).connect(this.leadDelay); this.leadDelay.connect(this.leadWet).connect(this.out);
    this.leadEchoIn = c.createGain(); this.leadEchoIn.connect(this.leadDelay);
    this.bus.lead.connect(this.leadSend); this.bus.lead.connect(this.leadEchoIn);
    this.bus.harm.connect(this.leadSend); this.bus.harm.connect(this.leadEchoIn);
    this.chSend = c.createGain(); this.bus.chords.connect(this.chSend).connect(this.rev);
    this.trackNodes = {};
    this.timer = null; this.playing = false;
  }

  applyMix(song) {
    const m = song.mix, now = this.ctx.currentTime;
    const anySolo = Object.values(m.solo || {}).some(Boolean);
    const v = (k) => (m.mute?.[k] || (anySolo && !m.solo?.[k]) ? 0 : m[k]);
    const set = (p, x) => p.setTargetAtTime(x, now, 0.02);
    set(this.bus.lead.gain, song.guide === false ? 0 : v('lead'));
    set(this.bus.harm.gain, song.guide === false ? 0 : v('harm'));
    set(this.bus.chords.gain, v('chords'));
    set(this.bus.bass.gain, v('bass'));
    set(this.bus.drums.gain, v('drums'));
    set(this.bus.tracks.gain, v('tracks'));
    set(this.bus.click.gain, song.metronome ? 0.5 : 0);
    set(this.out.gain, m.master ?? 0.9);
    set(this.leadSend.gain, m.leadReverb);
    set(this.chSend.gain, m.leadReverb * 0.5);
    set(this.leadEchoIn.gain, m.leadEcho);
    set(this.leadFb.gain, 0.38);
    set(this.leadWet.gain, 1);
    this.leadDelay.delayTime.setTargetAtTime(s16(song.bpm) * 4 * 0.75, now, 0.05);
    (song.tracks || []).forEach((t) => this.updateTrack(song, t));
  }

  // ----- instruments -----
  env(g, t, a, peak, dec, sus, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sus, t + a, dec);
    g.gain.setValueAtTime(peak * sus, Math.max(t + a + 0.01, end));
    g.gain.setTargetAtTime(0.0001, end, 0.06);
  }

  // joue un vrai échantillon ; renvoie false s'il n'est pas (encore) chargé
  sampled(name, m, t, d, bus, vel = 1, rel = 0.25) {
    const sm = name && pick(name, m); if (!sm) return false;
    const c = this.ctx, src = c.createBufferSource(); src.buffer = sm.buffer; src.playbackRate.value = sm.rate;
    const g = c.createGain(), end = t + Math.max(0.05, d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.004);
    g.gain.setValueAtTime(vel, end); g.gain.setTargetAtTime(0, end, rel / 3);
    src.connect(g).connect(bus); src.start(t); src.stop(end + rel * 2 + 0.05);
    return true;
  }

  lead(type, m, t, d, vowel, bus, amp = 0.32) {
    if (this.sampled(LEAD_SOUNDS[type], m, t, d, bus, amp * 2.3, type === 'piano' ? 0.5 : 0.18)) return;
    const c = this.ctx, f = mtof(m), end = t + d;
    const g = c.createGain();
    g.connect(bus);
    const oscs = [];
    const vib = (o, depth) => {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = 5.4; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * depth, t + Math.min(0.4, d));
      l.connect(lg).connect(o.frequency); oscs.push(l);
    };
    if (type === 'voix') {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.985, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      vib(o, 0.012);
      const sum = c.createGain(); sum.gain.value = 2.6;
      (FORMANTS[vowel] || FORMANTS.a).forEach(([fr, gg, q]) => { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fr; b.Q.value = q; const k = c.createGain(); k.gain.value = gg; o.connect(b).connect(k).connect(sum); });
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600; const dry = c.createGain(); dry.gain.value = 0.12; o.connect(lp).connect(dry).connect(sum);
      sum.connect(g); oscs.push(o);
      this.env(g, t, 0.05, amp, 0.3, 0.85, end);
    } else if (type === 'synth') {
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
      lp.frequency.setValueAtTime(800, t); lp.frequency.linearRampToValueAtTime(3200, t + 0.04); lp.frequency.setTargetAtTime(1400, t + 0.05, 0.2);
      [-7, 7].forEach((det) => { const o = c.createOscillator(); o.type = det < 0 ? 'sawtooth' : 'square'; o.frequency.value = f; o.detune.value = det; vib(o, 0.006); o.connect(lp); oscs.push(o); });
      lp.connect(g); this.env(g, t, 0.01, amp * 0.55, 0.15, 0.7, end);
    } else if (type === 'flute') {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; vib(o, 0.008);
      const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2; const g2 = c.createGain(); g2.gain.value = 0.08;
      o.connect(g); o2.connect(g2).connect(g); oscs.push(o, o2);
      const n = c.createBufferSource(); n.buffer = this.noise; const nb = c.createBiquadFilter(); nb.type = 'bandpass'; nb.frequency.value = f * 2; nb.Q.value = 3; const ng = c.createGain(); ng.gain.value = 0.05;
      n.connect(nb).connect(ng).connect(g); n.start(t); n.stop(end + 0.3);
      this.env(g, t, 0.06, amp * 1.1, 0.3, 0.9, end);
    } else { // piano
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2; const g2 = c.createGain(); g2.gain.value = 0.25;
      o.connect(g); o2.connect(g2).connect(g); oscs.push(o, o2);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(amp * 1.2, t + 0.005); g.gain.setTargetAtTime(0.0001, t + 0.01, Math.min(0.5, d * 0.6 + 0.1));
    }
    oscs.forEach((o) => { o.start(t); o.stop(end + 0.4); });
  }

  chord(type, midis, t, d, vel = 1) {
    const c = this.ctx, end = t + d, n = midis.length;
    const bus = c.createGain(); bus.gain.value = vel; bus.connect(this.bus.chords);
    const inst = chordInst(type, this.styleName);
    if (inst && pick(inst, midis[0])) {
      const gtr = inst === 'guitar' || inst === 'nylon' || inst === 'eguitar' || inst === 'drive';
      const notes = gtr ? [midis[0] - 12, ...midis] : midis; // guitare : basse de l'accord en plus
      const per = (inst === 'strings' || inst === 'choir' ? 0.42 : 0.5) / Math.sqrt(notes.length);
      notes.forEach((m, i) => this.sampled(inst, m, t + (gtr ? i * 0.014 : i * 0.003), d, bus, per * (0.92 + Math.random() * 0.12), inst === 'piano' || inst === 'epiano' ? 0.45 : 0.25));
      return;
    }
    midis.forEach((m, i) => {
      const f = mtof(m), g = c.createGain(); g.connect(bus);
      const oscs = [];
      const tt = t + (type === 'pluck' ? i * 0.012 : 0);
      if (type === 'pad' || type === 'supersaw') {
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = type === 'pad' ? 1300 : 3500; lp.connect(g);
        (type === 'pad' ? [-6, 6] : [-14, -5, 5, 14]).forEach((det) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); oscs.push(o); });
        if (type === 'pad') this.env(g, tt, 0.25, 0.2 / n * 2, 0.5, 0.8, end);
        else this.env(g, tt, 0.005, 0.18 / n * 2, 0.08, 0.5, end);
      } else if (type === 'power') {
        if (i > 1) return;
        const ws = c.createWaveShaper(); const k = 30, cv = new Float32Array(256);
        for (let x = 0; x < 256; x++) { const xx = x / 128 - 1; cv[x] = ((1 + k) * xx) / (1 + k * Math.abs(xx)); }
        ws.curve = cv;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f / 2; o.connect(ws).connect(lp).connect(g); oscs.push(o);
        this.env(g, tt, 0.005, 0.11, 0.2, 0.6, end);
      } else if (type === 'epiano') {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const mo = c.createOscillator(); mo.frequency.value = f * 2; const mg = c.createGain(); mg.gain.setValueAtTime(f * 1.2, tt); mg.gain.setTargetAtTime(f * 0.1, tt, 0.15);
        mo.connect(mg).connect(o.frequency); o.connect(g); oscs.push(o, mo);
        g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.32 / n * 2, tt + 0.008); g.gain.setTargetAtTime(0.0001, tt + 0.01, Math.min(1.2, d * 0.7));
      } else if (type === 'pluck') {
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(4000, tt); lp.frequency.setTargetAtTime(600, tt, 0.08);
        o.connect(lp).connect(g); oscs.push(o);
        g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.4 / n * 2, tt + 0.003); g.gain.setTargetAtTime(0.0001, tt + 0.005, Math.min(0.35, d * 0.5));
      } else { // piano
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 3; const g2 = c.createGain(); g2.gain.value = 0.08;
        o.connect(g); o2.connect(g2).connect(g); oscs.push(o, o2);
        g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.36 / n * 2, tt + 0.005); g.gain.setTargetAtTime(0.0001, tt + 0.01, Math.min(0.9, d * 0.6));
      }
      oscs.forEach((o) => { o.start(tt); o.stop(end + 1.5); });
    });
  }

  bass(m, t, d, style, vel = 1) {
    if (this.sampled(bassInst(style), m, t, d, this.bus.bass, 0.95 * vel, 0.12)) return;
    const c = this.ctx, f = mtof(m), g = c.createGain(); const vb = c.createGain(); vb.gain.value = vel; g.connect(vb).connect(this.bus.bass);
    const o = c.createOscillator();
    if (style === 'trap' || style === 'hiphop') {
      o.type = 'sine'; o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      const ws = c.createWaveShaper(); const cv = new Float32Array(256); for (let x = 0; x < 256; x++) { const xx = x / 128 - 1; cv[x] = Math.tanh(xx * 2.5); } ws.curve = cv;
      o.connect(ws).connect(g); this.env(g, t, 0.005, 0.55, 0.6, 0.7, t + d);
    } else {
      o.type = style === 'rock' || style === 'edm' ? 'sawtooth' : 'triangle'; o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = style === 'edm' ? 900 : 500; lp.Q.value = 2;
      const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.value = f; sub.connect(g); sub.start(t); sub.stop(t + d + 0.3);
      o.connect(lp).connect(g); this.env(g, t, 0.006, 0.42, 0.25, 0.75, t + d * 0.92);
    }
    o.start(t); o.stop(t + d + 0.3);
  }

  drum(name, t, vel = 1) {
    const c = this.ctx, bus = this.bus.drums;
    const buf = name !== 'click' && kitPiece(this.kit || 'acoustic', name);
    if (buf) {
      const src = c.createBufferSource(), g = c.createGain();
      src.buffer = buf; src.playbackRate.value = 1 + (Math.random() - 0.5) * 0.02; // légère variation humaine
      const v = Math.min(1.3, vel * (0.93 + Math.random() * 0.1)) * (name === 'hat' ? 0.55 : name === 'open' ? 0.6 : name === 'crash' ? 0.55 : 1);
      g.gain.value = v; src.connect(g).connect(bus);
      if (name === 'hat' && this.openHat) { try { this.openHat.g.gain.setTargetAtTime(0, t, 0.02); } catch (e) {} } // le charley fermé coupe l'ouvert
      if (name === 'open') this.openHat = { g };
      src.start(t + (name === 'hat' ? (Math.random() - 0.5) * 0.006 : 0));
      return;
    }
    if (name === 'crash') name = 'open';
    const nz = (fType, freq, q, a, dec) => {
      const s = c.createBufferSource(); s.buffer = this.noise;
      const fl = c.createBiquadFilter(); fl.type = fType; fl.frequency.value = freq; if (q) fl.Q.value = q;
      const g = c.createGain(); g.gain.setValueAtTime(a * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      s.connect(fl).connect(g).connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dec + 0.05);
      return g;
    };
    if (name === 'kick') {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(1.1 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g).connect(bus); o.start(t); o.stop(t + 0.5);
      nz('lowpass', 3000, 0, 0.15, 0.02);
    } else if (name === 'snare') {
      nz('highpass', 1400, 0, 0.55, 0.2);
      const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      g.gain.setValueAtTime(0.4 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(g).connect(bus); o.start(t); o.stop(t + 0.15);
    } else if (name === 'clap') {
      [0, 0.011, 0.022].forEach((dt, i) => {
        const s = c.createBufferSource(); s.buffer = this.noise; const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1300; fl.Q.value = 1.2;
        const g = c.createGain(); const tt = t + dt; g.gain.setValueAtTime(0.5 * vel, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + (i === 2 ? 0.18 : 0.012));
        s.connect(fl).connect(g).connect(bus); s.start(tt, Math.random() * 0.5); s.stop(tt + 0.2);
      });
    } else if (name === 'hat') nz('highpass', 7500, 0, 0.22, 0.045);
    else if (name === 'open') nz('highpass', 6500, 0, 0.2, 0.3);
    else if (name === 'click') {
      const o = c.createOscillator(), g = c.createGain(); o.frequency.value = vel > 1 ? 1760 : 1100;
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); o.connect(g).connect(this.bus.click); o.start(t); o.stop(t + 0.06);
    }
  }

  // ----- pistes enregistrées -----
  trackChain(song, tr) {
    const c = this.ctx;
    const n = {};
    n.in = c.createGain();
    n.hp = c.createBiquadFilter(); n.hp.type = 'highpass';
    n.lp = c.createBiquadFilter(); n.lp.type = 'lowpass';
    n.shelf = c.createBiquadFilter(); n.shelf.type = 'highshelf'; n.shelf.frequency.value = 4500;
    n.comp = c.createDynamicsCompressor(); n.comp.attack.value = 0.004; n.comp.release.value = 0.15;
    n.vol = c.createGain(); n.pan = c.createStereoPanner();
    n.in.connect(n.hp).connect(n.lp).connect(n.shelf).connect(n.comp).connect(n.vol).connect(n.pan).connect(this.bus.tracks);
    n.meter = c.createAnalyser(); n.meter.fftSize = 256; n.pan.connect(n.meter); this.meters['tr_' + tr.id] = n.meter;
    n.revSend = c.createGain(); n.pan.connect(n.revSend).connect(this.rev);
    n.delay = c.createDelay(4); n.fb = c.createGain(); n.echoSend = c.createGain();
    n.pan.connect(n.echoSend).connect(n.delay); n.delay.connect(n.fb).connect(n.delay); n.delay.connect(this.bus.tracks);
    n.dbl = c.createDelay(0.1); n.dblG = c.createGain(); n.dblPan = c.createStereoPanner();
    n.vol.connect(n.dbl).connect(n.dblG).connect(n.dblPan).connect(this.bus.tracks);
    this.trackNodes[tr.id] = n;
    this.updateTrack(song, tr);
    return n;
  }
  updateTrack(song, tr) {
    const n = this.trackNodes[tr.id]; if (!n) return;
    const now = this.ctx.currentTime, set = (p, x) => p.setTargetAtTime(x, now, 0.02);
    const anySolo = (song.tracks || []).some((t) => t.solo);
    const on = !tr.mute && (!anySolo || tr.solo);
    set(n.vol.gain, on ? tr.vol : 0);
    set(n.pan.pan, tr.pan || 0);
    set(n.hp.frequency, tr.lowcut || 80);
    set(n.lp.frequency, tr.lp || 18000);
    set(n.shelf.gain, tr.bright || 0);
    n.comp.threshold.value = tr.comp ? -22 : 0; n.comp.ratio.value = tr.comp ? 4 : 1;
    set(n.revSend.gain, on ? tr.reverb || 0 : 0);
    set(n.echoSend.gain, on ? tr.echo || 0 : 0);
    set(n.fb.gain, Math.min(0.85, tr.fb ?? 0.3));
    const et = tr.echoTime === 'slap' ? 0.09 : s16(song.bpm) * 4 * (ECHO_TIMES[tr.echoTime || '1/8.'] || 0.75);
    n.delay.delayTime.setTargetAtTime(Math.min(3.9, et), now, 0.05);
    n.dbl.delayTime.value = 0.024; set(n.dblG.gain, on ? (tr.double || 0) : 0); n.dblPan.pan.value = -(tr.pan || 0) || -0.5;
  }

  // ----- lecture -----
  scheduleStep(song, tl, g, t) {
    const bar = tl.bars[Math.floor(g / 16)];
    if (!bar) return;
    const st = g % 16;
    const sty = STYLES[song.style];
    this.kit = kitFor(song); this.styleName = song.style;
    const d16 = s16(song.bpm);
    if (st % 2 === 1) t += (song.swing || 0) * d16 * 0.6;
    if (song.metronome && st % 4 === 0) this.drum('click', t, st === 0 ? 2 : 1);
    if (bar.end) {
      if (st === 0) {
        this.drum('kick', t); this.drum('crash', t);
        this.chord(sty.chord, chordMidis(1, song.key, song.mode, sty.chord === 'epiano'), t, d16 * 16);
        this.bass(bassMidi(1, song.key, song.mode), t, d16 * 12, song.style);
      }
      return;
    }
    // nuances : tout doux = sans batterie, émouvant = batterie légère, puissant = tout + harmonie
    const dyn = song.dynamics === false ? 'normal' : bar.dyn || 'normal';
    const dv = { soft: 0.55, emo: 0.75, normal: 1, loud: 1.15 }[dyn];
    if (song.drumsOn !== false && dyn !== 'soft') DRUM_ROWS.forEach((r) => {
      if (!song.drums[r]?.[st]) return;
      if (dyn === 'emo' && (r === 'clap' || r === 'open' || (r === 'hat' && st % 4))) return;
      this.drum(r, t, (r === 'hat' && st % 4 ? 0.7 : 1) * (dyn === 'emo' ? 0.6 : dyn === 'loud' ? 1.1 : 1));
    });
    if (dyn === 'loud' && song.drumsOn !== false && st % 4 === 2) this.drum('open', t, 0.6);
    if (bar.sectionStart && st === 0 && (dyn === 'loud' || dyn === 'normal')) this.drum('crash', t, dyn === 'loud' ? 1.2 : 0.8);
    const cs = dyn === 'soft' || dyn === 'emo' ? (song.chordSound && song.chordSound !== 'power' && song.chordSound !== 'supersaw' ? song.chordSound : 'pad') : song.chordSound || sty.chord;
    const hits = dyn === 'soft' ? [[0, 16]] : sty.hits;
    hits.forEach(([s, d]) => { if (s === st) this.chord(cs, chordMidis(bar.chord, song.key, song.mode, cs === 'epiano'), t, d * d16 * 0.95, dv); });
    const bassP = dyn === 'soft' ? [[0, 16, 0]] : sty.bass;
    bassP.forEach(([s, d, iv]) => { if (s === st) this.bass(bassMidi(bar.chord, song.key, song.mode) + iv, t, d * d16 * 0.9, song.style, dv); });
    this.curDyn = dyn;
    const evs = tl.notes.get(g);
    if (evs) evs.forEach((e) => {
      const m = posToMidi(e.p, song.key, song.mode), dur = e.dur * d16 * 0.94;
      this.lead(song.leadSound, m, t, dur, e.v, this.bus.lead, 0.32 * (dyn === 'soft' ? 0.8 : 1));
      const harm = song.harmony && song.harmony !== 'off' ? song.harmony : dyn === 'loud' ? 'up3' : null;
      if (harm) {
        const off = { up3: 2, down3: -2, up6: 5, oct: 7 }[harm] || 2;
        this.lead(song.leadSound, posToMidi(e.p + off, song.key, song.mode), t, dur, e.v, this.bus.harm, 0.22);
      }
    });
  }

  startTracks(song, t0, fromSec) {
    (song.tracks || []).forEach((tr) => {
      if (!tr.buffer) return;
      const n = this.trackNodes[tr.id] || this.trackChain(song, tr);
      const src = this.ctx.createBufferSource(); src.buffer = tr.buffer; src.connect(n.in);
      const rel = tr.start - fromSec;
      if (rel >= 0) src.start(t0 + rel); else if (-rel < tr.buffer.duration) src.start(t0, -rel); else return;
      this.sources.push(src);
    });
  }

  // opts: { from (mesure), to, loop, countIn (mesures), onEnd }
  play(song, opts = {}) {
    this.stop();
    const c = this.ctx;
    this.song = song;
    this.applyMix(song);
    this.tl = buildTimeline(song);
    const from = opts.from || 0;
    this.toFixed = opts.to ?? null;
    const endBar = () => Math.min(this.toFixed ?? this.tl.bars.length, this.tl.bars.length);
    if (endBar() <= from) return null;
    const d16 = s16(song.bpm);
    if (opts.countIn) for (let b = 0; b < opts.countIn * 4; b++) { const tt = c.currentTime + 0.1 + b * 4 * d16; const o = c.createOscillator(), g = c.createGain(); o.frequency.value = b % 4 ? 1100 : 1760; g.gain.setValueAtTime(0.5, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.05); o.connect(g).connect(this.out); o.start(tt); o.stop(tt + 0.06); }
    const t0 = c.currentTime + 0.1 + (opts.countIn || 0) * 16 * d16;
    this.sources = [];
    this.pos = { t0, fromSec: from * 16 * d16, loopLen: (endBar() - from) * 16 * d16, loop: !!opts.loop, from, bpm: song.bpm };
    this.startTracks(song, t0, this.pos.fromSec);
    let g = from * 16, next = t0;
    this.playing = true;
    const tick = () => {
      while (next < c.currentTime + 0.15) {
        this.scheduleStep(this.song, this.tl, g, next);
        next += s16(this.song.bpm); g++;
        if (g >= endBar() * 16) {
          if (opts.loop) {
            g = from * 16; this.tl = buildTimeline(this.song);
            this.pos.loopLen = (endBar() - from) * 16 * s16(this.song.bpm);
            this.pos.t0 = next; this.pos.pending = true;
            this.startTracks(this.song, next, this.pos.fromSec);
          } else {
            clearInterval(this.timer); this.timer = null;
            const endIn = (next - c.currentTime + 0.4) * 1000;
            this.endTimer = setTimeout(() => { this.playing = false; opts.onEnd && opts.onEnd(); }, endIn);
            return;
          }
        }
      }
    };
    this.timer = setInterval(tick, 25); tick();
    return this.pos;
  }
  // relit la chanson pendant la lecture (arrangements modifiés -> audio + karaoké suivent)
  refresh(song) { if (this.playing) { this.song = song; this.tl = buildTimeline(song); this.applyMix(song); } }
  stop() {
    if (this.timer) clearInterval(this.timer); this.timer = null;
    if (this.endTimer) clearTimeout(this.endTimer);
    (this.sources || []).forEach((s) => { try { s.stop(); } catch (e) {} });
    this.sources = [];
    this.playing = false;
    if (this.recorder) this.stopRecording();
  }
  // temps de la chanson (secondes) pour le karaoké
  songTime() {
    if (!this.playing || !this.pos) return null;
    const now = this.ctx.currentTime;
    let dt = now - this.pos.t0;
    if (this.pos.pending && dt < 0) dt += this.pos.loopLen; // nouvelle boucle programmée d'avance
    if (dt < 0) return { t: this.pos.fromSec + dt, countIn: true, left: -dt };
    return { t: this.pos.fromSec + dt };
  }

  // ----- métronome seul (fredonner / chanter a cappella) : renvoie l'heure du 1er temps fort -----
  startClick(bpm, countIn = 1, audible = true) {
    this.stop();
    const c = this.ctx, beat = 60 / bpm;
    const T1 = c.currentTime + 0.15 + countIn * 4 * beat;
    let k = -countIn * 4, next = T1 + k * beat;
    const click = (t, acc) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = acc ? 1760 : 1100; g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); o.connect(g).connect(this.out); o.start(t); o.stop(t + 0.06); };
    this.clickTimer = setInterval(() => {
      while (next < c.currentTime + 0.15) { if (k < 0 || audible) click(next, M4(k)); k++; next += beat; }
    }, 25);
    const M4 = (i) => ((i % 4) + 4) % 4 === 0;
    this.clickPos = { T1, beat };
    return T1;
  }
  stopClick() { if (this.clickTimer) clearInterval(this.clickTimer); this.clickTimer = null; }

  // ----- enregistrement micro (calé à l'échantillon près) -----
  async openMic(echoCancel) {
    if (this.mic && this.micEcho === echoCancel) return this.mic;
    if (this.micStream) this.micStream.getTracks().forEach((t) => t.stop());
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: echoCancel, noiseSuppression: echoCancel, autoGainControl: false, channelCount: 1 } });
    this.micEcho = echoCancel;
    this.mic = this.ctx.createMediaStreamSource(this.micStream);
    if (!this.workletReady) {
      const code = `class R extends AudioWorkletProcessor{constructor(){super();this.on=false;this.port.onmessage=e=>{this.on=e.data}}process(i){const ch=i[0]&&i[0][0];if(this.on&&ch){this.port.postMessage({t:currentTime,d:ch.slice(0)})}return true}}registerProcessor('rec-proc',R)`;
      const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
      await this.ctx.audioWorklet.addModule(url);
      this.workletReady = true;
    }
    this.recNode = new AudioWorkletNode(this.ctx, 'rec-proc');
    this.mic.connect(this.recNode);
    const sink = this.ctx.createGain(); sink.gain.value = 0; this.recNode.connect(sink).connect(this.ctx.destination);
    this.micAnalyser = this.ctx.createAnalyser(); this.micAnalyser.fftSize = 512; this.mic.connect(this.micAnalyser);
    return this.mic;
  }
  startRecording() {
    this.recChunks = []; this.recT = null;
    this.recNode.port.onmessage = (e) => { if (this.recT === null) this.recT = e.data.t; this.recChunks.push(e.data.d); };
    this.recNode.port.postMessage(true);
    this.recorder = true;
  }
  stopRecording() {
    if (!this.recorder) return null;
    this.recorder = false;
    this.recNode.port.postMessage(false);
    const len = this.recChunks.reduce((a, b) => a + b.length, 0);
    if (!len) return null;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0); let o = 0;
    this.recChunks.forEach((ch) => { d.set(ch, o); o += ch.length; });
    const res = { buffer: buf, ctxStart: this.recT };
    this.recChunks = [];
    this.lastRec = res;
    return res;
  }
  level(k) {
    const a = this.meters[k]; if (!a) return 0;
    const d = new Uint8Array(a.fftSize); a.getByteTimeDomainData(d);
    let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i] - 128));
    return m / 128;
  }
  latency() { return (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0); }

  // flux pour export vidéo / mp4
  streamDest() {
    if (!this.dest) { this.dest = this.ctx.createMediaStreamDestination(); this.analyser.connect(this.dest); }
    return this.dest;
  }

  previewNote(song, p) {
    const t = this.ctx.currentTime + 0.02;
    this.styleName = song.style; this.kit = kitFor(song);
    this.applyMix(song);
    this.lead(song.leadSound, posToMidi(p, song.key, song.mode), t, 0.45, 'a', this.bus.lead);
  }
  previewChord(song, deg) {
    const sty = STYLES[song.style];
    this.styleName = song.style; this.kit = kitFor(song);
    this.applyMix(song);
    this.chord(song.chordSound || sty.chord, chordMidis(deg, song.key, song.mode, true), this.ctx.currentTime + 0.02, 0.9);
  }
}

// ---------- Rendu hors ligne (WAV) ----------
export async function renderOffline(song) {
  const tl = buildTimeline(song);
  const d16 = s16(song.bpm);
  const tracksEnd = Math.max(0, ...(song.tracks || []).filter((t) => t.buffer).map((t) => t.start + t.buffer.duration));
  const dur = Math.max(tl.steps * d16, tracksEnd) + 3;
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * sr), sr);
  const eng = new Engine(ctx);
  eng.applyMix(song);
  // le rendu hors ligne doit fixer les valeurs immédiatement
  const t0 = 0.05;
  eng.sources = [];
  eng.startTracks(song, t0, 0);
  for (let g = 0; g < tl.steps; g++) eng.scheduleStep(song, tl, g, t0 + g * d16);
  return ctx.startRendering();
}

export function wavBlob(buf) {
  const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
  const ab = new ArrayBuffer(44 + len * ch * 2), v = new DataView(ab);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, len * ch * 2, true);
  const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  let peak = 0; data.forEach((d) => { for (let i = 0; i < len; i += 7) peak = Math.max(peak, Math.abs(d[i])); });
  const norm = peak > 0.98 ? 0.98 / peak : 1;
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i] * norm)); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Blob([ab], { type: 'audio/wav' });
}

// AudioBuffer <-> stockage
export function bufferToStore(buf) { return { sr: buf.sampleRate, ch: [buf.getChannelData(0).slice(0)] }; }
export function storeToBuffer(ctx, s) {
  const b = ctx.createBuffer(1, s.ch[0].length, s.sr); b.getChannelData(0).set(s.ch[0]); return b;
}

export function pickMime(video) {
  const list = video
    ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
    : ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
  if (typeof MediaRecorder === 'undefined') return null;
  return list.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

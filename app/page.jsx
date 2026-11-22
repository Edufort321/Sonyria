'use client';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import * as M from '@/lib/music';
import { Engine, buildTimeline, s16, renderOffline, wavBlob, storeToBuffer, VOICE_FX, ECHO_TIMES, pickMime } from '@/lib/engine';
import { ClipRenderer, THEMES, FORMATS, PLATFORMS, defaultScenario, loadImage } from '@/lib/video';
import { separate, analyzeMusic, transcribe, buildSong } from '@/lib/analyze';
import * as DB from '@/lib/storage';
import Ic, { IconDefs, Ico } from './Ic';
import { Splash, Onboarding, AvatarGrid, loadMe, saveMe, avSrc } from './Welcome';

const DEMO = `[Couplet]
Sur la route du soir je marche sans bruit
Les lumières de la ville dansent dans la nuit
Je garde tes mots au fond de ma poche
Chaque pas me ramène un peu plus proche

[Refrain]
Et je chante pour toi
Quand la ville s'endort
Ta voix me guide encore
Jusqu'au bout de la nuit`;

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fxParams = (k) => { const { n, ...p } = VOICE_FX[k]; return { echoTime: '1/8.', fb: 0.3, ...p }; };
const LEADS = { voix: 'Voix', synth: 'Synthé', flute: 'Flûte', piano: 'Piano' };
const CHORDS = { '': 'Auto (style)', piano: 'Piano', pad: 'Nappe', epiano: 'Piano électrique', pluck: 'Guitare pincée', power: 'Guitare saturée', supersaw: 'Supersaw' };
const HARMS = { off: 'Aucune', up3: 'Tierce au-dessus', down3: 'Tierce en dessous', up6: 'Sixte', oct: 'Octave' };
const TYPES = { verse: 'Couplet', chorus: 'Refrain', bridge: 'Pont' };

function newSong(lyrics = DEMO) {
  const s = {
    id: 's' + Date.now(), title: 'Ma chanson', artist: '', lyrics, blocks: [], style: 'pop', key: 0, mode: 'maj', bpm: 104, swing: 0,
    drums: M.drumPreset('pop'), drumsOn: true, intro: true, leadSound: 'voix', chordSound: '', harmony: 'off', guide: true, metronome: false,
    variant: 0, fr: false, voicePitch: true,
    mix: { lead: 0.75, harm: 0.45, chords: 0.5, bass: 0.7, drums: 0.8, tracks: 1, master: 0.9, leadReverb: 0.25, leadEcho: 0.12, mute: {}, solo: {} },
    tracks: [], clip: { format: '9:16', scenario: null, theme: null }, latency: null, echoCancel: false, karaRec: true, countIn: true,
  };
  s.blocks = M.parseLyrics(lyrics); M.composeSong(s, 0);
  return s;
}
function applyStyle(s, style) {
  const st = M.STYLES[style];
  s.style = style; s.bpm = st.bpm; s.swing = st.swing; s.drums = M.drumPreset(st.drums); s.chordSound = '';
}
const flat = (s) => s.blocks.flatMap((b, bi) => b.lines.map((l, li) => ({ b, bi, l, li })));
const serialize = (s) => ({ ...s, tracks: s.tracks.map(({ buffer, ...t }) => t) });

function activeAt(tl, song, t) {
  if (t == null) return null;
  const g = t / s16(song.bpm);
  for (let i = 0; i < tl.lines.length; i++) {
    const L = tl.lines[i];
    for (let j = 0; j < L.syl.length; j++) { const s = L.syl[j]; if (g >= s.g && g < s.g + s.dur) return { bi: L.bi, li: L.li, ni: j, line: i }; }
  }
  return null;
}

export default function Page() {
  const S = useRef(null);
  if (!S.current) S.current = newSong();
  const song = S.current;
  const [v, bump] = useReducer((x) => x + 1, 0);
  const [tab, setTab] = useState('paroles');
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [kara, setKara] = useState(false);
  const [sel, setSel] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState('');
  const [amb, setAmb] = useState(() => M.suggestAmbiances(S.current.blocks));
  const [ambSel, setAmbSel] = useState(-1);
  const [rec, setRec] = useState(false);
  const [aiNote, setAiNote] = useState('');
  const [aiStatus, setAiStatus] = useState(null);
  const [code, setCode] = useState('');
  const [install, setInstall] = useState(null);
  const [clock, setClock] = useState(null);
  const [aiVibe, setAiVibe] = useState(false);
  const [exporting, setExporting] = useState('');
  const [micOn, setMicOn] = useState(false);
  const [polish, setPolish] = useState(null);
  const [progress, setProgress] = useState('');
  const [splash, setSplash] = useState(true);
  const [me, setMeState] = useState(null);
  const setMe = (m) => { setMeState(m); saveMe(m); };
  const [range, setRange] = useState('all');
  const videoBg = useRef(null);
  const [recFrom, setRecFrom] = useState(0);
  const eng = useRef(null);
  const recInfo = useRef(null);
  const saveT = useRef(null);
  const lyricsT = useRef(null);
  const taps = useRef([]);
  const photos = useRef([]);
  const lastBpm = useRef(song.bpm);
  const tl = useMemo(() => buildTimeline(song), [v]); // eslint-disable-line

  const say = (m) => { setToast(m); clearTimeout(say.t); say.t = setTimeout(() => setToast(''), 3500); };

  // ---------- sauvegarde ----------
  const save = () => {
    clearTimeout(saveT.current);
    saveT.current = setTimeout(async () => {
      try { await DB.saveSong({ id: song.id, title: song.title, updated: Date.now(), song: serialize(song) }); localStorage.setItem('sonyria-current', song.id); } catch (e) {}
    }, 1000);
  };
  const up = (fn) => {
    fn(song);
    const e = eng.current;
    if (e) {
      if (e.playing && song.bpm !== lastBpm.current) {
        const st = e.songTime();
        const bar = st && !st.countIn ? Math.floor(st.t / (16 * s16(lastBpm.current))) : 0;
        lastBpm.current = song.bpm;
        e.play(song, { from: bar, loop, onEnd: () => setPlaying(false) });
      } else e.refresh(song);
      e.applyMix(song);
    }
    lastBpm.current = song.bpm;
    bump(); save();
  };
  const load = (s) => {
    eng.current?.stop(); setPlaying(false);
    S.current = s; setSel(null); setAmb(M.suggestAmbiances(s.blocks)); setAmbSel(-1); lastBpm.current = s.bpm;
    if (eng.current) s.tracks.forEach((t) => { t.buffer = t.data ? storeToBuffer(eng.current.ctx, { sr: t.sr, ch: [t.data] }) : null; });
    bump();
  };

  // ---------- démarrage ----------
  useEffect(() => {
    (async () => {
      try {
        const id = localStorage.getItem('sonyria-current');
        setCode(localStorage.getItem('sonyria-code') || '');
        setMeState(loadMe());
        if (id) { const r = await DB.getSong(id); if (r?.song) { const d = newSong(); load({ ...d, ...r.song, mix: { ...d.mix, ...r.song.mix }, clip: { ...d.clip, ...r.song.clip } }); } }
      } catch (e) {}
    })();
    fetch('/api/claude').then((r) => r.json()).then(setAiStatus).catch(() => setAiStatus({ ai: false }));
    if ('serviceWorker' in navigator && location.hostname !== 'localhost') navigator.serviceWorker.register('/sw.js').catch(() => {});
    const bip = (e) => { e.preventDefault(); setInstall(e); };
    window.addEventListener('beforeinstallprompt', bip);
    return () => window.removeEventListener('beforeinstallprompt', bip);
  }, []); // eslint-disable-line

  // horloge (karaoké, grille, position)
  useEffect(() => {
    if (!playing) { setClock(null); return; }
    let raf, last = '';
    const f = () => {
      const st = eng.current?.songTime();
      if (st) {
        const d = s16(song.bpm);
        const step = st.countIn ? -1 : Math.floor(st.t / d);
        const a = activeAt(tl, song, st.countIn ? null : st.t);
        const key = step + '|' + (a ? `${a.bi}-${a.li}-${a.ni}` : '');
        if (key !== last) { last = key; setClock({ t: st.t, step, active: a, countIn: st.countIn }); }
      }
      raf = requestAnimationFrame(f);
    };
    f();
    return () => cancelAnimationFrame(raf);
  }, [playing, tl]); // eslint-disable-line

  // ---------- audio ----------
  const ensureAudio = async () => {
    if (!eng.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      eng.current = new Engine(new Ctx({ latencyHint: 'interactive' }));
    }
    const c = eng.current.ctx;
    if (c.state !== 'running') await c.resume();
    song.tracks.forEach((t) => { if (!t.buffer && t.data) t.buffer = storeToBuffer(c, { sr: t.sr, ch: [t.data] }); });
    eng.current.applyMix(song);
    return eng.current;
  };
  const play = async (opts = {}) => {
    const e = await ensureAudio();
    const r = e.play(song, { loop, ...opts, onEnd: () => { setPlaying(false); opts.onEnd && opts.onEnd(); } });
    if (r) setPlaying(true);
    return r;
  };
  const stop = () => { if (rec) return finishRec(); eng.current?.stop(); setPlaying(false); };

  // ---------- paroles ----------
  const analyze = (text) => {
    up((s) => {
      const old = {};
      s.blocks.forEach((b) => b.lines.forEach((l) => { if (l.notes) old[l.text] = l; }));
      s.lyrics = text;
      s.blocks = M.parseLyrics(text);
      M.composeSong(s, s.variant);
      s.blocks.forEach((b) => b.lines.forEach((l) => { const o = old[l.text]; if (o && o.syls.length === l.syls.length && o.custom) { l.bars = o.bars; l.chords = [...o.chords]; l.notes = o.notes.map((n) => ({ ...n })); l.custom = true; } }));
    });
    setAmb(M.suggestAmbiances(song.blocks)); setAmbSel(-1);
  };
  const onLyrics = (text) => { song.lyrics = text; bump(); clearTimeout(lyricsT.current); lyricsT.current = setTimeout(() => analyze(text), 700); };
  const chooseAmb = (a, i) => {
    setAmbSel(i);
    up((s) => { applyStyle(s, a.style); s.key = a.key; s.mode = a.mode; s.bpm = a.bpm; M.composeSong(s, s.variant); });
    play({ from: 0, to: Math.min(tl.bars.length, (song.intro ? 2 : 0) + 8), loop: false });
  };

  // ---------- IA ----------
  const ai = async (task, payload) => {
    const r = await fetch('/api/claude', { method: 'POST', headers: { 'content-type': 'application/json', 'x-access-code': code }, body: JSON.stringify({ task, payload }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Erreur du serveur IA');
    return j.data;
  };
  const aiAmbiances = async () => {
    setBusy('amb');
    try {
      const d = await ai('ambiance', { lyrics: song.lyrics });
      const opts = (d.options || []).filter((o) => M.STYLES[o.style]).map((o) => ({ style: o.style, mode: o.mode === 'min' ? 'min' : 'maj', key: M.mod(Math.round(+o.key || 0), 12), bpm: clamp(Math.round(+o.bpm || 100), 60, 180), why: o.why || '', ai: true }));
      if (opts.length) { setAmb(opts); setAmbSel(-1); }
    } catch (e) { say(e.message); }
    setBusy('');
  };
  const aiPolish = async () => {
    setBusy('polish');
    try {
      const d = await ai('polish', { lyrics: song.lyrics });
      if (!d.lyrics || d.lyrics.length < 10) throw new Error('Réponse vide');
      setPolish({ lyrics: String(d.lyrics).replace(/\\n/g, '\n'), changes: (d.changes || []).slice(0, 12), note: d.note || '' });
    } catch (e) { say(e.message); }
    setBusy('');
  };
  const aiCompose = async () => {
    setBusy('compose');
    try {
      const F = flat(song);
      const d = await ai('compose', {
        keyName: M.NOTE_FR[song.key], mode: song.mode, style: M.STYLES[song.style].n, bpm: song.bpm, chooseVibe: aiVibe,
        lines: F.map(({ b, l }, i) => ({ i, section: b.label, bars: l.bars, syllables: l.syls.map((s) => s.t) })),
      });
      let n = 0;
      up((s) => {
        if (aiVibe) {
          if (d.style && M.STYLES[d.style]) applyStyle(s, d.style);
          if (Number.isFinite(+d.key)) s.key = M.mod(Math.round(+d.key), 12);
          if (d.mode === 'maj' || d.mode === 'min') s.mode = d.mode;
          if (d.bpm) s.bpm = clamp(Math.round(+d.bpm), 60, 180);
        }
        const F2 = flat(s);
        (d.lines || []).forEach((x) => {
          const f = F2[x.i]; if (!f) return;
          const l = f.l;
          if (!Array.isArray(x.notes) || x.notes.length !== l.syls.length) return;
          const notes = x.notes.map((q) => ({ p: clamp(Math.round(+q.p || 0), -3, 10), dur: clamp(Math.round(+q.d || 2), 1, 16), rest: clamp(Math.round(+q.r || 0), 0, 16) }));
          const total = notes.reduce((a, q) => a + q.rest + q.dur, 0);
          const bars = clamp(Math.ceil(total / 16), l.bars, 8);
          let ch = (x.chords || []).map((c) => clamp(Math.round(+c || 1), 1, 7));
          if (!ch.length) ch = l.chords;
          l.bars = bars; l.notes = notes; l.chords = Array.from({ length: bars }, (_, i) => ch[i % ch.length]); l.custom = true;
          n++;
        });
      });
      setAiNote(d.note || ''); say(`Claude a composé ${n} ligne${n > 1 ? 's' : ''}`);
      setTab('melodie');
    } catch (e) { say(e.message); }
    setBusy('');
  };

  // ---------- édition mélodie ----------
  const selNote = sel && song.blocks[sel.bi]?.lines[sel.li]?.notes?.[sel.ni];
  const editNote = (fn) => {
    if (!sel) return;
    up((s) => {
      const l = s.blocks[sel.bi].lines[sel.li];
      fn(l, l.notes[sel.ni]);
      let total = l.notes.reduce((a, n) => a + n.rest + n.dur, 0);
      while (total > l.bars * 16) { l.bars++; l.chords.push(l.chords[l.chords.length - 1]); }
      l.custom = true;
    });
  };
  const preview = async (p) => { const e = await ensureAudio(); e.previewNote(song, p); };

  // ---------- enregistrement ----------
  const openMic = async () => {
    const e = await ensureAudio();
    try { await e.openMic(song.echoCancel); setMicOn(true); return e; } catch (err) { say('Micro refusé : autorise le micro pour Sonyria dans le navigateur.'); return null; }
  };
  const startRec = async () => {
    const e = await openMic(); if (!e) return;
    const pos = e.play(song, { from: recFrom, countIn: song.countIn ? 1 : 0, loop: false, onEnd: () => finishRec() });
    if (!pos) return;
    e.startRecording();
    recInfo.current = { t0: pos.t0, fromSec: pos.fromSec };
    setRec(true); setPlaying(true);
    if (song.karaRec) setKara(true);
  };
  const finishRec = () => {
    const e = eng.current; if (!e) return;
    const r = e.stopRecording(); e.stop(); setRec(false); setPlaying(false);
    if (!r) return;
    const lat = song.latency ?? Math.round(e.latency() * 1000);
    let st = recInfo.current.fromSec + (r.ctxStart - recInfo.current.t0) - lat / 1000;
    let buffer = r.buffer;
    if (st < 0) {
      const cut = Math.floor(-st * buffer.sampleRate);
      if (cut >= buffer.length - 100) return;
      const nb = e.ctx.createBuffer(1, buffer.length - cut, buffer.sampleRate);
      nb.getChannelData(0).set(buffer.getChannelData(0).subarray(cut)); buffer = nb; st = 0;
    }
    up((s) => s.tracks.push({ id: 't' + Date.now(), name: `Voix ${s.tracks.length + 1}`, start: st, buffer, data: buffer.getChannelData(0), sr: buffer.sampleRate, vol: 0.9, pan: 0, fx: 'studio', ...fxParams('studio'), mute: false, solo: false }));
    say('Prise enregistrée');
  };
  const setVideoBg = (file) => {
    if (videoBg.current) URL.revokeObjectURL(videoBg.current.src);
    const vd = document.createElement('video'); vd.src = URL.createObjectURL(file); vd.muted = true; vd.playsInline = true; vd.loop = true; vd.preload = 'auto';
    vd.load(); videoBg.current = vd; bump();
  };
  const mkTrack = (s, name, data, sr, start, mute, fx = 'naturel') => s.tracks.push({ id: 't' + Date.now() + Math.random().toString(36).slice(2, 6), name, start, buffer: null, data, sr, vol: 0.9, pan: 0, fx, ...fxParams(fx), mute, solo: false });
  // Importe un MP4/audio et recrée la chanson : paroles, tempo, tonalité, accords, mélodie, karaoké
  const recreate = async (file) => {
    const e = await ensureAudio();
    setBusy('import');
    try {
      setProgress('Lecture du fichier…');
      const buf = await e.ctx.decodeAudioData(await file.arrayBuffer());
      if (file.type.startsWith('video/')) setVideoBg(file);
      setProgress('Séparation voix / instrumental…'); await new Promise((r) => setTimeout(r, 30));
      const sep = separate(buf);
      setProgress('Tempo, tonalité et accords…'); await new Promise((r) => setTimeout(r, 30));
      const A = analyzeMusic(sep.mono, sep.sr);
      const segs = await transcribe(sep.voice, sep.sr, setProgress);
      setProgress('Reconstruction de la mélodie et du karaoké…'); await new Promise((r) => setTimeout(r, 30));
      const fresh = newSong('');
      fresh.title = file.name.replace(/\.[^.]+$/, '').slice(0, 40);
      buildSong(fresh, A, segs, sep.voice, sep.sr);
      fresh.style = A.bpm < 86 ? 'ballade' : A.bpm > 125 ? 'edm' : 'pop';
      fresh.drums = M.drumPreset(M.STYLES[fresh.style].drums); fresh.swing = 0;
      mkTrack(fresh, 'Original', sep.mono, sep.sr, -A.phase, false);
      if (sep.inst) mkTrack(fresh, 'Instrumental (voix retirée)', sep.inst, sep.sr, -A.phase, true);
      if (sep.stereo) mkTrack(fresh, 'Voix (approx.)', sep.voice, sep.sr, -A.phase, true, 'studio');
      fresh.mix.mute = { lead: false, harm: false, chords: true, bass: true, drums: true };
      load(fresh);
      setTab('melodie');
      say(`Chanson recréée : ${A.bpm} BPM, ${M.NOTE_FR[A.key]} ${A.mode === 'maj' ? 'majeur' : 'mineur'}, ${segs.length} phrases. Vérifie les paroles !`);
    } catch (err) { say('Import impossible : ' + (err.message || err)); }
    setProgress(''); setBusy('');
  };
  const detectTempo = (t) => { const b = M.detectBpm(t.data, t.sr); if (b) { up((s) => (s.bpm = b)); say(`Tempo détecté : ${b} BPM`); } else say('Tempo introuvable'); };
  const importAudio = async (file) => {
    if (file.type.startsWith('video/')) setVideoBg(file);
    const e = await ensureAudio();
    try {
      const ab = await file.arrayBuffer();
      const b = await e.ctx.decodeAudioData(ab);
      const mono = e.ctx.createBuffer(1, b.length, b.sampleRate);
      const d = mono.getChannelData(0);
      for (let c = 0; c < b.numberOfChannels; c++) { const x = b.getChannelData(c); for (let i = 0; i < x.length; i++) d[i] += x[i] / b.numberOfChannels; }
      up((s) => s.tracks.push({ id: 't' + Date.now(), name: file.name.replace(/\.[^.]+$/, '').slice(0, 24), start: 0, buffer: mono, data: d, sr: mono.sampleRate, vol: 0.9, pan: 0, fx: 'naturel', ...fxParams('naturel'), mute: false, solo: false }));
    } catch (err) { say('Fichier audio illisible'); }
  };
  const tr = (id, fn) => up((s) => { const t = s.tracks.find((x) => x.id === id); if (t) fn(t); });

  // Cale le karaoké (et la mélodie) sur le rythme d'une voix enregistrée
  const alignVoice = (track) => {
    const data = track.data, sr = track.sr;
    if (!data) return;
    const d16 = s16(song.bpm);
    const T = buildTimeline(song);
    const tStart = track.start, tEnd = track.start + data.length / sr;
    const scope = T.lines.filter((l) => { const a = l.syl[0] ? l.syl[0].g * d16 : null; return a !== null && a >= tStart - 1.5 && a < tEnd; });
    if (!scope.length) return say('Aucune ligne des paroles ne tombe pendant cette prise.');
    const need = scope.reduce((a, l) => a + l.syl.length, 0);
    let on = M.detectOnsets(data, sr).onsets.map((o) => ({ t: o.t + tStart, s: o.s }));
    if (on.length < Math.min(3, need)) return say('Voix trop faible : rapproche-toi du micro et réessaie.');
    while (on.length > need) { let wi = 0; on.forEach((o, i) => { if (o.s < on[wi].s) wi = i; }); on.splice(wi, 1); }
    while (on.length < need) {
      if (on.length < 2) { on.push({ t: (on[0]?.t ?? tStart) + 0.3, s: 0 }); continue; }
      let gi = 0, gm = -1; for (let i = 0; i < on.length - 1; i++) { const gp = on[i + 1].t - on[i].t; if (gp > gm) { gm = gp; gi = i; } }
      on.splice(gi + 1, 0, { t: (on[gi].t + on[gi + 1].t) / 2, s: 0 });
    }
    const pitches = on.map((o, i) => M.detectPitch(data, sr, o.t - tStart + 0.03, Math.min(on[i + 1]?.t ?? o.t + 0.5, o.t + 0.6) - tStart));
    const valid = pitches.filter(Boolean).sort((a, b) => a - b);
    const med = valid[Math.floor(valid.length / 2)];
    const shift = med ? Math.round((M.tonicMidi(song.key) + 5 - med) / 12) * 12 : 0;
    let k = 0;
    up((s) => {
      let B = scope[0].b0;
      scope.forEach((L, si) => {
        const line = s.blocks[L.bi].lines[L.li];
        const n = L.syl.length;
        const steps = on.slice(k, k + n).map((o) => Math.round(o.t / d16));
        const ps = pitches.slice(k, k + n);
        const nextFirst = si < scope.length - 1 ? Math.round(on[k + n].t / d16) : null;
        k += n;
        const base = B * 16;
        const local = steps.map((g) => Math.max(0, g - base));
        for (let j = 1; j < local.length; j++) if (local[j] <= local[j - 1]) local[j] = local[j - 1] + 1;
        const lastL = local[local.length - 1];
        let bars;
        if (nextFirst !== null) { let nb = Math.floor(nextFirst / 16); const minB = B + Math.floor(lastL / 16) + 1; if (nb < minB) nb = minB; bars = nb - B; }
        else bars = Math.ceil((lastL + 4) / 16);
        bars = clamp(bars, 1, 8);
        const L16 = bars * 16;
        const endStep = nextFirst !== null ? nextFirst - base : lastL + 4;
        const notes = []; let prevEnd = 0;
        local.forEach((st, j) => {
          const st2 = Math.min(st, L16 - 1);
          const nx = j < local.length - 1 ? local[j + 1] : Math.min(L16, Math.max(endStep, st2 + 1));
          let dur = clamp(nx - st2, 1, 8); if (st2 + dur > L16) dur = Math.max(1, L16 - st2);
          const p = s.voicePitch && ps[j] ? M.midiToPos(ps[j] + shift, s.key, s.mode) : line.notes?.[j]?.p ?? 2;
          notes.push({ p, rest: Math.max(0, st2 - prevEnd), dur });
          prevEnd = Math.max(prevEnd, st2) + dur;
        });
        const ch = line.chords || [1];
        line.chords = Array.from({ length: bars }, (_, i) => ch[i % ch.length]);
        line.bars = bars; line.notes = notes; line.custom = true;
        B += bars;
      });
    });
    say(`Karaoké calé sur ta voix : ${need} syllabes sur ${scope.length} ligne${scope.length > 1 ? 's' : ''}`);
  };

  // ---------- export ----------
  const slug = () => (song.title || 'sonyria').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sonyria';
  const saveBlob = (blob, name) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  };
  const exportWav = async () => {
    setExporting('wav');
    try { await ensureAudio(); const buf = await renderOffline(song); saveBlob(wavBlob(buf), slug() + '.wav'); say('WAV exporté'); } catch (e) { say('Export impossible : ' + e.message); }
    setExporting('');
  };
  const exportLive = async (video) => {
    const e = await ensureAudio();
    const mime = pickMime(video);
    if (mime === null) return say('Ton navigateur ne permet pas l’export vidéo. Essaie Chrome.');
    let stream;
    const as = e.streamDest().stream;
    if (video) {
      const cv = clipRef.current; const [W, H] = FORMATS[song.clip.format]; cv.width = W; cv.height = H;
      stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...as.getAudioTracks()]);
    } else stream = new MediaStream(as.getAudioTracks());
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 192_000 } : {});
    const chunks = [];
    mr.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    mr.onstop = () => {
      const type = mr.mimeType || mime || 'video/webm';
      const ext = type.includes('mp4') ? (video ? 'mp4' : 'm4a') : 'webm';
      saveBlob(new Blob(chunks, { type }), `${slug()}${video ? '-clip' : ''}.${ext}`);
      setExporting(''); say(ext === 'webm' ? 'Exporté en WebM (ton navigateur ne gère pas le MP4)' : `Exporté en ${ext.toUpperCase()}`);
    };
    setExporting(video ? 'clip' : 'mp4');
    mr.start(500);
    const T = buildTimeline(song), barSec = 16 * s16(song.bpm);
    const ch = T.lines.filter((l) => l.type === 'chorus');
    let from = 0, to = T.bars.length;
    if (range !== 'all' && ch.length) {
      from = Math.max(0, ch[0].b0 - 1);
      if (range === 'chorus') { const bi = ch[0].bi; const last = T.lines.filter((l) => l.bi === bi).pop(); to = last.b0 + last.bars + 1; }
      else to = Math.min(T.bars.length, from + Math.ceil(+range / barSec));
    } else if (range !== 'all') to = Math.min(T.bars.length, Math.ceil(+range / barSec));
    e.play(song, { from, to, loop: false, onEnd: () => { setPlaying(false); setTimeout(() => mr.state !== 'inactive' && mr.stop(), 300); } });
    setPlaying(true);
    exportStop.current = () => { e.stop(); setPlaying(false); mr.state !== 'inactive' && mr.stop(); };
  };
  const exportStop = useRef(null);

  // ---------- clip ----------
  const clipRef = useRef(null);
  const renderer = useRef(null);
  const scenario = song.clip.scenario || { ...defaultScenario(song), ...(song.clip.theme ? { theme: song.clip.theme } : {}) };
  useEffect(() => {
    if (tab !== 'clip' && !exporting) return;
    const cv = clipRef.current; if (!cv) return;
    const [W, H] = FORMATS[song.clip.format];
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    if (!renderer.current || renderer.current.cv !== cv) renderer.current = new ClipRenderer(cv);
    renderer.current.setup(scenario, photos.current, videoBg.current);
    let raf; const freq = new Uint8Array(512);
    const f = () => {
      const e = eng.current; const st = e?.songTime();
      if (e) e.analyser.getByteFrequencyData(freq);
      const vd = videoBg.current; if (vd) { if (e?.playing && vd.paused) vd.play().catch(() => {}); if (!e?.playing && !vd.paused) vd.pause(); }
      renderer.current.draw(st && !st.countIn ? st.t : (tl.lines[0]?.syl[0]?.g || 0) * s16(song.bpm) + 0.8, tl, song, e?.playing ? freq : null);
      raf = requestAnimationFrame(f);
    };
    f();
    return () => cancelAnimationFrame(raf);
  }, [tab, exporting, v]); // eslint-disable-line
  const aiClip = async () => {
    setBusy('clip');
    try {
      const d = await ai('clip', { title: song.title, artist: song.artist, style: M.STYLES[song.style].n, bpm: song.bpm, sections: [...new Set(song.blocks.map((b) => b.label))], lyrics: song.lyrics });
      const okPal = (p) => Array.isArray(p) && p.length === 3 && p.every((c) => /^#[0-9a-f]{6}$/i.test(c));
      const sc = { title: d.title || song.title, theme: THEMES[d.theme] ? d.theme : 'neon', palette: okPal(d.palette) ? d.palette : null, textStyle: d.textStyle === 'bounce' ? 'bounce' : 'karaoke', keywords: (d.keywords || []).slice(0, 6).map(String), sections: {} };
      Object.entries(d.sections || {}).forEach(([k, x]) => { sc.sections[k] = { theme: THEMES[x.theme] ? x.theme : undefined, palette: okPal(x.palette) ? x.palette : undefined, intensity: clamp(+x.intensity || 0.7, 0.2, 1), keywords: (x.keywords || []).slice(0, 4).map(String) }; });
      up((s) => { s.clip.scenario = sc; });
      setAiNote(d.note || ''); say('Scénario du clip prêt');
    } catch (e) { say(e.message); }
    setBusy('');
  };

  // ---------- divers ----------
  const tapTempo = () => {
    const n = performance.now(); taps.current = [...taps.current.filter((t) => n - t < 3000), n];
    if (taps.current.length >= 3) { const iv = []; for (let i = 1; i < taps.current.length; i++) iv.push(taps.current[i] - taps.current[i - 1]); const bpm = Math.round(60000 / (iv.reduce((a, b) => a + b, 0) / iv.length)); up((s) => (s.bpm = clamp(bpm, 50, 200))); }
  };
  const copySheet = async () => {
    const txt = song.blocks.map((b) => `[${b.label}]\n` + b.lines.map((l) => `| ${l.chords.map((c) => M.chordName(c, song.key, song.mode, song.fr)).join(' | ')} |  ${l.text}`).join('\n')).join('\n\n');
    try { await navigator.clipboard.writeText(`${song.title} — ${M.STYLES[song.style].n}, ${M.NOTE_FR[song.key]} ${song.mode === 'maj' ? 'majeur' : 'mineur'}, ${song.bpm} BPM\n\n${txt}`); say('Grille d’accords copiée'); } catch (e) { say('Copie impossible'); }
  };
  const keyLabel = `${(song.fr ? M.NOTE_FR : M.NOTE_EN)[song.key]} ${song.mode === 'maj' ? 'maj' : 'min'}`;
  const nm = (m) => M.midiName(m, song.fr);
  const posLabel = clock && !clock.countIn ? `M${Math.floor(clock.step / 16) + 1}.${Math.floor((clock.step % 16) / 4) + 1}` : '—';

  const TABS = [['paroles', 'new', 'Paroles'], ['melodie', 'note', 'Mélodie'], ['beat', 'drumkit', 'Beat'], ['studio', 'studio-mic', 'Studio'], ['table', 'sliders', 'Table'], ['clip', 'spectrum', 'Clip']];

  return (
    <div className="app">
      <IconDefs />
      {splash && <Splash onDone={() => setSplash(false)} />}
      {!splash && me && !me.onboarded && <Onboarding me={me} setMe={setMe} install={install} onInstall={async () => { install.prompt(); await install.userChoice; setInstall(null); }}
        onFinish={(choice) => {
          setMe({ ...me, onboarded: true });
          if (choice === 'paroles') { const n = newSong(''); n.artist = me.artist || me.name || ''; load(n); setTab('paroles'); }
          else if (choice === 'import') { const n = newSong(''); n.artist = me.artist || me.name || ''; load(n); setTab('studio'); }
          else { up((s) => { if (!s.artist) s.artist = me.artist || me.name || ''; }); setTab('melodie'); }
        }} />}
      <header className="hdr">
        <img src="/logo.png" alt="Sonyria" />
        <div className="brand">Sonyria<small>{me?.name ? `Salut, ${me.name}` : 'Studio de chansons'}</small></div>
        <div className="sp" />
        {install && <button className="install" onClick={async () => { install.prompt(); await install.userChoice; setInstall(null); }}>Installer</button>}
        {me?.av && <button className="avatar-btn" onClick={() => setSheet({ type: 'profile' })} title="Mon profil"><img src={avSrc(me.av)} alt="" /></button>}
        <button className="icon-btn" onClick={() => setSheet({ type: 'songs' })} title="Mes chansons"><Ico n="folder" s={30} /></button>
        <button className="icon-btn" onClick={() => setSheet({ type: 'settings' })} title="Réglages"><Ico n="settings" s={30} /></button>
      </header>

      <nav className="tabs">
        {TABS.map(([k, e, n]) => <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}><span><Ico n={e} s={30} dim={tab !== k} /></span>{n}</button>)}
      </nav>

      {/* ================= PAROLES ================= */}
      {tab === 'paroles' && <>
        <div className="card">
          <div className="row nw">
            <input type="text" value={song.title} onChange={(e) => up((s) => (s.title = e.target.value))} placeholder="Titre de la chanson" />
            <input type="text" value={song.artist} onChange={(e) => up((s) => (s.artist = e.target.value))} placeholder="Artiste" style={{ maxWidth: 160 }} />
          </div>
          <label className="f">Tes paroles</label>
          <textarea value={song.lyrics} onChange={(e) => onLyrics(e.target.value)} placeholder="Colle ton texte ici…" />
          <div className="hint">Astuce : écris <b>[Refrain]</b>, <b>[Couplet]</b> ou <b>[Pont]</b> au-dessus d’un bloc. Laisse une ligne vide entre les blocs. Ajoute une nuance dans l’en-tête : <b>[Pont (tout doucement)]</b>, <b>[Refrain (plus puissant)]</b>, <b>(très émouvant)</b>. Pour forcer un découpage de syllabe : <b>chan/tent</b>.</div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm ai" disabled={!!busy || aiStatus?.ai === false} onClick={aiPolish}>{busy === 'polish' ? <><span className="busy" /> Correction…</> : <><Ic n="wand" /> Corriger et adapter avec Claude</>}</button>
            {song.lyricsOriginal && <button className="btn sm" onClick={() => { const o = song.lyricsOriginal; up((s) => (s.lyricsOriginal = null)); analyze(o); }}><Ic n="undo" /> Revenir à mon original</button>}
          </div>
          {polish && <div className="card" style={{ borderColor: 'var(--orange)' }}>
            <h3><Ico n="ai" s={28} /> Version corrigée</h3>
            {polish.note && <div className="hint">{polish.note}</div>}
            {polish.changes.length > 0 && <div style={{ margin: '8px 0' }}>{polish.changes.map((c, i) => <div key={i} className="hint" style={{ marginBottom: 6 }}><s>{c.avant}</s><br /><b style={{ color: 'var(--txt)' }}>→ {c.apres}</b> <i>({c.pourquoi})</i></div>)}</div>}
            <textarea value={polish.lyrics} onChange={(e) => setPolish({ ...polish, lyrics: e.target.value })} style={{ minHeight: 180 }} />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn pri" onClick={() => { const orig = song.lyricsOriginal || song.lyrics; up((s) => (s.lyricsOriginal = orig)); analyze(polish.lyrics); setPolish(null); say('Nouvelle version appliquée — ton original est gardé'); }}><Ic n="check" /> Utiliser cette version</button>
              <button className="btn" onClick={() => setPolish(null)}>Garder la mienne</button>
            </div>
          </div>}
          <div className="hint" style={{ marginTop: 6 }}>{flat(song).length} lignes · {flat(song).reduce((a, x) => a + x.l.syls.length, 0)} syllabes · {song.blocks.length} sections</div>
        </div>

        <div className="card">
          <h3><Ico n="headphones-wave" s={28} /> Ambiances proposées<span className="sp" />
            <button className="btn sm ai" disabled={!!busy} onClick={aiAmbiances}>{busy === 'amb' ? <span className="busy" /> : <Ic n="sparkles" />} Demander à Claude</button>
          </h3>
          <div className="amb">
            {amb.map((a, i) => (
              <button key={i} className={'amb-c' + (ambSel === i ? ' on' : '')} onClick={() => chooseAmb(a, i)}>
                <div className="t"><Ico n={M.STYLES[a.style].e} s={26} /> {M.STYLES[a.style].n}</div>
                <div className="m">{a.bpm} BPM · {M.NOTE_FR[a.key]} {a.mode === 'maj' ? 'majeur' : 'mineur'}</div>
                <div className="w">{a.why}</div>
              </button>
            ))}
          </div>
          <div className="hint" style={{ marginTop: 8 }}>Touche une ambiance : tout est réarrangé et tu entends un extrait.</div>
        </div>

        <div className="card">
          <h3><Ico n="note-purple" s={28} /> Style</h3>
          <div className="styles">
            {Object.entries(M.STYLES).map(([k, s]) => (
              <button key={k} className={'style-c' + (song.style === k ? ' on' : '')} onClick={() => up((x) => { applyStyle(x, k); M.composeSong(x, x.variant); })}><b><Ico n={s.e} s={40} /></b>{s.n}</button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <div className="grow"><label className="f">Tonalité</label>
              <select value={song.key} onChange={(e) => up((s) => (s.key = +e.target.value))}>{M.NOTE_FR.map((n, i) => <option key={i} value={i}>{n} / {M.NOTE_EN[i]}</option>)}</select></div>
            <div className="grow"><label className="f">Mode</label>
              <div className="chips">{[['maj', 'Majeur', 'sun'], ['min', 'Mineur', 'moon']].map(([k, n, ic]) => <button key={k} className={'chip' + (song.mode === k ? ' on' : '')} onClick={() => up((s) => { s.mode = k; M.composeSong(s, s.variant); })}><Ic n={ic} size={14} /> {n}</button>)}</div></div>
          </div>
          <label className="f">Tempo : {song.bpm} BPM</label>
          <div className="row nw"><input type="range" min="55" max="190" value={song.bpm} onChange={(e) => up((s) => (s.bpm = +e.target.value))} /><button className="btn sm" onClick={tapTempo}><Ic n="tap" /> Tap</button></div>
          <div className="chips" style={{ marginTop: 6 }}>{[[0.8, 'Plus lent'], [1, 'Original'], [1.15, 'Plus rapide']].map(([f, n]) => <button key={n} className="chip" onClick={() => up((s) => (s.bpm = clamp(Math.round(M.STYLES[s.style].bpm * f), 55, 190)))}>{n}</button>)}</div>
        </div>

        <div className="card">
          <button className="btn pri wide" onClick={() => { setTab('melodie'); play({ from: 0 }); }}><Ic n="play" /> Écouter l’arrangement</button>
          <div style={{ height: 8 }} />
          <button className="btn ai wide" disabled={!!busy || aiStatus?.ai === false} onClick={aiCompose}>{busy === 'compose' ? <><span className="busy" /> Claude compose…</> : <><Ic n="sparkles" /> Composer la mélodie avec Claude</>}</button>
          <label className="row" style={{ marginTop: 8, fontSize: 13 }}><input type="checkbox" checked={aiVibe} onChange={(e) => setAiVibe(e.target.checked)} /> Laisser Claude choisir aussi le style, la tonalité et le tempo</label>
          {aiStatus?.ai === false && <div className="hint">IA non configurée : ajoute ANTHROPIC_API_KEY dans Vercel.</div>}
        </div>
      </>}

      {/* ================= MÉLODIE ================= */}
      {tab === 'melodie' && <>
        <div className="card">
          <h3><Ico n="treble" s={28} /> Propositions de mélodie<span className="sp" /><button className="btn sm" onClick={copySheet}><Ic n="copy" /> Grille</button></h3>
          <div className="chips">
            {[0, 1, 2, 3].map((n) => <button key={n} className={'chip' + (song.variant === n ? ' on' : '')} onClick={() => { up((s) => { s.variant = n; M.composeSong(s, n); }); play({ from: 0 }); }}>Proposition {'ABCD'[n]}</button>)}
            <button className="chip" onClick={() => { const n = 4 + Math.floor(Math.random() * 1000); up((s) => { s.variant = n; M.composeSong(s, n); }); play({ from: 0 }); }}><Ic n="dice" /> Autre</button>
          </div>
          {aiNote && <div className="hint" style={{ marginTop: 8 }}><Ic n="sparkles" size={13} /> {aiNote}</div>}
          <div className="row" style={{ marginTop: 10 }}>
            <div className="grow"><label className="f">Voix guide</label><select value={song.leadSound} onChange={(e) => up((s) => (s.leadSound = e.target.value))}>{Object.entries(LEADS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
            <div className="grow"><label className="f">Accords</label><select value={song.chordSound || ''} onChange={(e) => up((s) => (s.chordSound = e.target.value))}>{Object.entries(CHORDS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
            <div className="grow"><label className="f">Harmonie vocale</label><select value={song.harmony} onChange={(e) => up((s) => (s.harmony = e.target.value))}>{Object.entries(HARMS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
          </div>
          <div className="chips" style={{ marginTop: 8 }}>
            <button className={'chip' + (!song.fr ? ' on' : '')} onClick={() => up((s) => (s.fr = false))}>C D E</button>
            <button className={'chip' + (song.fr ? ' on' : '')} onClick={() => up((s) => (s.fr = true))}>Do Ré Mi</button>
          </div>
        </div>

        {song.blocks.map((b, bi) => (
          <div key={bi}>
            <div className="sec-h">
              <button className={'sec-tag ' + b.type} onClick={() => up((s) => { const o = ['verse', 'chorus', 'bridge']; s.blocks[bi].type = o[(o.indexOf(b.type) + 1) % 3]; M.composeSong(s, s.variant); })}>{b.label.toLowerCase().startsWith(TYPES[b.type].toLowerCase()) ? b.label : `${b.label} · ${TYPES[b.type]}`}</button>
              <button className="chip" style={{ padding: '4px 9px', fontSize: 11 }} onClick={() => up((s) => { const o = ['soft', 'emo', 'normal', 'loud']; s.blocks[bi].dyn = o[(o.indexOf(b.dyn || 'normal') + 1) % 4]; })}><Ic size={12} n={{ soft: 'feather', emo: 'drop', normal: 'music', loud: 'flame' }[b.dyn || 'normal']} /> {M.DYN_LABEL[b.dyn || 'normal']}</button>
              <span className="sp" style={{ flex: 1 }} />
              <button className="mini" onClick={() => { const L = tl.lines.filter((l) => l.bi === bi); if (L.length) play({ from: L[0].b0, to: L[L.length - 1].b0 + L[L.length - 1].bars }); }}><Ic n="play" size={15} fill="currentColor" /></button>
            </div>
            {b.lines.map((l, li) => {
              const L = tl.lines.find((x) => x.bi === bi && x.li === li);
              const live = clock?.active && clock.active.bi === bi && clock.active.li === li;
              return (
                <div key={li} className={'line' + (live ? ' live' : '')}>
                  <div className="line-act">
                    <span className="txt">{l.text}</span>
                    {l.custom && <span className="badge">perso</span>}
                    <button className="mini" onClick={() => L && play({ from: L.b0, to: L.b0 + L.bars })}><Ic n="play" size={15} fill="currentColor" /></button>
                    <button className="mini" onClick={() => up((s) => { M.regenLine(s, bi, li, Math.floor(Math.random() * 1e6)); s.blocks[bi].lines[li].custom = true; })} aria-label="Nouvelle mélodie"><Ic n="dice" size={15} /></button>
                  </div>
                  <div className="chords">{(l.chords || []).map((c, ci) => <button key={ci} className="chord" onClick={() => setSheet({ type: 'chord', bi, li, ci })}>{M.chordName(c, song.key, song.mode, song.fr)}</button>)}</div>
                  <Roll line={l} song={song} sel={sel?.bi === bi && sel?.li === li ? sel.ni : -1} act={live ? clock.active.ni : -1} />
                  <div className="syls">
                    {l.syls.map((sy, ni) => {
                      const n = l.notes?.[ni];
                      const on = sel && sel.bi === bi && sel.li === li && sel.ni === ni;
                      const ac = live && clock.active.ni === ni;
                      return (
                        <button key={ni} className={'syl' + (on ? ' sel' : '') + (ac ? ' act' : '') + (sy.end ? ' we' : '')} onClick={() => { setSel(on ? null : { bi, li, ni }); if (n && !on) preview(n.p); }}>
                          {sy.t}<small>{n ? nm(M.posToMidi(n.p, song.key, song.mode)) : ''}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </>}

      {/* ================= BEAT ================= */}
      {tab === 'beat' && <>
        <div className="card">
          <h3><Ico n="metronome" s={28} /> Tempo</h3>
          <div className="bpm">
            <button className="tbtn" onClick={() => up((s) => (s.bpm = clamp(s.bpm - 1, 50, 200)))}>−</button>
            <div className="v">{song.bpm}<small> BPM</small></div>
            <button className="tbtn" onClick={() => up((s) => (s.bpm = clamp(s.bpm + 1, 50, 200)))}>+</button>
            <button className="btn sm" onClick={tapTempo}><Ic n="tap" /> Tap tempo</button>
          </div>
          <input type="range" min="50" max="200" value={song.bpm} onChange={(e) => up((s) => (s.bpm = +e.target.value))} />
          <div className="sl"><span>Swing / groove</span><input type="range" min="0" max="0.7" step="0.05" value={song.swing} onChange={(e) => up((s) => (s.swing = +e.target.value))} /><output>{Math.round(song.swing * 100)}%</output></div>
          <div className="chips" style={{ marginTop: 6 }}>
            <button className={'chip' + (song.drumsOn ? ' on' : '')} onClick={() => up((s) => (s.drumsOn = !s.drumsOn))}><Ic n="drum" size={14} /> Batterie</button>
            <button className={'chip' + (song.metronome ? ' on' : '')} onClick={() => up((s) => (s.metronome = !s.metronome))}><Ic n="bell" size={14} /> Métronome</button>
            <button className={'chip' + (song.intro ? ' on' : '')} onClick={() => up((s) => { s.intro = !s.intro; s.introBars = null; s.introChords = null; })}><Ic n="clap" size={14} /> Intro + fin</button>
          </div>
        </div>

        <div className="card">
          <h3><Ico n="pads" s={28} /> Beat table<span className="sp" /><button className="btn sm" onClick={() => play({ from: 0, to: Math.min(tl.bars.length, 4), loop: true })}><Ic n="loop" /> Boucle</button></h3>
          <div className="chips" style={{ marginBottom: 10 }}>
            {Object.keys(M.DRUM_PRESETS).map((k) => <button key={k} className="chip" onClick={() => up((s) => (s.drums = M.drumPreset(k)))}>{k === 'vide' ? <><Ic n="eraser" size={14} /> Vide</> : <><Ico n={M.STYLES[k]?.e} s={20} /> {M.STYLES[k]?.n || k}</>}</button>)}
          </div>
          <div className="grid">
            {M.DRUM_ROWS.map((r) => (
              <div key={r} style={{ display: 'contents' }}>
                <button className="lbl" onClick={async () => { const e = await ensureAudio(); e.drum(r, e.ctx.currentTime); }}>{M.DRUM_LABELS[r]}</button>
                {song.drums[r].map((on, i) => (
                  <button key={i} className={'cell' + (Math.floor(i / 4) % 2 ? ' g' : '') + (on ? ' on' : '') + (r === 'kick' ? ' k' : r === 'hat' || r === 'open' ? ' h' : '') + (playing && clock && clock.step >= 0 && clock.step % 16 === i ? ' now' : '')}
                    onClick={async () => { up((s) => { s.drums[r][i] = s.drums[r][i] ? 0 : 1; }); if (!song.drums[r][i]) return; const e = await ensureAudio(); e.drum(r, e.ctx.currentTime); }} />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3><Ico n="pad-grid" s={28} /> Pads en direct</h3>
          <div className="pads">
            {[['kick', 'Kick', 'drum'], ['snare', 'Snare', 'snare'], ['clap', 'Clap', 'clap'], ['hat', 'Hat', 'snap'], ['open', 'Open hat', 'cd']].map(([k, n, ic]) => <button key={k} className="pad" onPointerDown={async () => { const e = await ensureAudio(); e.drum(k, e.ctx.currentTime); }}><Ico n={ic} s={34} /><span>{n}</span></button>)}
            {[1, 4, 5, 6, 2, 3, 7].map((d) => <button key={d} className="pad" style={{ color: '#bfdbfe' }} onPointerDown={async () => { const e = await ensureAudio(); e.previewChord(song, d); }}><Ico n="piano" s={28} /><span>{M.chordName(d, song.key, song.mode, song.fr)}</span></button>)}
          </div>
        </div>
      </>}

      {/* ================= STUDIO ================= */}
      {tab === 'studio' && <>
        <div className="card">
          <h3><Ico n="studio-mic" s={30} /> Enregistrement</h3>
          {!micOn ? <button className="btn pri wide" onClick={openMic}><Ic n="mic" /> Activer le micro</button> : <MicMeter eng={eng} />}
          <div className="row" style={{ marginTop: 10 }}>
            <div className="grow"><label className="f">Enregistrer à partir de</label>
              <select value={recFrom} onChange={(e) => setRecFrom(+e.target.value)}>
                <option value={0}>Début de la chanson</option>
                {tl.lines.map((l, i) => <option key={i} value={l.b0}>{l.label} — {l.text.slice(0, 32)}</option>)}
              </select></div>
          </div>
          <div className="chips" style={{ marginTop: 8 }}>
            <button className={'chip' + (song.countIn ? ' on' : '')} onClick={() => up((s) => (s.countIn = !s.countIn))}><Ic n="timer" size={14} /> Décompte 1 mesure</button>
            <button className={'chip' + (song.karaRec ? ' on' : '')} onClick={() => up((s) => (s.karaRec = !s.karaRec))}><Ic n="vocal" size={14} /> Karaoké plein écran</button>
            <button className={'chip' + (song.guide ? ' on' : '')} onClick={() => up((s) => (s.guide = !s.guide))}><Ic n="music" size={14} /> Mélodie guide</button>
            <button className={'chip' + (song.echoCancel ? ' on' : '')} onClick={() => { up((s) => (s.echoCancel = !s.echoCancel)); setMicOn(false); }}><Ic n="noecho" size={14} /> Sans écouteurs</button>
          </div>
          <div style={{ height: 10 }} />
          {!rec ? <button className="btn rec wide" onClick={startRec}><Ico n="record" s={26} /> Enregistrer une prise</button>
            : <button className="btn wide" onClick={finishRec}><span className="rec-dot" /> Arrêter l’enregistrement</button>}
          <div className="sl" style={{ marginTop: 10 }}><span>Latence</span><input type="range" min="-50" max="400" step="5" value={song.latency ?? Math.round((eng.current?.latency() || 0.04) * 1000)} onChange={(e) => up((s) => (s.latency = +e.target.value))} /><output>{song.latency ?? 'auto'}{song.latency != null ? 'ms' : ''}</output></div>
          <div className="hint">Mets des écouteurs pour que le beat ne s’enregistre pas dans le micro. Si ta voix arrive en retard, augmente la latence.</div>
        </div>
        <div className="card">
          <h3><Ico n="upload" s={28} /> Importer un MP4 ou un audio</h3>
          {busy === 'import' ? <div className="row"><span className="busy" /> {progress}</div> : <div className="row">
            <label className="btn ai"><Ic n="sparkles" /> Recréer la chanson<input type="file" accept="audio/*,video/*" hidden onChange={(e) => e.target.files[0] && recreate(e.target.files[0])} /></label>
            <label className="btn"><Ic n="add" /> Ajouter comme piste<input type="file" accept="audio/*,video/*" hidden onChange={(e) => e.target.files[0] && importAudio(e.target.files[0])} /></label>
          </div>}
          <div className="hint" style={{ marginTop: 8 }}><b>Recréer</b> : l’app extrait les paroles (Whisper, dans ton téléphone), le tempo, la tonalité et les accords, sépare la voix de l’instrumental, puis rebâtit mélodie et karaoké. Tu retrouves l’original, l’instrumental et la voix dans la table de son. La 1re fois, le modèle de transcription (~80 Mo) se télécharge. Utilise des chansons dont tu as les droits.</div>
        </div>

        {!song.tracks.length && <div className="empty">Aucune prise pour l’instant.<br />Enregistre ta voix, une guitare ou ton rythme parlé.</div>}
        {song.tracks.map((t) => (
          <div key={t.id} className="track">
            <div className="row nw">
              <input className="nm" value={t.name} onChange={(e) => tr(t.id, (x) => (x.name = e.target.value))} />
              <button className={'tgl m' + (t.mute ? ' on' : '')} onClick={() => tr(t.id, (x) => (x.mute = !x.mute))}>M</button>
              <button className={'tgl s' + (t.solo ? ' on' : '')} onClick={() => tr(t.id, (x) => (x.solo = !x.solo))}>S</button>
              <button className="tgl" aria-label="Supprimer" onClick={() => { if (confirmDel.current === t.id) up((s) => (s.tracks = s.tracks.filter((x) => x.id !== t.id))); else { confirmDel.current = t.id; say('Touche encore la corbeille pour supprimer'); } }}><Ico n="trash" s={22} /></button>
            </div>
            <Wave track={t} />
            <div className="hint">Début : {t.start.toFixed(2)} s · {(t.data?.length / t.sr || 0).toFixed(1)} s</div>
            <div className="chips" style={{ margin: '8px 0' }}>
              {Object.entries(VOICE_FX).map(([k, f]) => <button key={k} className={'chip' + (t.fx === k ? ' on' : '')} onClick={() => tr(t.id, (x) => Object.assign(x, fxParams(k), { fx: k }))}>{f.n}</button>)}
            </div>
            <Slider label="Volume" v={t.vol} min={0} max={1.5} step={0.01} fmt={(x) => Math.round(x * 100)} on={(x) => tr(t.id, (y) => (y.vol = x))} />
            <Slider label="Écho" v={t.echo || 0} min={0} max={0.8} step={0.01} fmt={(x) => Math.round(x * 100)} on={(x) => tr(t.id, (y) => (y.echo = x))} />
            <div className="sl"><span>Temps d’écho</span><select value={t.echoTime || '1/8.'} onChange={(e) => tr(t.id, (y) => (y.echoTime = e.target.value))}>{Object.keys(ECHO_TIMES).map((k) => <option key={k} value={k}>{k === 'slap' ? 'Slap (court)' : k + (k.endsWith('.') ? ' pointée' : '')}</option>)}</select><output /></div>
            <Slider label="Répétitions" v={t.fb ?? 0.3} min={0} max={0.85} step={0.01} fmt={(x) => Math.round(x * 100)} on={(x) => tr(t.id, (y) => (y.fb = x))} />
            <Slider label="Réverb" v={t.reverb || 0} min={0} max={1} step={0.01} fmt={(x) => Math.round(x * 100)} on={(x) => tr(t.id, (y) => (y.reverb = x))} />
            <Slider label="Doublage" v={t.double || 0} min={0} max={1} step={0.01} fmt={(x) => Math.round(x * 100)} on={(x) => tr(t.id, (y) => (y.double = x))} />
            <Slider label="Brillance" v={t.bright || 0} min={-6} max={9} step={0.5} fmt={(x) => x + 'dB'} on={(x) => tr(t.id, (y) => (y.bright = x))} />
            <Slider label="Panoramique" v={t.pan || 0} min={-1} max={1} step={0.05} fmt={(x) => (x < 0 ? 'G' : x > 0 ? 'D' : 'C') + Math.abs(Math.round(x * 100))} on={(x) => tr(t.id, (y) => (y.pan = x))} />
            <div className="row" style={{ marginTop: 6 }}>
              <span className="hint">Décaler :</span>
              {[[-0.05, '−50ms'], [-0.01, '−10'], [0.01, '+10'], [0.05, '+50ms']].map(([d, n]) => <button key={n} className="btn sm" onClick={() => tr(t.id, (y) => (y.start = Math.max(0, y.start + d)))}>{n}</button>)}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn sm ai" onClick={() => alignVoice(t)}><Ico n="voice-wave" s={22} /> Caler le karaoké sur cette voix</button>
              <button className="btn sm" onClick={() => detectTempo(t)}><Ico n="metronome" s={20} /> Tempo</button>
              <button className="btn sm" onClick={async () => { const e = await ensureAudio(); const bar = Math.floor(t.start / (16 * s16(song.bpm))); e.play(song, { from: bar, onEnd: () => setPlaying(false) }); setPlaying(true); }}><Ic n="play" size={14} /> Écouter</button>
            </div>
          </div>
        ))}
        {song.tracks.length > 0 && <label className="row" style={{ fontSize: 13, margin: '4px 4px 12px' }}><input type="checkbox" checked={song.voicePitch} onChange={(e) => up((s) => (s.voicePitch = e.target.checked))} /> En calant, reprendre aussi les notes que je chante</label>}
      </>}

      {/* ================= TABLE DE SON ================= */}
      {tab === 'table' && <Mixer song={song} up={up} eng={eng} playing={playing} />}

      {/* ================= CLIP ================= */}
      {tab === 'clip' && <>
        <div className="card">
          <h3><Ico n="spectrum" s={28} /> Vidéoclip animé</h3>
          <canvas ref={clipRef} className="clip-cv" />
          <label className="f">Format prêt à publier (1080p)</label>
          <div className="chips">{Object.entries(PLATFORMS).map(([k, p]) => <button key={k} className={'chip' + (song.clip.format === p.f ? ' on' : '')} onClick={() => up((s) => (s.clip.format = p.f))}>{p.n} <small>{p.f}</small></button>)}</div>
          <label className="f">Thème visuel</label>
          <div className="chips">{Object.entries(THEMES).map(([k, t]) => <button key={k} className={'chip' + (scenario.theme === k ? ' on' : '')} onClick={() => up((s) => { s.clip.theme = k; if (s.clip.scenario) s.clip.scenario = { ...s.clip.scenario, theme: k, sections: {} }; })}>{t.n}</button>)}</div>
          <div className="chips" style={{ marginTop: 8 }}>{[['karaoke', 'Texte karaoké'], ['bounce', 'Texte qui rebondit']].map(([k, n]) => <button key={k} className={'chip' + ((scenario.textStyle || 'karaoke') === k ? ' on' : '')} onClick={() => up((s) => { s.clip.scenario = { ...scenario, textStyle: k }; })}>{n}</button>)}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn ai" disabled={!!busy} onClick={aiClip}>{busy === 'clip' ? <span className="busy" /> : <Ic n="sparkles" />} Scénario IA</button>
            <label className="btn"><Ic n="film" /> Vidéo de fond<input type="file" accept="video/*" hidden onChange={(e) => e.target.files[0] && setVideoBg(e.target.files[0])} /></label>
            {videoBg.current && <button className="btn sm" onClick={() => { videoBg.current = null; bump(); }}><Ic n="x" /> Vidéo</button>}
            <label className="btn"><Ic n="images" /> Mes photos<input type="file" accept="image/*" multiple hidden onChange={async (e) => { photos.current = (await Promise.all([...e.target.files].slice(0, 12).map(loadImage))).filter(Boolean); bump(); say(`${photos.current.length} photo(s) ajoutée(s)`); }} /></label>
            {song.clip.scenario && <button className="btn sm" onClick={() => up((s) => (s.clip.scenario = null))}><Ic n="undo" /> Thème simple</button>}
          </div>
          <div className="hint" style={{ marginTop: 8 }}>Claude écrit le scénario : un thème, des couleurs et des mots-clés par section. L’animation suit le son et les paroles s’affichent en karaoké. Tes photos défilent en fond, une par ligne.</div>
        </div>
        <div className="card">
          <h3><Ico n="share" s={28} /> Exporter</h3>
          {exporting ? <>
            <div className="row"><span className="busy" /> Export {exporting === 'clip' ? 'du clip' : exporting === 'wav' ? 'WAV' : 'MP4'} en cours… garde l’écran allumé.</div>
            {exporting !== 'wav' && <button className="btn sm" style={{ marginTop: 8 }} onClick={() => exportStop.current?.()}><Ic n="stop" /> Arrêter et enregistrer</button>}
          </> : <>
          <label className="f">Partie à exporter</label>
          <div className="chips" style={{ marginBottom: 10 }}>{[['all', 'Toute la chanson'], ['chorus', 'Le refrain'], ['30', '30 s'], ['60', '60 s']].map(([k, n]) => <button key={k} className={'chip' + (range === k ? ' on' : '')} onClick={() => setRange(k)}>{n}</button>)}</div>
          <div className="row">
            <button className="btn pri" onClick={() => exportLive(true)}><Ico n="play" s={22} /> Clip MP4</button>
            <button className="btn" onClick={() => exportLive(false)}><Ico n="disc-note" s={22} /> Audio MP4</button>
            <button className="btn" onClick={exportWav}><Ico n="wav" s={22} /> WAV studio</button>
          </div></>}
          <div className="hint" style={{ marginTop: 8 }}>Clip MP4 en H.264 + AAC, 1080p, 30 images/s : prêt pour TikTok, Reels, Shorts et YouTube. 30 s et 60 s partent du 1er refrain. L’export se fait en temps réel ; le WAV (chanson complète) est instantané. Les sons de Sonyria sont générés par l’app, donc libres de droits.</div>
        </div>
      </>}

      {/* ================= transport ================= */}
      {sel && selNote && tab === 'melodie' && (
        <div className="notebar"><div className="in">
          <div className="nm">« {song.blocks[sel.bi].lines[sel.li].syls[sel.ni]?.t} » <b>{nm(M.posToMidi(selNote.p, song.key, song.mode))}</b> · {selNote.dur}/16</div>
          <button className="mini" onClick={() => { editNote((l, n) => (n.p = clamp(n.p + 1, -5, 12))); preview(selNote.p + 1); }}><Ic n="up" /></button>
          <button className="mini" onClick={() => { editNote((l, n) => (n.p = clamp(n.p - 1, -5, 12))); preview(selNote.p - 1); }}><Ic n="down" /></button>
          <button className="mini" onClick={() => editNote((l, n) => (n.dur = clamp(n.dur - 1, 1, 16)))}>−</button>
          <button className="mini" onClick={() => editNote((l, n) => (n.dur = clamp(n.dur + 1, 1, 16)))}>+</button>
          <button className="mini" onClick={() => editNote((l, n) => { const nx = l.notes[sel.ni + 1]; if (n.rest > 0) { n.rest--; if (nx) nx.rest++; } })}><Ic n="left" /></button>
          <button className="mini" onClick={() => editNote((l, n) => { const nx = l.notes[sel.ni + 1]; n.rest++; if (nx && nx.rest > 0) nx.rest--; })}><Ic n="right" /></button>
          <button className="mini" onClick={() => setSel(null)}><Ic n="x" /></button>
        </div></div>
      )}

      <div className="transport"><div className="in">
        <button className="tbtn" onClick={() => { stop(); }} aria-label="Arrêter"><Ico n="stop" s={34} /></button>
        <button className="play" onClick={() => (playing ? stop() : play({ from: 0 }))} aria-label="Lecture">{playing ? <Ico n="pause" s={52} /> : <Ico n="play" s={52} />}</button>
        <div className="tinfo">
          <b>{rec ? <><span className="rec-dot" /> Enregistrement…</> : song.title}</b>
          {M.STYLES[song.style].n} · {keyLabel} · {song.bpm} BPM · <span className="pos">{posLabel}</span>
        </div>
        <button className={'tbtn' + (loop ? ' on' : '')} onClick={() => setLoop(!loop)} aria-label="Boucle"><Ico n="loop" s={34} dim={!loop} /></button>
        <button className="tbtn" onClick={() => setKara(true)} aria-label="Karaoké"><Ico n="microphone" s={30} /></button>
        <button className="tbtn" style={{ color: '#ef4444' }} onClick={() => (rec ? finishRec() : startRec())} aria-label="Enregistrer">{rec ? <Ico n="stop" s={34} /> : <Ico n="record" s={34} />}</button>
      </div></div>

      {kara && <Karaoke song={song} tl={tl} eng={eng} playing={playing} rec={rec} onClose={() => setKara(false)} onPlay={() => (playing ? stop() : play({ from: 0 }))} onRec={() => (rec ? finishRec() : startRec())} />}

      {sheet && <div className="sheet-bg" onClick={() => setSheet(null)}><div className="sheet" onClick={(e) => e.stopPropagation()}>
        {sheet.type === 'chord' && <>
          <h3>Choisir l’accord</h3>
          <div className="ch-grid">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const cur = song.blocks[sheet.bi].lines[sheet.li].chords[sheet.ci];
              return <button key={d} className={cur === d ? 'on' : ''} onClick={async () => { up((s) => { s.blocks[sheet.bi].lines[sheet.li].chords[sheet.ci] = d; s.blocks[sheet.bi].lines[sheet.li].custom = true; }); const e = await ensureAudio(); e.previewChord(song, d); }}>
                {M.chordName(d, song.key, song.mode, song.fr)}<small>{['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][d - 1]}</small></button>;
            })}
          </div>
          <button className="btn wide" style={{ marginTop: 12 }} onClick={() => setSheet(null)}>OK</button>
        </>}
        {sheet.type === 'profile' && me && <>
          <h3><img src={avSrc(me.av)} alt="" style={{ width: 34, height: 34, borderRadius: '50%' }} /> Mon profil</h3>
          <label className="f">Prénom</label><input type="text" value={me.name || ''} onChange={(e) => setMe({ ...me, name: e.target.value })} />
          <label className="f">Nom d’artiste</label><input type="text" value={me.artist || ''} onChange={(e) => setMe({ ...me, artist: e.target.value })} />
          <label className="f">Avatar</label>
          <div style={{ maxHeight: 320, display: 'flex' }}><AvatarGrid value={me.av} onPick={(a) => setMe({ ...me, av: a })} /></div>
          <button className="btn wide" style={{ marginTop: 12 }} onClick={() => setSheet(null)}>OK</button>
        </>}
        {sheet.type === 'songs' && <SongsSheet song={song} load={load} close={() => setSheet(null)} say={say} />}
        {sheet.type === 'settings' && <>
          <h3><Ico n="settings" s={28} /> Réglages</h3>
          <div className="hint">IA : {aiStatus == null ? '…' : aiStatus.ai ? 'Clé Anthropic détectée ✓' : 'Aucune clé (ajoute ANTHROPIC_API_KEY dans Vercel)'}</div>
          {aiStatus?.locked && <><label className="f">Code d’accès IA</label><input type="text" value={code} onChange={(e) => { setCode(e.target.value); localStorage.setItem('sonyria-code', e.target.value); }} placeholder="Code défini dans Vercel" /></>}
          <label className="f">Notation</label>
          <div className="chips"><button className={'chip' + (!song.fr ? ' on' : '')} onClick={() => up((s) => (s.fr = false))}>C D E</button><button className={'chip' + (song.fr ? ' on' : '')} onClick={() => up((s) => (s.fr = true))}>Do Ré Mi</button></div>
          <label className="f">Profil</label>
          <div className="row"><button className="btn sm" onClick={() => setSheet({ type: 'profile' })}><Ic n="user" /> Prénom, nom d’artiste, avatar</button><button className="btn sm" onClick={() => { setMe({ ...me, onboarded: false }); setSheet(null); }}><Ic n="undo" /> Revoir l’accueil</button></div>
          <label className="f">Installer l’app</label>
          <div className="hint">Android / Chrome : bouton « Installer » en haut, ou menu ⋮ → « Installer l’application ». iPhone : Partager → « Sur l’écran d’accueil ».</div>
          <button className="btn wide" style={{ marginTop: 14 }} onClick={() => setSheet(null)}>Fermer</button>
        </>}
      </div></div>}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
const confirmDel = { current: null };

// ---------- composants ----------
function Slider({ label, v, min, max, step, fmt, on }) {
  return <div className="sl"><span>{label}</span><input type="range" min={min} max={max} step={step} value={v} onChange={(e) => on(+e.target.value)} /><output>{fmt ? fmt(v) : v}</output></div>;
}

function Roll({ line, song, sel, act }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv || !line.notes) return;
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
    const L = line.bars * 16;
    g.strokeStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i <= L; i += 4) { g.lineWidth = i % 16 ? 1 : 2; g.beginPath(); g.moveTo((i / L) * W, 0); g.lineTo((i / L) * W, H); g.stroke(); }
    const ps = line.notes.map((n) => n.p), lo = Math.min(...ps, -1) - 1, hi = Math.max(...ps, 8) + 1;
    let t = 0;
    line.notes.forEach((n, i) => {
      t += n.rest;
      const x = (t / L) * W, w = Math.max(3, (n.dur / L) * W - 2), y = H - ((n.p - lo) / (hi - lo)) * H;
      const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, i === act ? '#fff' : '#22d3ee'); gr.addColorStop(1, i === act ? '#fb923c' : '#a855f7');
      g.fillStyle = gr; g.shadowColor = '#a855f7'; g.shadowBlur = i === act ? 14 : 4;
      g.beginPath(); g.roundRect ? g.roundRect(x, y - 4, w, 8, 4) : g.rect(x, y - 4, w, 8); g.fill();
      if (i === sel) { g.shadowBlur = 0; g.strokeStyle = '#fb923c'; g.lineWidth = 2; g.strokeRect(x - 1, y - 6, w + 2, 12); }
      t += n.dur;
    });
  });
  return <canvas ref={ref} className="roll" />;
}

function Wave({ track }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv || !track.data) return;
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const d = track.data, step = Math.max(1, Math.floor(d.length / W));
    const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#22d3ee'); gr.addColorStop(0.5, '#a855f7'); gr.addColorStop(1, '#fb923c');
    g.fillStyle = gr;
    for (let x = 0; x < W; x++) { let m = 0; for (let i = x * step; i < (x + 1) * step && i < d.length; i += 4) m = Math.max(m, Math.abs(d[i])); const h = Math.max(1, m * H * 0.95); g.fillRect(x, (H - h) / 2, 1, h); }
  }, [track.data]);
  return <canvas ref={ref} className="wave" />;
}

function MicMeter({ eng }) {
  const [lv, setLv] = useState(0);
  useEffect(() => {
    let raf; const d = new Uint8Array(512);
    const f = () => { const a = eng.current?.micAnalyser; if (a) { a.getByteTimeDomainData(d); let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i] - 128)); setLv(m / 128); } raf = requestAnimationFrame(f); };
    f(); return () => cancelAnimationFrame(raf);
  }, [eng]);
  return <div><div className="hint"><Ic n="mic" size={13} /> Micro actif — niveau</div><div className="meter"><i style={{ width: Math.min(100, lv * 140) + '%' }} /></div></div>;
}

function Mixer({ song, up, eng, playing }) {
  const [lv, setLv] = useState({});
  useEffect(() => {
    let raf, n = 0;
    const f = () => { if (eng.current && n++ % 3 === 0) { const o = {}; Object.keys(eng.current.meters).forEach((k) => (o[k] = eng.current.level(k))); setLv(o); } raf = requestAnimationFrame(f); };
    f(); return () => cancelAnimationFrame(raf);
  }, [eng]);
  const m = song.mix;
  const strips = [['lead', 'Voix guide', 'note'], ['harm', 'Harmonie', 'wave-pink'], ['chords', 'Accords', 'piano'], ['bass', 'Basse', 'bass'], ['drums', 'Batterie', 'drumkit'], ['tracks', 'Pistes', 'mic']];
  return <>
    <div className="card">
      <h3><Ico n="mixer" s={28} /> Table de son</h3>
      <div className="console">
        {strips.map(([k, n, i]) => <Strip key={k} name={n} icon={i} val={m[k]} meter={lv[k]} set={(x) => up((s) => (s.mix[k] = x))} mute={m.mute[k]} solo={m.solo[k]}
          onMute={() => up((s) => (s.mix.mute[k] = !s.mix.mute[k]))} onSolo={() => up((s) => (s.mix.solo[k] = !s.mix.solo[k]))} />)}
        {song.tracks.map((t) => <Strip key={t.id} name={t.name} icon="voice-wave" val={t.vol} meter={lv['tr_' + t.id]} set={(x) => up((s) => (s.tracks.find((y) => y.id === t.id).vol = x))} mute={t.mute} solo={t.solo}
          onMute={() => up((s) => { const y = s.tracks.find((z) => z.id === t.id); y.mute = !y.mute; })} onSolo={() => up((s) => { const y = s.tracks.find((z) => z.id === t.id); y.solo = !y.solo; })}
          extra={<input type="range" className="knob" min="-1" max="1" step="0.05" value={t.pan || 0} title="Panoramique" onChange={(e) => up((s) => (s.tracks.find((y) => y.id === t.id).pan = +e.target.value))} />} />)}
        <Strip name="Master" icon="speaker" val={m.master} meter={lv.master} set={(x) => up((s) => (s.mix.master = x))} />
      </div>
      {!playing && <div className="hint" style={{ marginTop: 8 }}>Lance la lecture pour voir les vumètres bouger.</div>}
    </div>
    <div className="card">
      <h3><Ico n="fx" s={28} /> Effets de la voix guide</h3>
      <Slider label="Écho" v={m.leadEcho} min={0} max={0.7} step={0.01} fmt={(x) => Math.round(x * 100)} on={(x) => up((s) => (s.mix.leadEcho = x))} />
      <Slider label="Réverb" v={m.leadReverb} min={0} max={1} step={0.01} fmt={(x) => Math.round(x * 100)} on={(x) => up((s) => (s.mix.leadReverb = x))} />
      <div className="hint">Les effets de tes prises (écho, réverb, doublage, brillance) se règlent piste par piste dans l’onglet Studio.</div>
    </div>
  </>;
}

function Strip({ name, icon, val, set, mute, solo, onMute, onSolo, meter, extra }) {
  return (
    <div className="strip">
      <div className="sico"><Ico n={icon} s={34} /></div>
      <div className="snm">{name}</div>
      {extra}
      <div className="fader">
        <div className="vu"><i style={{ height: Math.min(100, (meter || 0) * 160) + '%' }} /></div>
        <input type="range" min="0" max="1.2" step="0.01" value={val} onChange={(e) => set(+e.target.value)} />
      </div>
      <div className="sval">{Math.round(val * 100)}</div>
      {onMute && <div className="row nw" style={{ gap: 4 }}><button className="imgtgl" onClick={onMute} aria-label="Muet"><Ico n="mute-m" s={30} dim={!mute} /></button><button className="imgtgl" onClick={onSolo} aria-label="Solo"><Ico n="solo" s={30} dim={!solo} /></button></div>}
    </div>
  );
}

function Karaoke({ song, tl, eng, playing, rec, onClose, onPlay, onRec }) {
  const [st, setSt] = useState(null);
  useEffect(() => {
    let raf;
    const f = () => { setSt(eng.current?.songTime() || null); raf = requestAnimationFrame(f); };
    f(); return () => cancelAnimationFrame(raf);
  }, [eng]);
  const d = s16(song.bpm);
  const t = st && !st.countIn ? st.t : null;
  let idx = 0;
  if (t != null) tl.lines.forEach((l, i) => { if (l.syl[0] && t >= l.syl[0].g * d - 0.9) idx = i; });
  const show = [idx - 1, idx, idx + 1, idx + 2];
  const cur = tl.lines[idx];
  const beat = t != null ? Math.floor(t / (4 * d)) % 4 : -1;
  const count = st?.countIn ? Math.ceil(st.left / (4 * d)) : null;
  return (
    <div className="kara">
      <div className="top">
        <button className="icon-btn" onClick={onClose} aria-label="Fermer"><Ic n="x" /></button>
        <div style={{ flex: 1 }}><div className="sec">{cur?.label || ''}</div><div className="hint">{song.title} · {song.bpm} BPM</div></div>
        {rec && <span className="rec-dot" />}
      </div>
      <div className="stage">
        {count ? <div className="count">{count}</div> : show.map((i, k) => {
          const L = tl.lines[i];
          if (!L) return <div key={k} className="l" />;
          const cls = ['prev', '', 'next', 'next2'][k];
          return (
            <div key={i + '-' + k} className={'l ' + cls}>
              {L.syl.map((s, j) => {
                const p = t == null ? 0 : clamp((t - s.g * d) / Math.max(0.08, s.dur * d), 0, 1);
                const sy = song.blocks[L.bi]?.lines[L.li]?.syls[j];
                return <span key={j} className={'s' + (sy?.end ? ' we' : '')} style={{ backgroundPosition: `${100 - p * 100}% 0` }}>{s.t}</span>;
              })}
            </div>
          );
        })}
      </div>
      <div className="beat">{[0, 1, 2, 3].map((i) => <i key={i} className={beat === i ? 'on' : ''} />)}</div>
      <div className="row" style={{ justifyContent: 'center', gap: 14, marginTop: 16 }}>
        <button className="play img" onClick={onPlay}>{playing ? <Ico n="pause" s={70} /> : <Ico n="play" s={70} />}</button>
        <button className="play img" onClick={onRec}>{rec ? <Ico n="stop" s={70} /> : <Ico n="record" s={70} />}</button>
      </div>
    </div>
  );
}

function SongsSheet({ song, load, close, say }) {
  const [list, setList] = useState(null);
  const refresh = () => DB.listSongs().then(setList).catch(() => setList([]));
  useEffect(() => { refresh(); }, []);
  return <>
    <h3><Ico n="folder" s={28} /> Mes chansons</h3>
    <div className="row" style={{ marginBottom: 10 }}>
      <button className="btn pri" onClick={() => { load(newSong('')); close(); }}>＋ Nouvelle chanson</button>
      <button className="btn" onClick={() => { const c = structuredClone(serialize(song)); c.id = 's' + Date.now(); c.title = song.title + ' (copie)'; load(c); close(); say('Copie créée'); }}>⧉ Dupliquer</button>
    </div>
    {list == null ? <span className="busy" /> : !list.length ? <div className="hint">Rien d’enregistré pour l’instant (sauvegarde automatique).</div> :
      list.map((x) => (
        <div key={x.id} className="row nw" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
          <button className="grow" style={{ textAlign: 'left' }} onClick={async () => { const r = await DB.getSong(x.id); if (r) { const d = newSong(); load({ ...d, ...r.song, mix: { ...d.mix, ...r.song.mix }, clip: { ...d.clip, ...r.song.clip } }); close(); } }}>
            <b>{x.title || 'Sans titre'}</b>{x.id === song.id && <span className="badge" style={{ marginLeft: 6 }}>ouverte</span>}<div className="hint">{new Date(x.updated).toLocaleString('fr-CA')}</div>
          </button>
          {x.id !== song.id && <button className="tgl" onClick={async () => { await DB.deleteSong(x.id); refresh(); }} aria-label="Supprimer"><Ico n="trash" s={24} /></button>}
        </div>
      ))}
  </>;
}

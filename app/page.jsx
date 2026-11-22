'use client';
import { tx, initLang, setLang, onLang, getLang } from '@/lib/i18n';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import * as M from '@/lib/music';
import { Engine, buildTimeline, s16, renderOffline, wavBlob, storeToBuffer, VOICE_FX, ECHO_TIMES, pickMime, prepareSamples, kitFor } from '@/lib/engine';
import { KITS } from '@/lib/samples';
import { ROLES, ensureLayers, defaultLayers, instName, instIcon, newLayer } from '@/lib/arrange';
import { LOOKS, OVERLAYS, SPECTRA, TEXT_STYLES } from '@/lib/video';
import { ClipRenderer, THEMES, THEME_CATS, FORMATS, PLATFORMS, defaultScenario, loadImage, currentLine } from '@/lib/video';
import { separate, analyzeMusic, transcribe, buildSong, segsToLyrics } from '@/lib/analyze';
import * as H from '@/lib/hum';
import { imageToJpeg, toB64, docxText } from '@/lib/importText';
import { renderScore, chordSheet } from '@/lib/score';
import * as DB from '@/lib/storage';
import { songToFile, fileToSong, shareFile } from '@/lib/share';
import { loadCutout } from '@/lib/cutout';
import { makeBacking, BACKS } from '@/lib/backing';
import { newCode, prettyCode, normCode, loadSpaces, saveSpaces, syncSpace, syncReady, peekSpace } from '@/lib/sync';
import { drawCover, loadCover, saveCover, COVER_FONTS, COVER_LAYOUTS } from '@/lib/cover';
import Ic, { IconDefs, Ico } from './Ic';
import { Splash, Onboarding, AvatarGrid, loadMe, saveMe, avSrc } from './Welcome';

const isDemo = (t) => { const x = (t || '').trim(); return !!x && (x === DEMO.trim() || x === DEMO_EN.trim()); };
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

const DEMO_EN = `[Verse]
On the road tonight I walk without a sound
City lights are dancing all around
I keep your words deep inside my heart
Every step brings me closer from the start

[Chorus]
And I sing for you
When the city sleeps
Your voice is guiding me
To the end of the night`;

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fxParams = (k) => { const { n, ...p } = VOICE_FX[k]; return { echoTime: '1/8.', fb: 0.3, ...p }; };
const LEADS = { voix: 'Chœur (aah)', piano: 'Piano à queue', sax: 'Saxophone ténor', altosax: 'Saxophone alto', trumpet: 'Trompette', flute: 'Flûte', guitar: 'Guitare électrique', nylon: 'Guitare classique', strings: 'Cordes', synth: 'Synthé' };
const CHORDS = { '': 'Auto (style)', piano: 'Piano à queue', epiano: 'Piano Rhodes', pluck: 'Guitare acoustique', nylon: 'Guitare classique', eguitar: 'Guitare électrique', power: 'Guitare saturée', strings: 'Cordes', choir: 'Chœur', synthpad: 'Nappe synthé', supersaw: 'Supersaw' };
const HARMS = { off: 'Aucune', up3: 'Tierce au-dessus', down3: 'Tierce en dessous', up6: 'Sixte', oct: 'Octave' };
const TYPES = { verse: 'Couplet', chorus: 'Refrain', bridge: 'Pont' };

function freshFrom(prev, keep) {
  const n = newSong('');
  if (prev) n.artist = prev.artist || '';
  if (keep && prev) {
    ['style', 'bpm', 'swing', 'key', 'mode', 'kit', 'chordSound', 'leadSound', 'intro', 'introBars', 'drumsOn', 'harmony', 'guide', 'fr', 'drums', 'layers', 'mix'].forEach((k) => { if (prev[k] !== undefined) n[k] = structuredClone(prev[k]); });
    n.clip = { ...n.clip, theme: prev.clip?.theme || null, format: prev.clip?.format || n.clip.format };
  }
  return n;
}
const styleLabel = (s) => `${tx(M.STYLES[s.style]?.n || s.style)} · ${s.bpm} BPM · ${tx('{n} instruments', { n: (s.layers || []).filter((l) => l.on !== false).length })}`;

function newSong(lyrics = DEMO) {
  const s = {
    id: 's' + Date.now(), title: tx('Ma chanson'), artist: '', lyrics, blocks: [], style: 'pop', key: 0, mode: 'maj', bpm: 104, swing: 0,
    drums: M.drumPreset('pop'), drumsOn: true, intro: true, leadSound: 'voix', chordSound: '', harmony: 'off', guide: true, metronome: false,
    variant: 0, fr: false, voicePitch: true,
    mix: { lead: 0.75, harm: 0.45, chords: 0.5, bass: 0.7, drums: 0.8, tracks: 1, master: 0.9, leadReverb: 0.25, leadEcho: 0.12, mute: {}, solo: {} },
    tracks: [], clip: { format: '9:16', scenario: null, theme: null }, album: (() => { try { return localStorage.getItem('sonyria-album') || ''; } catch (e) { return ''; } })(), latency: null, echoCancel: false, karaRec: true, countIn: true,
  };
  s.blocks = M.parseLyrics(lyrics); M.composeSong(s, 0); s.layers = defaultLayers(s);
  return s;
}
function applyStyle(s, style) {
  const st = M.STYLES[style];
  s.kit = null; s.layers = null;
  s.style = style; s.bpm = st.bpm; s.swing = st.swing; s.drums = M.drumPreset(st.drums); s.chordSound = ''; s.leadSound = st.lead || 'voix';
  s.layers = defaultLayers(s);
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
  if (!S.current) S.current = newSong('');
  const song = S.current;
  const [v, bump] = useReducer((x) => x + 1, 0);
  const [tab, setTabState] = useState('paroles');
  const setTab = (t) => { setTabState(t); try { localStorage.setItem('sonyria-tab', t); } catch (e) {} const c = S.current; if (c?.lyrics?.trim() && !c.visited?.[t]) { c.visited = { ...(c.visited || {}), [t]: true }; } };
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
  const [installUI, setInstallUI] = useState(null);
  const [compact, setCompact] = useState(false);
  const [hum, setHum] = useState({ mode: 'hum', metro: true, onLyrics: true, keepKey: false, instr: 'piano' });
  const [humRec, setHumRec] = useState(false);
  const [ocr, setOcr] = useState(null);
  const [ocrFix, setOcrFix] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [fs, setFs] = useState(null);
  const [coverV, setCoverV] = useState(0);
  const coverUrl = useMemo(() => (typeof window === 'undefined' ? '' : loadCover(song.album || '')), [song.album, coverV, v]); // eslint-disable-line
  const coverImg = useRef(null);
  useEffect(() => { if (!coverUrl) { coverImg.current = null; return; } const im = new Image(); im.onload = () => { coverImg.current = im; }; im.src = coverUrl; }, [coverUrl]);
  const [cam, setCam] = useState(false);
  const [themeCat, setThemeCat] = useState(null);
  const [decor, setDecor] = useState('anim');
  const [folds, setFolds] = useState({});
  const [guide, setGuide] = useState({ on: false, step: 0 });
  const saveGuide = (g) => { setGuide(g); try { localStorage.setItem('sonyria-guide', JSON.stringify(g)); } catch (e) {} };
  const goStep = (i) => {
    const g = GUIDE[i]; saveGuide({ on: true, step: i }); setTab(g.tab);
    setTimeout(() => { const el = g.anchor && (document.getElementById(g.anchor + '-guide') || document.getElementById(g.anchor)); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); else window.scrollTo({ top: 0, behavior: 'smooth' }); }, 80);
  };
  const humInfo = useRef(null);
  const [clock, setClock] = useState(null);
  const [aiVibe, setAiVibe] = useState(false);
  const [ambRead, setAmbRead] = useState('');
  const [exporting, setExporting] = useState('');
  const [micOn, setMicOn] = useState(false);
  const [polish, setPolish] = useState(null);
  const [progress, setProgress] = useState('');
  const [splash, setSplash] = useState(true);
  const [lang, setLangState] = useState('fr');
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

  const doInstall = async () => {
    const e = install || window.__bip;
    if (!e) { setSheet({ type: 'settings' }); return; }
    try { e.prompt(); const r = await e.userChoice; if (r?.outcome === 'accepted') { window.__bip = null; setInstall(null); } } catch (err) { setSheet({ type: 'settings' }); }
  };
  const closeInstall = () => { try { sessionStorage.setItem('sonyria-inst-x', '1'); } catch (e) {} setInstallUI({ ...installUI, dismissed: true }); };
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
    ensureLayers(s); S.current = s; setSel(null);
    if (videoBg.current) { videoBg.current.pause?.(); videoBg.current = null; }
    DB.getSong('video:' + s.id).then((r) => { if (r?.video && S.current.id === s.id) setVideoBg(r.video); }).catch(() => {}); setAmb(M.suggestAmbiances(s.blocks)); setAmbSel(-1); lastBpm.current = s.bpm;
    if (eng.current) s.tracks.forEach((t) => { t.buffer = t.data ? storeToBuffer(eng.current.ctx, { sr: t.sr, ch: [t.data] }) : null; });
    bump();
  };

  // ---------- synchro automatique (mes appareils + équipes) ----------
  const syncing = useRef(false);
  useEffect(() => {
    const run = async () => {
      if (syncing.current || document.hidden || !navigator.onLine) return;
      const sps = loadSpaces(); if (!sps.length) return;
      syncing.current = true;
      try {
        const c = S.current;
        if (c?.lyrics?.trim()) { try { const old = await DB.getSong(c.id); if (!old || JSON.stringify(old.song?.lyrics) !== JSON.stringify(c.lyrics) || (old.updated || 0) < (c._edited || 0)) await DB.saveSong({ id: c.id, title: c.title, updated: Date.now(), song: serialize(c) }); } catch (e) {} }
        for (const sp of sps) {
          const r = await syncSpace(sp, { me: loadMe() }).catch(() => null);
          if (r?.pulled?.includes(S.current.id)) { const x = await DB.getSong(S.current.id); if (x?.song) { const d = newSong(''); load({ ...d, ...x.song, mix: { ...d.mix, ...x.song.mix }, clip: { ...d.clip, ...x.song.clip } }); } }
          if (r && (r.pulled.length || r.removed)) say(tx('Synchro : {n} chanson(s) reçue(s)', { n: r.pulled.length }));
        }
      } finally { syncing.current = false; }
    };
    const t0 = setTimeout(run, 4000), it = setInterval(run, 60000);
    const vis = () => { if (!document.hidden) run(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearTimeout(t0); clearInterval(it); document.removeEventListener('visibilitychange', vis); };
  }, []); // eslint-disable-line

  // ---------- cartes repliables ----------
  const FOLD_DEFAULT = ['Pads en direct', 'Importer un MP4 ou un audio', 'Effets de la voix guide', 'Tempo', 'Style', 'Fredonne ou chante', 'Propositions de mélodie'];
  useEffect(() => { try { setFolds(JSON.parse(localStorage.getItem('sonyria-folds') || '{}')); } catch (e) {} }, []);
  useEffect(() => {
    document.querySelectorAll('.app .card > h3').forEach((h) => {
      if (h.closest('.fs, .sheet')) return;
      const k = h.dataset.fk || (h.textContent || '').replace(/Plein écran|Full screen|Auto|Boucle|Loop/g, '').trim().slice(0, 40);
      if (!k) return; h.dataset.fk = k; h.classList.add('foldable');
      const def = FOLD_DEFAULT.some((f) => k.startsWith(tx(f)));
      h.parentElement.classList.toggle('folded', folds[k] ?? def);
    });
  });

  // ---------- démarrage ----------
  useEffect(() => {
    (async () => {
      try {
        // remise à zéro unique (même pour l'app déjà installée) : on repart à vide
        if (!localStorage.getItem('sonyria-reset-1')) {
          try { const all = await DB.listSongs(); for (const x of all) await DB.deleteSong(x.id); } catch (e) {}
          try { Object.keys(localStorage).filter((k) => k.startsWith('sonyria-') && k !== 'sonyria-lang').forEach((k) => localStorage.removeItem(k)); } catch (e) {}
          localStorage.setItem('sonyria-reset-1', '1');
          load(newSong(''));
        }
        const id = localStorage.getItem('sonyria-current');
        setCode(localStorage.getItem('sonyria-code') || '');
        setMeState(loadMe());
        try {
          const gg = JSON.parse(localStorage.getItem('sonyria-guide') || 'null');
          // le guide s'affiche à la première séance seulement; ensuite il reste caché (bouton ? pour le revoir)
          const seen = localStorage.getItem('sonyria-guide-seen');
          setGuide(gg ? (seen ? { ...gg, on: false } : gg) : { on: true, step: 0 });
          if (gg) localStorage.setItem('sonyria-guide-seen', '1');
        } catch (e) { setGuide({ on: true, step: 0 }); }
        try { const lt = localStorage.getItem('sonyria-tab'); if (lt && ['paroles', 'melodie', 'beat', 'studio', 'table', 'clip'].includes(lt)) setTab(lt); } catch (e) {}
        setLangState(initLang());
        if (id) { const r = await DB.getSong(id); if (r?.song && !isDemo(r.song.lyrics)) { const d = newSong(''); load({ ...d, ...r.song, mix: { ...d.mix, ...r.song.mix }, clip: { ...d.clip, ...r.song.clip } }); } else load(newSong('')); }
        if (typeof window !== 'undefined' && 'launchQueue' in window) window.launchQueue.setConsumer(async (p) => { const h = p.files?.[0]; if (!h) return; try { const { song: s } = await fileToSong(await h.getFile()); const d = newSong(''); load({ ...d, ...s, mix: { ...d.mix, ...s.mix }, clip: { ...d.clip, ...s.clip } }); } catch (e) {} });
      } catch (e) {}
    })();
    fetch('/api/claude').then((r) => r.json()).then(setAiStatus).catch(() => setAiStatus({ ai: false }));
    const onScroll = () => setCompact(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    const off = onLang((l) => { setLangState(l); bump(); });
    // l'événement est capté tôt dans layout.js (sans preventDefault, la bannière native de Chrome reste)
    const bip = () => setInstall(window.__bip || null);
    bip();
    window.addEventListener('sonyria-bip', bip);
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    let dismissed = false; try { dismissed = sessionStorage.getItem('sonyria-inst-x') === '1'; } catch (e) {}
    setInstallUI({ standalone, ios, dismissed });
    return () => { off(); window.removeEventListener('sonyria-bip', bip); window.removeEventListener('scroll', onScroll); };
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
    // vrais instruments : on attend au plus 4 s (sinon le synthé prend le relais pendant le chargement)
    await Promise.race([prepareSamples(c, song), new Promise((r) => setTimeout(r, 4000))]);
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
      if (s.blocks.title && (!s.title || s.title === tx('Ma chanson') || s.title === 'Ma chanson' || s.title === 'My song')) s.title = s.blocks.title;
      M.composeSong(s, s.variant);
      s.blocks.forEach((b) => b.lines.forEach((l) => { const o = old[l.text]; if (o && o.syls.length === l.syls.length && o.custom) { l.bars = o.bars; l.chords = [...o.chords]; l.notes = o.notes.map((n) => ({ ...n })); l.custom = true; } }));
    });
    setAmb(M.suggestAmbiances(song.blocks)); setAmbSel(-1);
  };
  useEffect(() => {
    const t = (song.lyrics || '').trim();
    if (!t || aiStatus?.ai !== true || busy || t === lastAmb.current || t.split('\n').filter(Boolean).length < 2) return;
    const h = setTimeout(() => aiAmbiances(), 2500);
    return () => clearTimeout(h);
  }, [song.lyrics, aiStatus, busy]); // eslint-disable-line
  const onLyrics = (text) => { song.lyrics = text; bump(); clearTimeout(lyricsT.current); lyricsT.current = setTimeout(() => analyze(text), 700); };
  const chooseAmb = async (a, i) => {
    setAmbSel(i);
    up((s) => { s.styleChosen = true; applyStyle(s, a.style); s.key = a.key; s.mode = a.mode; s.bpm = a.bpm; M.composeSong(s, s.variant); });
    if (aiStatus?.ai) { await aiCompose(true); }
    play({ from: 0, to: Math.min(buildTimeline(song).bars.length, (song.intro ? 2 : 0) + 8), loop: false });
    say(tx('Extrait de 8 mesures. Touche ▶ en bas pour écouter toute la chanson.'));
  };

  // ---------- IA ----------
  const ai = async (task, payload) => {
    const r = await fetch('/api/claude', { method: 'POST', headers: { 'content-type': 'application/json', 'x-access-code': code }, body: JSON.stringify({ task, payload: { ...payload, lang: getLang() } }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || tx('Erreur du serveur IA'));
    return j.data;
  };
  const lastAmb = useRef('');
  const aiAmbiances = async () => {
    setBusy('amb'); lastAmb.current = song.lyrics.trim();
    try {
      const d = await ai('ambiance', { lyrics: song.lyrics });
      setAmbRead(d.reading || '');
      const opts = (d.options || []).filter((o) => M.STYLES[o.style]).map((o) => ({ style: o.style, mode: o.mode === 'min' ? 'min' : 'maj', key: M.mod(Math.round(+o.key || 0), 12), bpm: clamp(Math.round(+o.bpm || 100), 60, 180), why: o.why || '', ai: true }));
      if (opts.length) { setAmb(opts); setAmbSel(-1); }
    } catch (e) { say(e.message); }
    setBusy('');
  };
  // Dépôt de compositions : photos de manuscrits, PDF, Word, texte
  const importCompositions = async (files) => {
    files = [...files]; if (!files.length) return;
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    const pdf = files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    const docx = files.find((f) => /\.docx$/i.test(f.name));
    const txt = files.find((f) => f.type.startsWith('text/') || /\.(txt|md|rtf)$/i.test(f.name));
    setBusy('ocr');
    try {
      if (txt && !imgs.length && !pdf && !docx) {
        const t = (await txt.text()).replace(/\{\\[^}]*\}|\\[a-z]+\d* ?/g, '').trim();
        setOcr({ lyrics: t, title: txt.name.replace(/\.[^.]+$/, ''), note: '' });
      } else if (docx && !imgs.length && !pdf) {
        setOcr({ lyrics: await docxText(docx), title: docx.name.replace(/\.[^.]+$/, ''), note: '' });
      } else if (pdf) {
        if (pdf.size > 3_000_000) throw new Error(tx('PDF trop lourd (3 Mo max). Envoie plutôt des photos des pages.'));
        const d = await ai('ocr', { kind: 'pdf', pdf: await toB64(pdf), correct: ocrFix });
        setOcr({ lyrics: String(d.lyrics || '').replace(/\\n/g, '\n'), title: d.title || '', note: d.note || '' });
      } else {
        const images = [];
        for (const f of imgs.slice(0, 8)) images.push(await imageToJpeg(f, imgs.length > 3 ? 1500 : 1800));
        const d = await ai('ocr', { kind: 'images', images, correct: ocrFix });
        setOcr({ lyrics: String(d.lyrics || '').replace(/\\n/g, '\n'), title: d.title || '', note: d.note || '' });
      }
    } catch (e) { say(e.message === 'docx' ? tx('Fichier Word illisible') : e.message); }
    setProgress(''); setBusy('');
  };
  const useOcr = (append) => {
    const text = append && song.lyrics.trim() && !isDemo(song.lyrics) ? song.lyrics.trim() + '\n\n' + ocr.lyrics.trim() : ocr.lyrics.trim();
    if (ocr.title && (!append || !song.lyrics.trim())) up((s) => (s.title = ocr.title));
    analyze(text); setOcr(null); say(tx('Paroles importées'));
  };
  const aiPolish = async () => {
    setBusy('polish');
    try {
      const d = await ai('polish', { lyrics: song.lyrics });
      if (!d.lyrics || d.lyrics.length < 10) throw new Error(tx('Réponse vide'));
      setPolish({ lyrics: String(d.lyrics).replace(/\\n/g, '\n'), sugg: (d.suggestions || []).slice(0, 10).map((x) => ({ ...x, done: false })), fixes: d.fixes, note: d.note || '' });
    } catch (e) { say(e.message); }
    setBusy('');
  };
  const aiCompose = async (stay) => {
    setBusy('compose');
    try {
      const F = flat(song);
      const d = await ai('compose', {
        keyName: M.NOTE_FR[song.key], mode: song.mode, style: M.STYLES[song.style].n, bpm: song.bpm, chooseVibe: aiVibe,
        lyrics: song.lyrics,
        lines: F.map(({ b, l }, i) => ({ i, section: b.label, dyn: b.dyn || 'normal', text: l.text, bars: l.bars, syllables: l.syls.map((s) => s.t) })),
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
      setAiNote(d.note || ''); say(tx('Sonyria a composé {n} ligne(s) à partir de tes paroles', { n })); snapshot(tx('Mélodie composée par Sonyria'));
      if (!stay) setTab('melodie');
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
    try { await e.openMic(song.echoCancel); setMicOn(true); return e; } catch (err) { say(tx('Micro refusé : autorise le micro pour Sonyria dans le navigateur.')); return null; }
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
    up((s) => s.tracks.push({ id: 't' + Date.now(), name: tx('Voix {n}', { n: s.tracks.length + 1 }), start: st, buffer, data: buffer.getChannelData(0), sr: buffer.sampleRate, vol: 0.9, pan: 0, fx: 'studio', ...fxParams('studio'), mute: false, solo: false }));
    say(tx('Prise enregistrée')); snapshot(tx('Nouvelle prise de voix'));
  };
  const setVideoBg = (file) => {
    if (videoBg.current) URL.revokeObjectURL(videoBg.current.src);
    const vd = document.createElement('video'); vd.src = URL.createObjectURL(file); vd.muted = true; vd.playsInline = true; vd.loop = true; vd.preload = 'auto';
    vd.load(); videoBg.current = vd; bump();
  };
  const attachVideo = async (file, opts = {}) => {
    setVideoBg(file);
    up((s) => { s.clip = { ...s.clip, vMode: 'plein', vLoop: true, vOff: 0, mirror: false, vSound: 'app', ...opts }; });
    try { await DB.saveSong({ id: 'video:' + song.id, video: file, updated: Date.now() }); } catch (e) {}
  };
  const removeVideo = async () => { if (videoBg.current) { videoBg.current.pause?.(); videoBg.current = null; } up((s) => { s.clip = { ...s.clip, vSound: 'app' }; }); try { await DB.deleteSong('video:' + song.id); } catch (e) {} };
  const onFilmed = async (blob, o) => {
    setCam(false);
    await attachVideo(blob, { vLoop: false, mirror: o.mirror, cutout: !!o.cutout });
    say(tx('Ta vidéo est dans le clip — exporte-la avec tes paroles'));
    if (o.voice) {
      try {
        const e = await ensureAudio(); const buf = await e.ctx.decodeAudioData(await blob.arrayBuffer());
        up((s) => mkTrack(s, tx('Voix (vidéo)'), buf.getChannelData(0), buf.sampleRate, 0, false, 'studio'));
        song.tracks.forEach((t) => { if (!t.buffer && t.data) t.buffer = storeToBuffer(e.ctx, { sr: t.sr, ch: [t.data] }); });
      } catch (err) {}
    }
  };
  const addBacking = async (t, kind) => {
    if (!t.data) return;
    setBusy('back'); await new Promise((r) => setTimeout(r, 40));
    try {
      const e = await ensureAudio();
      const outs = makeBacking(t.data, t.sr, kind, song.key, song.mode), pans = BACKS[kind].pan;
      up((s) => outs.forEach((d, i) => {
        mkTrack(s, `${tx('Back')} · ${tx(BACKS[kind].n)}${outs.length > 1 ? ' ' + (i + 1) : ''}`, d, t.sr, t.start, false, 'stade');
        Object.assign(s.tracks[s.tracks.length - 1], { pan: pans[i] ?? 0, vol: kind === 'double' ? 0.45 : 0.38, echo: 0.28, fb: 0.35, reverb: 0.5, back: true });
      }));
      song.tracks.forEach((x) => { if (!x.buffer && x.data) x.buffer = storeToBuffer(e.ctx, { sr: x.sr, ch: [x.data] }); });
      say(tx('Back vocal ajouté — ajuste son volume et son écho')); snapshot(tx('Back vocals ajoutés'));
    } catch (err) { say(tx('Back vocal impossible')); }
    setBusy('');
  };
  const lastSnap = useRef(0);
  const snapshot = async (name, kind = 'auto') => {
    if (!song.lyrics?.trim()) return;
    try { await DB.saveVersion(song.id, structuredClone(serialize(song)), name, kind); lastSnap.current = Date.now(); if (kind === 'auto') DB.pruneVersions(song.id); } catch (e) {}
  };
  // l'original est gardé dès que les paroles sont là; ensuite une progression toutes les 3 minutes de travail
  useEffect(() => {
    if (!song.lyrics?.trim()) return;
    const h = setTimeout(async () => {
      if (!song.hasOriginal) { song.hasOriginal = true; await snapshot(tx('Original'), 'original'); return; }
      if (Date.now() - lastSnap.current > 180000) snapshot(tx('Progression automatique'));
    }, 4000);
    return () => clearTimeout(h);
  }, [v]); // eslint-disable-line
  const mkTrack = (s, name, data, sr, start, mute, fx = 'naturel') => s.tracks.push({ id: 't' + Date.now() + Math.random().toString(36).slice(2, 6), name, start, buffer: null, data, sr, vol: 0.9, pan: 0, fx, ...fxParams(fx), mute, solo: false });
  // Importe un MP4/audio et recrée la chanson : paroles, tempo, tonalité, accords, mélodie, karaoké
  const recreate = async (file) => {
    const e = await ensureAudio();
    setBusy('import');
    try {
      setProgress(tx('Lecture du fichier…'));
      const buf = await e.ctx.decodeAudioData(await file.arrayBuffer());
      if (file.type.startsWith('video/')) setVideoBg(file);
      setProgress(tx('Séparation voix / instrumental…')); await new Promise((r) => setTimeout(r, 30));
      const sep = separate(buf);
      setProgress(tx('Tempo, tonalité et accords…')); await new Promise((r) => setTimeout(r, 30));
      const A = analyzeMusic(sep.mono, sep.sr);
      const segs = await transcribe(sep.voice, sep.sr, setProgress);
      setProgress(tx('Reconstruction de la mélodie et du karaoké…')); await new Promise((r) => setTimeout(r, 30));
      const fresh = newSong('');
      fresh.title = file.name.replace(/\.[^.]+$/, '').slice(0, 40);
      buildSong(fresh, A, segs, sep.voice, sep.sr);
      fresh.style = A.bpm < 86 ? 'ballade' : A.bpm > 125 ? 'edm' : 'pop';
      fresh.drums = M.drumPreset(M.STYLES[fresh.style].drums); fresh.swing = 0;
      mkTrack(fresh, tx('Original'), sep.mono, sep.sr, -A.phase, false);
      if (sep.inst) mkTrack(fresh, tx('Instrumental (voix retirée)'), sep.inst, sep.sr, -A.phase, true);
      if (sep.stereo) mkTrack(fresh, tx('Voix (approx.)'), sep.voice, sep.sr, -A.phase, true, 'studio');
      fresh.mix.mute = { lead: false, harm: false, chords: true, bass: true, drums: true };
      load(fresh);
      setTab('melodie');
      say(tx('Chanson recréée : {b} BPM, {k}, {n} phrases. Vérifie les paroles !', { b: A.bpm, k: `${(getLang() === 'en' ? M.NOTE_EN : M.NOTE_FR)[A.key]} ${tx(A.mode === 'maj' ? 'majeur' : 'mineur')}`, n: segs.length }));
    } catch (err) { say(tx('Import impossible : ') + (err.message || err)); }
    setProgress(''); setBusy('');
  };
  // ---------- fredonner / chanter : Sonyria transcrit et ajoute la musique ----------
  const hasLyrics = () => song.blocks.some((b) => b.lines.some((l) => l.syls.length && !/^(la ?)+$/i.test(l.text.trim())));
  const startHum = async () => {
    const e = await openMic(); if (!e) return;
    const T1 = e.startClick(song.bpm, 1, hum.metro);
    e.startRecording();
    humInfo.current = { T1, bpm: song.bpm, metro: hum.metro, mode: hum.mode };
    setHumRec(true);
  };
  const stopHum = async () => {
    const e = eng.current; if (!e) return;
    const r = e.stopRecording(); e.stopClick(); setHumRec(false);
    if (!r) return;
    const info = humInfo.current;
    setBusy('hum');
    try {
      const data = r.buffer.getChannelData(0), sr = r.buffer.sampleRate;
      const lat = (song.latency ?? Math.round(e.latency() * 1000)) / 1000;
      setProgress(tx('Analyse de ta voix : hauteur des notes…')); await new Promise((q) => setTimeout(q, 30));
      let bpm = info.bpm;
      if (!info.metro) bpm = M.detectBpm(data, sr) || info.bpm;
      const sing = info.mode === 'sing';
      let notes = H.framesToNotes(H.pitchTrack(data, sr), sing ? M.detectOnsets(data, sr).onsets.map((o) => o.t) : []);
      notes = H.cleanNotes(notes, { merge: !sing });
      if (info.metro) notes = notes.filter((n) => n.t + n.dur > info.T1 + lat - r.ctxStart); // ignorer le décompte
      if (notes.length < 2) throw new Error(tx('Aucune note détectée : rapproche-toi du micro et réessaie.'));
      const barDur = 240 / bpm;
      const t0 = info.metro ? info.T1 + lat - r.ctxStart : notes[0].t;
      const K = hum.keepKey ? { key: song.key, mode: song.mode } : H.keyFromNotes(notes);
      let text = null;
      if (sing && !hasLyrics()) {
        const segs = await transcribe(data, sr, setProgress);
        if (segs.length) text = segsToLyrics(segs, barDur);
      }
      setProgress(tx('Harmonisation et arrangement…')); await new Promise((q) => setTimeout(q, 30));
      const useLyrics = sing ? (text || hasLyrics()) : hum.onLyrics && hasLyrics();
      up((s) => {
        if (text) { s.lyrics = text; s.blocks = M.parseLyrics(text); }
        H.buildFromNotes(s, notes, { bpm, t0, introBars: 1, key: K.key, mode: K.mode, lyricsBlocks: useLyrics ? s.blocks : null });
        const start = barDur - t0;
        const name = sing ? tx('Voix chantée') : tx('Fredonnement');
        s.tracks.push({ id: 't' + Date.now(), name, start, buffer: r.buffer, data, sr, vol: 0.9, pan: 0, fx: sing ? 'studio' : 'naturel', ...fxParams(sing ? 'studio' : 'naturel'), mute: !sing, solo: false });
        if (sing) { s.mix.mute = { ...s.mix.mute, lead: true, harm: false, chords: false, bass: false, drums: false }; }
        else { s.leadSound = hum.instr; ensureLayers(s).forEach((l) => { if (l.role === 'melody') l.inst = hum.instr; }); s.mix.mute = { ...s.mix.mute, lead: false, chords: false, bass: false, drums: false }; }
      });
      say(sing ? tx('Ta voix est arrangée : accords, basse et batterie ajoutés') : tx('Mélodie reproduite : {n} notes en {k}', { n: notes.length, k: `${(getLang() === 'en' ? M.NOTE_EN : M.NOTE_FR)[K.key]} ${tx(K.mode === 'maj' ? 'majeur' : 'mineur')}` }));
      setTab('melodie');
      setTimeout(() => play({ from: 0 }), 300);
    } catch (err) { say(err.message || String(err)); }
    setProgress(''); setBusy('');
  };
  const detectTempo = (t) => { const b = M.detectBpm(t.data, t.sr); if (b) { up((s) => (s.bpm = b)); say(tx('Tempo détecté : {n} BPM', { n: b })); } else say(tx('Tempo introuvable')); };
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
    } catch (err) { say(tx('Fichier audio illisible')); }
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
    if (!scope.length) return say(tx('Aucune ligne des paroles ne tombe pendant cette prise.'));
    const need = scope.reduce((a, l) => a + l.syl.length, 0);
    let on = M.detectOnsets(data, sr).onsets.map((o) => ({ t: o.t + tStart, s: o.s }));
    if (on.length < Math.min(3, need)) return say(tx('Voix trop faible : rapproche-toi du micro et réessaie.'));
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
    say(tx('Karaoké calé sur ta voix : {n} syllabes sur {l} ligne(s)', { n: need, l: scope.length }));
  };

  // ---------- export ----------
  const slug = () => (song.title || 'sonyria').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sonyria';
  const saveBlob = (blob, name) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  };
  const exportWav = async () => {
    setExporting('wav');
    try { const e = await ensureAudio(); await prepareSamples(e.ctx, song); const buf = await renderOffline(song); const wb = wavBlob(buf); saveBlob(wb, slug() + '.wav'); DB.saveMedia(song.id, 'wav', wb, slug() + '.wav').catch(() => {}); say(tx('WAV exporté — rangé dans ton album')); } catch (e) { say(tx('Export impossible : ') + e.message); }
    setExporting('');
  };
  const exportLive = async (video) => {
    const e = await ensureAudio();
    const mime = pickMime(video);
    if (mime === null) return say(tx('Ton navigateur ne permet pas l’export vidéo. Essaie Chrome.'));
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
      const ob = new Blob(chunks, { type }), on = `${slug()}${video ? '-clip' : ''}.${ext}`; saveBlob(ob, on); DB.saveMedia(song.id, video ? 'clip' : 'audio', ob, on).catch(() => {});
      setExporting(''); say(ext === 'webm' ? tx('Exporté en WebM (ton navigateur ne gère pas le MP4)') : tx('Exporté en {f} — rangé dans ton album', { f: ext.toUpperCase() }));
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
  // album complet en MP4 : toutes les chansons à la suite, pochette, titre de la piste et progression
  const exportAlbum = async (albumName) => {
    const e = await ensureAudio();
    const mime = pickMime(true);
    if (mime === null) return say(tx('Ton navigateur ne permet pas l’export vidéo. Essaie Chrome.'));
    const DEF = tx('Mon album'), key = albumName === DEF ? '' : albumName;
    const items = (await DB.listSongs()).filter((x) => (x.album || '') === key).sort((a, b) => a.updated - b.updated);
    if (!items.length) return say(tx('Cet album est vide pour l’instant.'));
    setTab('clip'); setExporting('album');
    const parts = [];
    for (let i = 0; i < items.length; i++) {
      setProgress(tx('Préparation de la chanson {i} sur {n}…', { i: i + 1, n: items.length }));
      const r = await DB.getSong(items[i].id); if (!r) continue;
      const d = newSong(''); const s = { ...d, ...r.song, mix: { ...d.mix, ...r.song.mix } }; ensureLayers(s);
      (s.tracks || []).forEach((t) => { if (t.data) t.buffer = storeToBuffer(e.ctx, { sr: t.sr, ch: [t.data] }); });
      try { await prepareSamples(e.ctx, s); parts.push({ title: s.title, buf: await renderOffline(s) }); } catch (err) {}
    }
    setProgress('');
    if (!parts.length) { setExporting(''); return; }
    const [W, H] = FORMATS[song.clip.format] || [1080, 1920];
    const cv = clipRef.current; cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const cimg = await new Promise((res) => { const u = loadCover(key); if (!u) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = u; });
    const total = parts.reduce((a, p) => a + p.buf.duration + 1, 0);
    const as = e.streamDest().stream;
    const stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...as.getAudioTracks()]);
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 192_000 } : {});
    const chunks = []; mr.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    const t0 = e.ctx.currentTime + 0.3; let at = t0; const srcs = [];
    parts.forEach((p) => { const sN = e.ctx.createBufferSource(); sN.buffer = p.buf; sN.connect(e.out); sN.start(at); srcs.push(sN); p.at = at - t0; at += p.buf.duration + 1; });
    let raf, done = false;
    const draw = () => {
      const el = e.ctx.currentTime - t0; let i = parts.findIndex((p) => el < p.at + p.buf.duration + 1); if (i < 0) i = parts.length - 1;
      g.fillStyle = '#05040b'; g.fillRect(0, 0, W, H);
      if (cimg) { g.save(); g.filter = 'blur(40px) brightness(.45)'; const sc = Math.max(W, H) / cimg.width * 1.2; g.drawImage(cimg, (W - cimg.width * sc) / 2, (H - cimg.height * sc) / 2, cimg.width * sc, cimg.height * sc); g.restore(); }
      const S = Math.min(W, H) * 0.62, x = (W - S) / 2, y = H * 0.42 - S / 2;
      if (cimg) { g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 50; g.drawImage(cimg, x, y, S, S); g.restore(); }
      else { const gr = g.createLinearGradient(x, y, x + S, y + S); gr.addColorStop(0, '#22d3ee'); gr.addColorStop(0.5, '#a855f7'); gr.addColorStop(1, '#fb923c'); g.fillStyle = gr; g.fillRect(x, y, S, S); }
      g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = `800 ${Math.round(Math.min(W, H) * 0.06)}px Sora, sans-serif`;
      g.fillText(parts[i].title || '', W / 2, y + S + Math.min(W, H) * 0.12);
      g.font = `500 ${Math.round(Math.min(W, H) * 0.032)}px Sora, sans-serif`; g.fillStyle = 'rgba(255,255,255,.7)';
      g.fillText(`${albumName} · ${tx('Piste {i} sur {n}', { i: i + 1, n: parts.length })}${me?.artist || me?.name ? ' · ' + (me.artist || me.name) : ''}`, W / 2, y + S + Math.min(W, H) * 0.18);
      const p = parts[i], pr = Math.max(0, Math.min(1, (el - p.at) / p.buf.duration)), bw = W * 0.7, by = y + S + Math.min(W, H) * 0.24;
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect((W - bw) / 2, by, bw, 8); const gr2 = g.createLinearGradient((W - bw) / 2, 0, (W + bw) / 2, 0); gr2.addColorStop(0, '#22d3ee'); gr2.addColorStop(1, '#a855f7'); g.fillStyle = gr2; g.fillRect((W - bw) / 2, by, bw * pr, 8);
      g.font = `600 ${Math.round(W * 0.022)}px Sora, sans-serif`; g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,.35)'; g.fillText('Sonyria', W - 20, H - 20);
      if (!done) raf = requestAnimationFrame(draw);
    };
    const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); srcs.forEach((x) => { try { x.stop(); } catch (er) {} }); if (mr.state !== 'inactive') mr.stop(); };
    mr.onstop = () => {
      const type = mr.mimeType || mime || 'video/webm', ext = type.includes('mp4') ? 'mp4' : 'webm';
      const ob = new Blob(chunks, { type }), on = `${(albumName || 'album').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '-')}-album.${ext}`;
      saveBlob(ob, on); DB.saveMedia('album:' + key, 'clip', ob, on).catch(() => {});
      setExporting(''); say(tx('Album exporté — rangé dans Mon album'));
    };
    mr.start(500); draw();
    exportStop.current = finish;
    setTimeout(finish, (total + 0.6) * 1000);
  };

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
    renderer.current.cover = coverImg.current;
    if (song.clip.cutout) loadCutout().catch(() => {});
    let raf; const freq = new Uint8Array(512);
    const f = () => {
      const e = eng.current; const st = e?.songTime();
      if (e) e.analyser.getByteFrequencyData(freq);
      const vd = videoBg.current; if (vd) { if (e?.playing && vd.paused) vd.play().catch(() => {}); if (!e?.playing && !vd.paused) vd.pause(); }
      const vs = song.clip.vSound || 'app';
      if (vd && e) {
        if (vs !== 'app' && !vd._g) { try { vd._src = e.ctx.createMediaElementSource(vd); vd._g = e.ctx.createGain(); vd._src.connect(vd._g).connect(e.out); vd.muted = false; } catch (err) {} }
        if (vd._g) vd._g.gain.value = vs === 'app' ? 0 : 1;
      }
      const mOff = !!vd && vs === 'video'; if (e && e.musicOff !== mOff) { e.musicOff = mOff; e.applyLayers(song); }
      renderer.current.draw(st && !st.countIn ? st.t : (tl.lines[0]?.syl[0]?.g || 0) * s16(song.bpm) + 0.8, tl, song, e?.playing ? freq : null);
      raf = requestAnimationFrame(f);
    };
    f();
    return () => { cancelAnimationFrame(raf); const e = eng.current; if (e?.musicOff) { e.musicOff = false; e.applyLayers(S.current); } };
  }, [tab, exporting, v]); // eslint-disable-line
  const aiClip = async () => {
    setBusy('clip');
    try {
      const d = await ai('clip', { title: song.title, artist: song.artist, style: M.STYLES[song.style].n, bpm: song.bpm, sections: [...new Set(song.blocks.map((b) => b.label))], lyrics: song.lyrics });
      const okPal = (p) => Array.isArray(p) && p.length === 3 && p.every((c) => /^#[0-9a-f]{6}$/i.test(c));
      const sc = { title: d.title || song.title, theme: THEMES[d.theme] ? d.theme : 'neon', palette: okPal(d.palette) ? d.palette : null, textStyle: d.textStyle === 'bounce' ? 'bounce' : 'karaoke', keywords: (d.keywords || []).slice(0, 6).map(String), sections: {} };
      Object.entries(d.sections || {}).forEach(([k, x]) => { sc.sections[k] = { theme: THEMES[x.theme] ? x.theme : undefined, palette: okPal(x.palette) ? x.palette : undefined, intensity: clamp(+x.intensity || 0.7, 0.2, 1), keywords: (x.keywords || []).slice(0, 4).map(String) }; });
      up((s) => { s.clip.scenario = sc; });
      setAiNote(d.note || ''); say(tx('Scénario du clip prêt'));
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
    try { await navigator.clipboard.writeText(`${song.title} — ${tx(M.STYLES[song.style].n)}, ${(song.fr ? M.NOTE_FR : M.NOTE_EN)[song.key]} ${tx(song.mode === 'maj' ? 'majeur' : 'mineur')}, ${song.bpm} BPM\n\n${txt}`); say(tx('Grille d’accords copiée')); } catch (e) { say(tx('Copie impossible')); }
  };
  const keyLabel = `${(song.fr ? M.NOTE_FR : M.NOTE_EN)[song.key]} ${tx(song.mode === 'maj' ? 'maj' : 'min')}`;
  const nm = (m) => M.midiName(m, song.fr);
  const posLabel = clock && !clock.countIn ? `M${Math.floor(clock.step / 16) + 1}.${Math.floor((clock.step % 16) / 4) + 1}` : '—';

  const beatGridEl = (
          <><div className="grid">
            {M.drumRows(song.drums).map((r) => (
              <div key={r} style={{ display: 'contents' }}>
                <div className="lbl-w">
                  <button className="lbl" onClick={async () => { const e = await ensureAudio(); e.drum(r, e.ctx.currentTime); }}>{tx(M.DRUM_LABELS[r])}</button>
                  {M.EXTRA_DRUMS.includes(r) && <button className="lbl-x" onClick={() => up((s) => { delete s.drums[r]; })} aria-label={tx('Enlever ce son')}>×</button>}
                </div>
                {song.drums[r].map((on, i) => (
                  <button key={i} className={'cell' + (Math.floor(i / 4) % 2 ? ' g' : '') + (on ? ' on' : '') + (r === 'kick' ? ' k' : r === 'hat' || r === 'open' ? ' h' : '') + (playing && clock && clock.step >= 0 && clock.step % 16 === i ? ' now' : '')}
                    onClick={async () => { up((s) => { s.drums[r][i] = s.drums[r][i] ? 0 : 1; }); if (!song.drums[r][i]) return; const e = await ensureAudio(); e.drum(r, e.ctx.currentTime); }} />
                ))}
              </div>
            ))}
          </div>
          {M.EXTRA_DRUMS.some((r) => !song.drums[r]) && <div className="add-snd">
            <b><Ic n="plus" size={14} /> {tx('Ajouter un son')}</b>
            <div className="chips">{M.EXTRA_DRUMS.filter((r) => !song.drums[r]).map((r) => <button key={r} className="chip" onClick={async () => { up((s) => { s.drums[r] = Array(16).fill(0); }); const e = await ensureAudio(); e.drum(r, e.ctx.currentTime); }}>{tx(M.DRUM_LABELS[r])}</button>)}</div>
          </div>}
          </>
  );
  const padsEl = (
          <div className="pads">
            {[['kick', 'Kick', 'drum'], ['snare', 'Snare', 'snare'], ['clap', 'Clap', 'clap'], ['hat', 'Hat', 'snap'], ['open', 'Open hat', 'cd'], ...M.EXTRA_DRUMS.filter((r) => song.drums[r]).map((r) => [r, tx(M.DRUM_LABELS[r]), 'drum'])].map(([k, n, ic]) => <button key={k} className="pad" onPointerDown={async () => { const e = await ensureAudio(); e.drum(k, e.ctx.currentTime); }}><Ico n={ic} s={34} /><span>{n}</span></button>)}
            {[1, 4, 5, 6, 2, 3, 7].map((d) => <button key={d} className="pad" style={{ color: '#bfdbfe' }} onPointerDown={async () => { const e = await ensureAudio(); e.previewChord(song, d); }}><Ico n="piano" s={28} /><span>{M.chordName(d, song.key, song.mode, song.fr)}</span></button>)}
          </div>
  );
  const presetsEl = (
          <div className="chips" style={{ marginBottom: 10 }}>
            {Object.keys(M.DRUM_PRESETS).map((k) => <button key={k} className="chip" onClick={() => up((s) => { const ex = {}; M.EXTRA_DRUMS.forEach((r) => { if (s.drums[r]) ex[r] = k === 'vide' ? Array(16).fill(0) : s.drums[r]; }); s.drums = { ...M.drumPreset(k), ...ex }; })}>{k === 'vide' ? <><Ic n="eraser" size={14} /> {tx("Vide")}</> : <><Ico n={M.STYLES[k]?.e} s={20} /> {tx(M.STYLES[k]?.n || k)}</>}</button>)}
          </div>
  );
  const openFs = (k) => {
    setFs(k);
    try { const d = document.documentElement; if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().then(() => { if (k !== 'arr') screen.orientation?.lock?.('landscape').catch(() => {}); }).catch(() => {}); } catch (e) {}
  };
  const closeFs = () => { setFs(null); try { screen.orientation?.unlock?.(); if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {} };
  const toggleFold = (ev) => {
    const h = ev.target.closest('.card > h3'); if (!h || h.closest('.fs, .sheet, .kara, .cam')) return;
    if (ev.target.closest('button, input, select, label, a, textarea') && !ev.target.closest('.fold-btn')) return;
    const k = h.dataset.fk; if (!k) return;
    const nx = { ...folds, [k]: !h.parentElement.classList.contains('folded') };
    setFolds(nx); try { localStorage.setItem('sonyria-folds', JSON.stringify(nx)); } catch (e) {}
  };
  const TABS = [['paroles', 'new', 'Paroles'], ['melodie', 'note', 'Mélodie'], ['beat', 'drumkit', 'Beat'], ['studio', 'studio-mic', 'Studio'], ['table', 'sliders', 'Table'], ['clip', 'spectrum', 'Clip']];

  return (
    <>
      <IconDefs />
      {splash && <Splash onDone={() => setSplash(false)} />}
      {!splash && me && !me.onboarded && <Onboarding me={me} setMe={setMe} lang={lang} setLang={setLang} install={install} onInstall={doInstall}
        onFinish={(choice) => {
          setMe({ ...me, onboarded: true }); saveGuide({ on: true, step: 0 });
          if (choice === 'paroles') { const n = freshFrom(S.current, !!S.current?.lyrics?.trim()); n.artist = me.artist || me.name || ''; load(n); setTab('paroles'); }
          else if (choice === 'import') { const n = newSong(''); n.artist = me.artist || me.name || ''; load(n); setTab('studio'); }
          else { const n = newSong(getLang() === 'en' ? DEMO_EN : DEMO); n.artist = me.artist || me.name || ''; load(n); setTab('melodie'); }
        }} />}
      <div className={'topbar' + (compact ? ' compact' : '')}>
        <div className="bar">
          <img className="tlogo" src="/logo.png" alt="Sonyria" />
          <div className="tbrand">
            <span className="tapp">SONYRIA</span>
            <span className="ttitle">{song.title || tx('Ma chanson')}</span>
            <small className="tsub">{me?.name ? tx('Salut, {n}', { n: me.name }) : tx('Studio de chansons')}{song.artist ? ` · ${song.artist}` : ''}</small>
          </div>
          <div className="tacts">
            <button className="tib" onClick={() => setSheet({ type: 'songs' })} title={tx('Mon album')} aria-label={tx('Mon album')}><Ico n="folder" s={26} /></button>
            <button className="tib help" onClick={() => (guide.on ? saveGuide({ ...guide, on: false }) : goStep(GUIDE.findIndex((x) => x.tab === tab)))} title={tx('Guide des premiers pas')} aria-label={tx('Guide des premiers pas')}>?</button>
            <button className="tib" onClick={() => setSheet({ type: 'settings' })} title={tx('Réglages')} aria-label={tx('Réglages')}><Ico n="settings" s={26} /></button>
            {me?.av && <button className="tav" onClick={() => setSheet({ type: 'profile' })} title={tx('Mon profil')} aria-label={tx('Mon profil')}><img src={avSrc(me.av)} alt="" /></button>}
            <div className="tlang" role="group" aria-label="Langue / Language">
              <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')} aria-pressed={lang === 'fr'}>FR</button>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>EN</button>
            </div>
          </div>
        </div>
        <nav className="tabs">
          {TABS.map(([k, e, n]) => <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}><span><Ico n={e} s={28} dim={tab !== k} /></span>{tx(n)}</button>)}
        </nav>
      </div>
      <div className="app" onClick={toggleFold}>

      {guide.on && me?.onboarded && (() => { const st = GUIDE[guide.step]?.tab === tab ? guide.step : Math.max(0, GUIDE.findIndex((x) => x.tab === tab)); return GUIDE[st].anchor === 'g-amb' ? null : <GuideCard step={st} go={goStep} hide={() => saveGuide({ ...guide, on: false })} />; })()}
      {/* ================= PAROLES ================= */}
      {tab === 'paroles' && <>
        <div className="card" id="g-lyrics">
          <div className="row nw">
            <input type="text" value={song.title} onChange={(e) => up((s) => (s.title = e.target.value))} placeholder={tx("Titre de la chanson")} />
            <input type="text" value={song.artist} onChange={(e) => up((s) => (s.artist = e.target.value))} placeholder={tx("Artiste")} style={{ maxWidth: 160 }} />
          </div>
          <Sub k="lyr-import" t={tx('Importer mes compositions (photo, PDF, Word)')} open={!song.lyrics?.trim()}>
          <div className="dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); importCompositions(e.dataTransfer.files); }}>
            <div className="dz-t"><Ico n="upload" s={30} /><div><b>{tx('Dépose tes compositions')}</b><small>{tx('Photo d’un cahier ou d’une feuille manuscrite, PDF, Word ou texte')}</small></div></div>
            {busy === 'ocr' ? <div className="row"><Magic kind="ocr" /></div> : <div className="row">
              <label className="btn sm pri"><Ic n="camera" /> {tx('Prendre en photo')}<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { importCompositions(e.target.files); e.target.value = ''; }} /></label>
              <label className="btn sm"><Ic n="file" /> {tx('Importer des fichiers')}<input type="file" accept="image/*,.pdf,.txt,.md,.docx,text/plain,application/pdf" multiple hidden onChange={(e) => { importCompositions(e.target.files); e.target.value = ''; }} /></label>
            </div>}
            <label className="row" style={{ fontSize: 12.5, marginTop: 8 }}><input type="checkbox" checked={ocrFix} onChange={(e) => setOcrFix(e.target.checked)} /> {tx('Corriger le français en même temps (manuscrits et PDF)')}</label>
            <div className="hint">{tx('Plusieurs pages ? Sélectionne toutes les photos d’un coup, dans l’ordre.')}</div>
          </div>
          </Sub>
          {ocr && <div className="card" style={{ borderColor: 'var(--cyan)' }}>
            <h3><Ico n="new" s={26} /> {tx('Texte importé')}</h3>
            {ocr.note && <div className="hint">{ocr.note}</div>}
            {ocr.title && <div className="hint">{tx('Titre')} : <b style={{ color: 'var(--txt)' }}>{ocr.title}</b></div>}
            <textarea value={ocr.lyrics} onChange={(e) => setOcr({ ...ocr, lyrics: e.target.value })} style={{ minHeight: 200 }} />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn pri" onClick={() => useOcr(false)}><Ic n="check" /> {tx('Remplacer mes paroles')}</button>
              <button className="btn" onClick={() => useOcr(true)}><Ic n="plus" /> {tx('Ajouter à la suite')}</button>
              <button className="btn" onClick={() => setOcr(null)}>{tx('Annuler')}</button>
            </div>
          </div>}
          <label className="f">{tx("Tes paroles")}</label>
          <textarea value={song.lyrics} onChange={(e) => onLyrics(e.target.value)} placeholder={tx("Colle ton texte ici…")} />
          <Sub k="lyr-tips" t={tx('Astuces : sections et nuances')}>
          <div className="hint">{tx("Astuce : écris")} <b>{tx("[Refrain]")}</b>, <b>{tx("[Couplet]")}</b> {tx("ou")} <b>{tx("[Pont]")}</b> {tx("au-dessus d’un bloc. Laisse une ligne vide entre les blocs. Ajoute une nuance dans l’en-tête :")} <b>{tx("[Pont (tout doucement)]")}</b>, <b>{tx("[Refrain (plus puissant)]")}</b>, <b>{tx("(très émouvant)")}</b>{tx(". Pour forcer un découpage de syllabe :")} <b>{tx("chan/tent")}</b>.</div>
          </Sub>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm ai" disabled={!!busy || aiStatus?.ai === false} onClick={aiPolish}>{busy === 'polish' ? <Magic kind="polish" /> : <><Ic n="wand" /> {tx("Corriger avec Sonyria")}</>}</button>
            <button className="btn sm" onClick={() => { if (!confirm(tx('Effacer les paroles et tout ce qui a été composé pour cette chanson ?'))) return; const n = freshFrom(song, true); n.id = song.id; load(n); say(tx('Page blanche — on garde ton style')); }}><Ico n="trash" s={20} /> {tx('Recommencer')}</button>
            <button className="btn sm" onClick={() => setSheet({ type: 'versions', id: song.id })}><Ico n="folder" s={18} /> {tx('Versions')}</button>
            {song.lyricsOriginal && <button className="btn sm" onClick={() => { const o = song.lyricsOriginal; up((s) => (s.lyricsOriginal = null)); analyze(o); }}><Ic n="undo" /> {tx("Revenir à mon original")}</button>}
          </div>
          {polish && <div className="card" style={{ borderColor: 'var(--orange)' }}>
            <h3><Ico n="ai" s={28} /> {tx("Version corrigée")}</h3>
            {polish.note && <div className="hint">{polish.note}</div>}
            <div className="hint" style={{ marginBottom: 6 }}>{tx('Tes mots sont gardés : seules l’orthographe, les accords et la ponctuation sont corrigés.')}</div>
            <textarea value={polish.lyrics} onChange={(e) => setPolish({ ...polish, lyrics: e.target.value })} style={{ minHeight: 180 }} />
            {polish.sugg?.length > 0 && <div className="sugg">
              <label className="f">{tx('Suggestions de tournures (à toi de choisir)')}</label>
              {polish.sugg.map((x, i) => (
                <div key={i} className={'sg' + (x.done ? ' done' : '')}>
                  <div className="sg-t"><s>{x.avant}</s><br /><b>→ {x.apres}</b><small>{x.pourquoi}</small></div>
                  {x.done ? <button className="btn sm" onClick={() => setPolish({ ...polish, lyrics: polish.lyrics.replace(x.apres, x.avant), sugg: polish.sugg.map((y, j) => (j === i ? { ...y, done: false } : y)) })}><Ic n="undo" /></button>
                    : <button className="btn sm pri" disabled={!polish.lyrics.includes(x.avant)} onClick={() => setPolish({ ...polish, lyrics: polish.lyrics.replace(x.avant, x.apres), sugg: polish.sugg.map((y, j) => (j === i ? { ...y, done: true } : y)) })}><Ic n="check" /> {tx('Appliquer')}</button>}
                </div>))}
            </div>}
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn pri" onClick={() => { const orig = song.lyricsOriginal || song.lyrics; up((s) => (s.lyricsOriginal = orig)); analyze(polish.lyrics); setPolish(null); say(tx('Nouvelle version appliquée — ton original est gardé')); }}><Ic n="check" /> {tx("Utiliser cette version")}</button>
              <button className="btn" onClick={() => setPolish(null)}>{tx("Garder la mienne")}</button>
            </div>
          </div>}
          <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setPrintOpen(true)}><Ico n="treble" s={18} /> {tx('Imprimer paroles et partition')}</button>
          <div className="hint" style={{ marginTop: 6 }}>{tx('{l} lignes · {s} syllabes · {b} sections', { l: flat(song).length, s: flat(song).reduce((a, x) => a + x.l.syls.length, 0), b: song.blocks.length })} · {tx('durée')} ≈ {Math.floor(tl.steps * s16(song.bpm) / 60)} min {String(Math.round(tl.steps * s16(song.bpm) % 60)).padStart(2, '0')} s</div>
        </div>

        {!song.lyrics?.trim() ? <div className="card steps">
          <h3><Ic n="music" /> {tx('Pour commencer')}</h3>
          <div className="step on"><span className="sn">1</span><div><b>{tx('Mets tes paroles')}</b><small>{tx('Colle ton texte ci-dessus, prends une photo de ta feuille ou importe un fichier. Sonyria garde tes mots tels quels.')}</small></div></div>
          <div className="step"><span className="sn">2</span><div><b>{tx('Choisis ton style')}</b><small>{tx('Les styles et ambiances apparaissent dès que tes paroles sont là.')}</small></div></div>
        </div> : <>
        <div className="card steps">
          <h3><Ic n="music" /> {tx('Tes étapes')}</h3>
          {[
            ['paroles', tx('Tes paroles'), tx('C’est fait ✓ — tu peux les modifier en tout temps.'), true],
            ['style', tx('Choisis ton style'), tx('Touche une ambiance proposée ou un style juste en dessous : tu entends un extrait.'), !!song.styleChosen],
            ['melodie', tx('Écoute et ajuste la mélodie'), tx('Structure, instruments, notes et accords.'), !!song.visited?.melodie],
            ['beat', tx('Ajuste ton beat'), tx('Tempo, batterie et sons.'), !!song.visited?.beat],
            ['studio', tx('Enregistre ta voix'), tx('Chante avec le karaoké, ou filme-toi.'), !!song.visited?.studio],
            ['clip', tx('Fais ton vidéoclip'), tx('Thème, ta vidéo, export MP4.'), !!song.visited?.clip],
          ].map(([k, t, d, done], i, arr) => {
            const cur = !done && arr.slice(0, i).every((x) => x[3]);
            return <div key={k} className={'step' + (done ? ' done' : '') + (cur ? ' on' : '')}>
              <span className="sn">{done ? '✓' : i + 1}</span>
              <div className="grow"><b>{t}</b>{cur && <small>{d}</small>}</div>
              {k === 'style' ? <button className="btn sm pri" onClick={() => document.getElementById('g-amb')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{tx('Choisir')}</button>
                : k !== 'paroles' && <button className={'btn sm' + (cur ? ' pri' : '')} onClick={() => { setTab(k); window.scrollTo({ top: 0 }); }}>{tx('Aller')} →</button>}
            </div>;
          })}
        </div>
        {guide.on && me?.onboarded && GUIDE[guide.step]?.anchor === 'g-amb' && <div id="g-amb-guide"><GuideCard step={guide.step} go={goStep} hide={() => saveGuide({ ...guide, on: false })} /></div>}
        <div className="card" id="g-amb">
          <h3><Ico n="headphones-wave" s={28} /> {tx("Ambiances proposées")}<span className="sp" />
            <button className="btn sm ai" disabled={!!busy} onClick={aiAmbiances}>{busy === 'amb' ? <Magic kind="amb" /> : <><Ic n="sparkles" /> {tx('Demander à Sonyria')}</>}</button>
          </h3>
          <div className="amb">
            {amb.map((a, i) => (
              <button key={i} className={'amb-c' + (ambSel === i ? ' on' : '')} onClick={() => chooseAmb(a, i)}>
                <div className="t"><Ico n={M.STYLES[a.style].e} s={26} /> {tx(M.STYLES[a.style].n)}</div>
                <div className="m">{a.bpm} BPM · {(getLang() === 'en' ? M.NOTE_EN : M.NOTE_FR)[a.key]} {tx(a.mode === 'maj' ? 'majeur' : 'mineur')}</div>
                <div className="w">{a.ai ? a.why : a.why.split(' · ').map((x, i) => (i ? tx(' · ' + x) : tx(x))).join('')}</div>
              </button>
            ))}
          </div>
          {ambRead && <div className="amb-read"><Ic n="sparkles" size={14} /> <span><b>{tx('Sonyria a lu tes paroles :')}</b> {ambRead}</span></div>}
          {busy === 'compose' && <div className="row" style={{ marginTop: 8 }}><Magic kind="compose" /></div>}
          <div className="hint" style={{ marginTop: 8 }}>{aiStatus?.ai ? tx("Ces ambiances viennent de tes paroles. Touche-en une : Sonyria compose la mélodie et les accords à partir de tes mots, puis tu entends un extrait.") : tx("Touche une ambiance : tout est réarrangé et tu entends un extrait.")}</div>
        </div>

        <div className="card">
          <h3><Ico n="note-purple" s={28} /> Style</h3>
          <div className="styles">
            {Object.entries(M.STYLES).map(([k, s]) => (
              <button key={k} className={'style-c' + (song.style === k ? ' on' : '')} onClick={() => up((x) => { x.styleChosen = true; applyStyle(x, k); M.composeSong(x, x.variant); })}><b><Ico n={s.e} s={40} /></b>{tx(s.n)}</button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <div className="grow"><label className="f">{tx("Tonalité")}</label>
              <select value={song.key} onChange={(e) => up((s) => (s.key = +e.target.value))}>{M.NOTE_FR.map((n, i) => <option key={i} value={i}>{n} / {M.NOTE_EN[i]}</option>)}</select></div>
            <div className="grow"><label className="f">Mode</label>
              <div className="chips">{[['maj', 'Majeur', 'sun'], ['min', 'Mineur', 'moon']].map(([k, n, ic]) => <button key={k} className={'chip' + (song.mode === k ? ' on' : '')} onClick={() => up((s) => { s.mode = k; M.composeSong(s, s.variant); })}><Ic n={ic} size={14} /> {tx(n)}</button>)}</div></div>
          </div>
          <label className="f">{tx('Tempo : {n} BPM', { n: song.bpm })}</label>
          <div className="row nw"><input type="range" min="55" max="190" value={song.bpm} onChange={(e) => up((s) => (s.bpm = +e.target.value))} /><button className="btn sm" onClick={tapTempo}><Ic n="tap" /> Tap</button></div>
          <div className="chips" style={{ marginTop: 6 }}>{[[0.8, 'Plus lent'], [1, 'Original'], [1.15, 'Plus rapide']].map(([f, n]) => <button key={n} className="chip" onClick={() => up((s) => (s.bpm = clamp(Math.round(M.STYLES[s.style].bpm * f), 55, 190)))}>{tx(n)}</button>)}</div>
        </div>

        <div className="card">
          <button className="btn pri wide" onClick={() => { setTab('melodie'); play({ from: 0 }); }}><Ic n="play" /> {tx("Écouter l’arrangement")}</button>
          <div style={{ height: 8 }} />
          <button className="btn ai wide" disabled={!!busy || aiStatus?.ai === false} onClick={() => aiCompose()}>{busy === 'compose' ? <Magic kind="compose" /> : <><Ic n="sparkles" /> {tx("Composer la mélodie avec Sonyria")}</>}</button>
          <label className="row" style={{ marginTop: 8, fontSize: 13 }}><input type="checkbox" checked={aiVibe} onChange={(e) => setAiVibe(e.target.checked)} /> {tx("Laisser Sonyria choisir aussi le style, la tonalité et le tempo")}</label>
          {aiStatus?.ai === false && <div className="hint">{tx("IA non configurée : ajoute ANTHROPIC_API_KEY dans Vercel.")}</div>}
        </div>
        </>}
      </>}

      {/* ================= MÉLODIE ================= */}
      {tab === 'melodie' && <>
        <div className="card">
          <h3><Ico n="treble" s={28} /> {tx("Propositions de mélodie")}<span className="sp" /><button className="btn sm" onClick={copySheet}><Ic n="copy" /> {tx("Grille")}</button><button className="btn sm pri" onClick={() => setPrintOpen(true)}><Ico n="treble" s={18} /> {tx('Partition')}</button></h3>
          <div className="chips">
            {[0, 1, 2, 3].map((n) => <button key={n} className={'chip' + (song.variant === n ? ' on' : '')} onClick={() => { up((s) => { s.variant = n; M.composeSong(s, n); }); play({ from: 0 }); }}>{tx('Proposition {n}', { n: 'ABCD'[n] })}</button>)}
            <button className="chip" onClick={() => { const n = 4 + Math.floor(Math.random() * 1000); up((s) => { s.variant = n; M.composeSong(s, n); }); play({ from: 0 }); }}><Ic n="dice" /> {tx("Autre")}</button>
          </div>
          {aiNote && <div className="hint" style={{ marginTop: 8 }}><Ic n="sparkles" size={13} /> {aiNote}</div>}
          <div className="chips" style={{ marginTop: 8 }}>
            <button className={'chip' + (!song.fr ? ' on' : '')} onClick={() => up((s) => (s.fr = false))}>C D E</button>
            <button className={'chip' + (song.fr ? ' on' : '')} onClick={() => up((s) => (s.fr = true))}>{tx("Do Ré Mi")}</button>
          </div>
        </div>

        <Arrangement song={song} up={up} preload={async () => { const e = await ensureAudio(); prepareSamples(e.ctx, song); }} onFull={() => openFs('arr')} />
        <Structure song={song} up={up} tl={tl} play={play} clock={clock} />
        {song.blocks.map((b, bi) => (
          <div key={bi}>
            <div className="sec-h">
              <button className={'sec-tag ' + b.type} onClick={() => up((s) => { const o = ['verse', 'chorus', 'bridge']; s.blocks[bi].type = o[(o.indexOf(b.type) + 1) % 3]; M.composeSong(s, s.variant); })}>{(() => { const lab = M.localLabel(b.label); const ty = tx(TYPES[b.type]); return lab.toLowerCase().startsWith(ty.toLowerCase()) ? lab : `${lab} · ${ty}`; })()}</button>
              <button className="chip" style={{ padding: '4px 9px', fontSize: 11 }} onClick={() => up((s) => { const o = ['soft', 'emo', 'normal', 'loud']; s.blocks[bi].dyn = o[(o.indexOf(b.dyn || 'normal') + 1) % 4]; })}><Ic size={12} n={{ soft: 'feather', emo: 'drop', normal: 'music', loud: 'flame' }[b.dyn || 'normal']} /> {tx(M.DYN_LABEL[b.dyn || 'normal'])}</button>
              <span className="sp" style={{ flex: 1 }} />
              <button className="mini" onClick={() => { const L = tl.lines.filter((l) => l.bi === bi && !l.occ); if (L.length) play({ from: L[0].b0, to: L[L.length - 1].b0 + L[L.length - 1].bars }); }}><Ic n="play" size={15} fill="currentColor" /></button>
            </div>
            {b.lines.map((l, li) => {
              const L = tl.lines.find((x) => x.bi === bi && x.li === li);
              const live = clock?.active && clock.active.bi === bi && clock.active.li === li;
              return (
                <div key={li} className={'line' + (live ? ' live' : '')}>
                  <div className="line-act">
                    <span className="txt">{l.text}</span>
                    {l.custom && <span className="badge">{tx("perso")}</span>}
                    <button className="mini" onClick={() => L && play({ from: L.b0, to: L.b0 + L.bars })}><Ic n="play" size={15} fill="currentColor" /></button>
                    <button className="mini" onClick={() => up((s) => { M.regenLine(s, bi, li, Math.floor(Math.random() * 1e6)); s.blocks[bi].lines[li].custom = true; })} aria-label={tx("Nouvelle mélodie")}><Ic n="dice" size={15} /></button>
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
          <h3><Ico n="metronome" s={28} /> {tx("Tempo")}</h3>
          <div className="bpm">
            <button className="tbtn" onClick={() => up((s) => (s.bpm = clamp(s.bpm - 1, 50, 200)))}>−</button>
            <div className="v">{song.bpm}<small> BPM</small></div>
            <button className="tbtn" onClick={() => up((s) => (s.bpm = clamp(s.bpm + 1, 50, 200)))}>+</button>
            <button className="btn sm" onClick={tapTempo}><Ic n="tap" /> {tx("Tap tempo")}</button>
          </div>
          <input type="range" min="50" max="200" value={song.bpm} onChange={(e) => up((s) => (s.bpm = +e.target.value))} />
          <div className="sl"><span>{tx("Swing / groove")}</span><input type="range" min="0" max="0.7" step="0.05" value={song.swing} onChange={(e) => up((s) => (s.swing = +e.target.value))} /><output>{Math.round(song.swing * 100)}%</output></div>
          <div className="chips" style={{ marginTop: 6 }}>
            {Object.entries(KITS).map(([k, n]) => <button key={k} className={'chip' + (kitFor(song) === k ? ' on' : '')} onClick={async () => { up((s) => { s.kit = k; ensureLayers(s).forEach((l) => { if (l.role === 'drums') l.inst = k; }); }); const e = await ensureAudio(); e.kit = k; e.drum('kick', e.ctx.currentTime + 0.05); e.drum('snare', e.ctx.currentTime + 0.35); }}><Ico n={k === 'acoustic' ? 'drumkit' : k === 'synth' ? 'synth' : 'pads'} s={18} /> {tx(n)}</button>)}
          </div>
          <div className="chips" style={{ marginTop: 6 }}>
            <button className={'chip' + (song.drumsOn ? ' on' : '')} onClick={() => up((s) => (s.drumsOn = !s.drumsOn))}><Ic n="drum" size={14} /> {tx("Batterie")}</button>
            <button className={'chip' + (song.metronome ? ' on' : '')} onClick={() => up((s) => (s.metronome = !s.metronome))}><Ic n="bell" size={14} /> {tx("Métronome")}</button>
            <button className={'chip' + (song.intro ? ' on' : '')} onClick={() => up((s) => { s.intro = !s.intro; s.introBars = null; s.introChords = null; })}><Ic n="clap" size={14} /> {tx("Intro + fin")}</button>
          </div>
        </div>

        <div className="card">
          <h3><Ico n="pads" s={28} /> Beat table<span className="sp" /><button className="btn sm" onClick={() => play({ from: 0, to: Math.min(tl.bars.length, 4), loop: true })}><Ic n="loop" /> {tx("Boucle")}</button><button className="btn sm pri" onClick={() => openFs('beat')}><Ic n="max" /> {tx('Plein écran')}</button></h3>
          {presetsEl}
          {beatGridEl}
        </div>

        <div className="card">
          <h3><Ico n="pad-grid" s={28} /> {tx("Pads en direct")}</h3>
          {padsEl}
        </div>
      </>}

      {/* ================= STUDIO ================= */}
      {tab === 'studio' && <>
        <div className="card hum-card">
          <h3><Ico n="voice-wave" s={30} /> {tx('Fredonne ou chante : Sonyria ajoute la musique')}</h3>
          <div className="seg2">
            <button className={hum.mode === 'hum' ? 'on' : ''} onClick={() => setHum({ ...hum, mode: 'hum' })}><Ico n="note" s={24} /><b>{tx('Fredonner une mélodie')}</b><small>{tx('Hum, la-la-la, sifflé : l’app transcrit tes notes et les rejoue.')}</small></button>
            <button className={hum.mode === 'sing' ? 'on' : ''} onClick={() => setHum({ ...hum, mode: 'sing' })}><Ico n="microphone" s={24} /><b>{tx('Chanter')}</b><small>{tx('Ta voix reste ; accords, basse et batterie s’ajoutent autour.')}</small></button>
          </div>
          <div className="chips" style={{ marginTop: 10 }}>
            <button className={'chip' + (hum.metro ? ' on' : '')} onClick={() => setHum({ ...hum, metro: !hum.metro })}><Ic n="bell" size={14} /> {tx('Métronome')} {song.bpm} BPM</button>
            <button className={'chip' + (hum.keepKey ? ' on' : '')} onClick={() => setHum({ ...hum, keepKey: !hum.keepKey })}><Ic n="score" size={14} /> {tx('Garder ma tonalité')}</button>
            {hum.mode === 'hum' && hasLyrics() && <button className={'chip' + (hum.onLyrics ? ' on' : '')} onClick={() => setHum({ ...hum, onLyrics: !hum.onLyrics })}><Ic n="pen" size={14} /> {tx('Poser sur mes paroles')}</button>}
          </div>
          {hum.mode === 'hum' && <><label className="f">{tx('Instrument qui rejoue ta mélodie')}</label>
            <div className="chips">{[['piano', 'Piano', 'piano'], ['flute', 'Flûte', 'flute'], ['synth', 'Synthé', 'synth'], ['voix', 'Voix', 'mic']].map(([k, n, ic]) => <button key={k} className={'chip' + (hum.instr === k ? ' on' : '')} onClick={() => setHum({ ...hum, instr: k })}><Ico n={ic} s={20} /> {tx(n)}</button>)}</div></>}
          <div style={{ height: 12 }} />
          {busy === 'hum' ? <div className="row"><span className="busy" /> {progress}</div>
            : !humRec ? <button className="btn rec wide" onClick={startHum}><Ico n="record" s={26} /> {hum.mode === 'hum' ? tx('Fredonner maintenant') : tx('Chanter maintenant')}</button>
            : <><HumBeat eng={eng} /><button className="btn wide" onClick={stopHum}><span className="rec-dot" /> {tx('Terminer et ajouter la musique')}</button></>}
          <div className="hint" style={{ marginTop: 8 }}>{hum.mode === 'hum' ? tx('Après le décompte de 4 temps, fredonne au tempo. Choisis d’abord le style dans Paroles ou Beat : l’arrangement suit ce style.') : hasLyrics() ? tx('Chante tes paroles au tempo après le décompte. Le karaoké se cale sur ta voix.') : tx('Pas de paroles tapées : elles seront transcrites depuis ta voix (Whisper).')}</div>
        </div>
        <div className="card">
          <h3><Ico n="studio-mic" s={30} /> {tx("Enregistrement")}</h3>
          {!micOn ? <button className="btn pri wide" onClick={openMic}><Ic n="mic" /> {tx("Activer le micro")}</button> : <MicMeter eng={eng} />}
          <Sub k="rec-opt" t={tx('Options : départ, décompte, karaoké, écho')}>
          <div className="row" style={{ marginTop: 10 }}>
            <div className="grow"><label className="f">{tx("Enregistrer à partir de")}</label>
              <select value={recFrom} onChange={(e) => setRecFrom(+e.target.value)}>
                <option value={0}>{tx("Début de la chanson")}</option>
                {tl.lines.map((l, i) => <option key={i} value={l.b0}>{l.label} — {l.text.slice(0, 32)}</option>)}
              </select></div>
          </div>
          <div className="chips" style={{ marginTop: 8 }}>
            <button className={'chip' + (song.countIn ? ' on' : '')} onClick={() => up((s) => (s.countIn = !s.countIn))}><Ic n="timer" size={14} /> {tx("Décompte 1 mesure")}</button>
            <button className={'chip' + (song.karaRec ? ' on' : '')} onClick={() => up((s) => (s.karaRec = !s.karaRec))}><Ic n="vocal" size={14} /> {tx("Karaoké plein écran")}</button>
            <button className={'chip' + (song.guide ? ' on' : '')} onClick={() => up((s) => (s.guide = !s.guide))}><Ic n="music" size={14} /> {tx("Mélodie guide")}</button>
            <button className={'chip' + (song.echoCancel ? ' on' : '')} onClick={() => { up((s) => (s.echoCancel = !s.echoCancel)); setMicOn(false); }}><Ic n="noecho" size={14} /> {tx("Sans écouteurs")}</button>
          </div>
          </Sub>
          <div style={{ height: 10 }} />
          {!rec ? <button className="btn rec wide" onClick={startRec}><Ico n="record" s={26} /> {tx("Enregistrer une prise")}</button>
            : <button className="btn wide" onClick={finishRec}><span className="rec-dot" /> {tx("Arrêter l’enregistrement")}</button>}
          <Sub k="rec-lat" t={tx('Latence et conseils')}>
          <div className="sl" style={{ marginTop: 10 }}><span>{tx("Latence")}</span><input type="range" min="-50" max="400" step="5" value={song.latency ?? Math.round((eng.current?.latency() || 0.04) * 1000)} onChange={(e) => up((s) => (s.latency = +e.target.value))} /><output>{song.latency ?? 'auto'}{song.latency != null ? 'ms' : ''}</output></div>
          <div className="hint">{tx("Mets des écouteurs pour que le beat ne s’enregistre pas dans le micro. Si ta voix arrive en retard, augmente la latence.")}</div>
          </Sub>
        </div>
        <div className="card film-card">
          <h3><Ico n="rec-button" s={28} /> {tx('Me filmer en chantant')}</h3>
          <div className="hint" style={{ marginBottom: 10 }}>{tx('Choisis un fond (thème animé ou ta photo) : tu apparais devant le fond et tes paroles défilent en bas dans une case bien lisible. La vidéo va directement dans ton clip.')}</div>
          <button className="btn pri wide" onClick={() => setCam(true)}><Ico n="rec-button" s={22} /> {tx('Ouvrir la caméra')}</button>
        </div>
        <div className="card">
          <h3><Ico n="upload" s={28} /> {tx("Importer un MP4 ou un audio")}</h3>
          {busy === 'import' ? <div className="row"><span className="busy" /> {progress}</div> : <div className="row">
            <label className="btn ai"><Ic n="sparkles" /> {tx("Recréer la chanson")}<input type="file" accept="audio/*,video/*" hidden onChange={(e) => e.target.files[0] && recreate(e.target.files[0])} /></label>
            <label className="btn"><Ic n="add" /> {tx("Ajouter comme piste")}<input type="file" accept="audio/*,video/*" hidden onChange={(e) => e.target.files[0] && importAudio(e.target.files[0])} /></label>
          </div>}
          <div className="hint" style={{ marginTop: 8 }}><b>{tx("Recréer")}</b> {tx(": l’app extrait les paroles (Whisper, dans ton téléphone), le tempo, la tonalité et les accords, sépare la voix de l’instrumental, puis rebâtit mélodie et karaoké. Tu retrouves l’original, l’instrumental et la voix dans la table de son. La 1re fois, le modèle de transcription (~80 Mo) se télécharge. Utilise des chansons dont tu as les droits.")}</div>
        </div>

        {!song.tracks.length && <div className="empty">{tx("Aucune prise pour l’instant.")}<br />{tx("Enregistre ta voix, une guitare ou ton rythme parlé.")}</div>}
        {song.tracks.map((t) => (
          <div key={t.id} className="track">
            <div className="row nw">
              <input className="nm" value={t.name} onChange={(e) => tr(t.id, (x) => (x.name = e.target.value))} />
              <button className={'tgl m' + (t.mute ? ' on' : '')} onClick={() => tr(t.id, (x) => (x.mute = !x.mute))}>M</button>
              <button className={'tgl s' + (t.solo ? ' on' : '')} onClick={() => tr(t.id, (x) => (x.solo = !x.solo))}>S</button>
              <button className="tgl" aria-label={tx("Supprimer")} onClick={() => { if (confirmDel.current === t.id) up((s) => (s.tracks = s.tracks.filter((x) => x.id !== t.id))); else { confirmDel.current = t.id; say(tx('Touche encore la corbeille pour supprimer')); } }}><Ico n="trash" s={22} /></button>
            </div>
            <Wave track={t} />
            {!t.back ? <div className="backs">
              <b><Ico n="voice-wave" s={18} /> {tx('Back vocals à partir de cette voix')}</b>
              <div className="chips">{Object.entries(BACKS).map(([k, b]) => <button key={k} className="chip" disabled={busy === 'back'} onClick={() => addBacking(t, k)}>{tx(b.n)}</button>)}
                <button className="chip" onClick={() => tr(t.id, (x) => Object.assign(x, fxParams('stade'), { fx: 'stade', back: true, pan: song.tracks.filter((y) => y.back).length % 2 ? 0.5 : -0.5, vol: 0.5, echo: 0.3, reverb: 0.5 }))}>{tx('C’est un back vocal')}</button>
              </div>
              {busy === 'back' && <div className="row"><span className="busy" /> {tx('Sonyria crée tes back vocals…')}</div>}
            </div> : <div className="hint"><span className="badge">{tx('Back vocal')}</span> {tx('En arrière-plan, avec écho et réverb — dose-le avec le volume.')}</div>}
            <div className="hint">{tx('Début : {s} s · {d} s', { s: t.start.toFixed(2), d: (t.data?.length / t.sr || 0).toFixed(1) })}</div>
            <div className="chips" style={{ margin: '8px 0' }}>
              {Object.entries(VOICE_FX).map(([k, f]) => <button key={k} className={'chip' + (t.fx === k ? ' on' : '')} onClick={() => tr(t.id, (x) => Object.assign(x, fxParams(k), { fx: k }))}>{tx(f.n)}</button>)}
            </div>
            <Slider label="Volume" v={t.vol} min={0} max={1.5} step={0.01} fmt={(x) => Math.round(x * 100)} on={(x) => tr(t.id, (y) => (y.vol = x))} />
            <Sub k={'trfx-' + t.id} t={tx('Réglages fins : écho, réverb, doublage, panoramique')}>
            <Slider label="Écho" v={t.echo || 0} min={0} max={0.8} step={0.01} fmt={(x) => Math.round(x * 100)} on={(x) => tr(t.id, (y) => (y.echo = x))} />
            <div className="sl"><span>{tx("Temps d’écho")}</span><select value={t.echoTime || '1/8.'} onChange={(e) => tr(t.id, (y) => (y.echoTime = e.target.value))}>{Object.keys(ECHO_TIMES).map((k) => <option key={k} value={k}>{k === 'slap' ? tx('Slap (court)') : k + (k.endsWith('.') ? ' ' + tx('pointée') : '')}</option>)}</select><output /></div>
            <Slider label="Répétitions" v={t.fb ?? 0.3} min={0} max={0.85} step={0.01} fmt={(x) => Math.round(x * 100)} on={(x) => tr(t.id, (y) => (y.fb = x))} />
            <Slider label="Réverb" v={t.reverb || 0} min={0} max={1} step={0.01} fmt={(x) => Math.round(x * 100)} on={(x) => tr(t.id, (y) => (y.reverb = x))} />
            <Slider label="Doublage" v={t.double || 0} min={0} max={1} step={0.01} fmt={(x) => Math.round(x * 100)} on={(x) => tr(t.id, (y) => (y.double = x))} />
            <Slider label="Brillance" v={t.bright || 0} min={-6} max={9} step={0.5} fmt={(x) => x + 'dB'} on={(x) => tr(t.id, (y) => (y.bright = x))} />
            <Slider label="Panoramique" v={t.pan || 0} min={-1} max={1} step={0.05} fmt={(x) => (x < 0 ? 'G' : x > 0 ? 'D' : 'C') + Math.abs(Math.round(x * 100))} on={(x) => tr(t.id, (y) => (y.pan = x))} />
            </Sub>
            <div className="row" style={{ marginTop: 6 }}>
              <span className="hint">{tx("Décaler :")}</span>
              {[[-0.05, '−50ms'], [-0.01, '−10'], [0.01, '+10'], [0.05, '+50ms']].map(([d, n]) => <button key={n} className="btn sm" onClick={() => tr(t.id, (y) => (y.start = Math.max(0, y.start + d)))}>{tx(n)}</button>)}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn sm ai" onClick={() => alignVoice(t)}><Ico n="voice-wave" s={22} /> {tx("Caler le karaoké sur cette voix")}</button>
              <button className="btn sm" onClick={() => detectTempo(t)}><Ico n="metronome" s={20} /> {tx("Tempo")}</button>
              <button className="btn sm" onClick={async () => { const e = await ensureAudio(); const bar = Math.floor(t.start / (16 * s16(song.bpm))); e.play(song, { from: bar, onEnd: () => setPlaying(false) }); setPlaying(true); }}><Ic n="play" size={14} /> {tx("Écouter")}</button>
            </div>
          </div>
        ))}
        {song.tracks.length > 0 && <label className="row" style={{ fontSize: 13, margin: '4px 4px 12px' }}><input type="checkbox" checked={song.voicePitch} onChange={(e) => up((s) => (s.voicePitch = e.target.checked))} /> {tx("En calant, reprendre aussi les notes que je chante")}</label>}
      </>}

      {/* ================= TABLE DE SON ================= */}
      {tab === 'table' && <Mixer song={song} up={up} eng={eng} playing={playing} onFull={() => openFs('mix')} />}

      {/* ================= CLIP ================= */}
      {tab === 'clip' && <>
        <div className="card">
          <h3><Ico n="spectrum" s={28} /> {tx("Vidéoclip animé")}</h3>
          <canvas ref={clipRef} className="clip-cv" />
          <Sub k="clip-vid" t={tx('Ma vidéo : me filmer ou importer un clip')} open>
          <div className="vid-src">
            <button className="btn pri" onClick={() => setCam(true)}><Ico n="rec-button" s={22} /> {tx('Me filmer')}</button>
            <label className="btn"><Ic n="film" /> {tx('Importer mon clip')}<input type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files[0]; if (f) attachVideo(f, { vSound: 'app' }).then(() => say(tx('Vidéo ajoutée — tes paroles s’affichent par-dessus'))); e.target.value = ''; }} /></label>
          </div>
          <div className="hint">{tx('Filme-toi pendant que la chanson joue, ou importe un clip fait ailleurs (téléphone, CapCut…) : Sonyria ajoute tes paroles en karaoké par-dessus.')}</div>
          {videoBg.current && <div className="vid-opts">
            <div className="row"><b className="grow"><Ic n="film" /> {tx('Ma vidéo')}</b><button className="btn sm" onClick={removeVideo}><Ico n="trash" s={18} /> {tx('Retirer')}</button></div>
            <label className="f">{tx('Affichage')}</label>
            <div className="chips">{[['plein', 'Plein écran'], ['fond', 'En fond, avec animation']].map(([k, n]) => <button key={k} className={'chip' + ((song.clip.vMode || 'plein') === k ? ' on' : '')} onClick={() => up((s) => (s.clip.vMode = k))}>{tx(n)}</button>)}</div>
            <label className="f">{tx('Son du clip')}</label>
            <div className="chips">{[['app', 'Musique Sonyria'], ['video', 'Son de ma vidéo'], ['both', 'Les deux']].map(([k, n]) => <button key={k} className={'chip' + ((song.clip.vSound || 'app') === k ? ' on' : '')} onClick={() => up((s) => (s.clip.vSound = k))}>{tx(n)}</button>)}</div>
            <label className="f">{tx('Caler la vidéo avec les paroles')} <small style={{ color: 'var(--dim)' }}>{(song.clip.vOff || 0) > 0 ? '+' : ''}{(song.clip.vOff || 0).toFixed(1)} s</small></label>
            <input type="range" min="-20" max="20" step="0.1" value={song.clip.vOff || 0} onChange={(e) => up((s) => (s.clip.vOff = +e.target.value))} />
            <div className="row" style={{ fontSize: 12.5, gap: 14 }}>
              <label className="row nw"><input type="checkbox" checked={song.clip.vLoop !== false} onChange={(e) => up((s) => (s.clip.vLoop = e.target.checked))} /> {tx('Vidéo en boucle')}</label>
              <label className="row nw"><input type="checkbox" checked={!!song.clip.mirror} onChange={(e) => up((s) => (s.clip.mirror = e.target.checked))} /> {tx('Effet miroir')}</label>
              <label className="row nw"><input type="checkbox" checked={!!song.clip.cutout} onChange={(e) => { const on = e.target.checked; if (on) loadCutout().then(() => bump()).catch(() => say(tx('Le détourage n’a pas pu se charger (connexion).'))); up((s) => (s.clip.cutout = on)); }} /> {tx('Me détourer (fond derrière moi)')}</label>
            </div>
          </div>}
          </Sub>
          <Sub k="clip-fmt" t={tx('Format')} note={song.clip.format}>
          <label className="f">{tx("Format prêt à publier (1080p)")}</label>
          <div className="chips">{Object.entries(PLATFORMS).map(([k, p]) => <button key={k} className={'chip' + (song.clip.format === p.f ? ' on' : '')} onClick={() => up((s) => (s.clip.format = p.f))}>{tx(p.n)} <small>{p.f}</small></button>)}</div>
          </Sub>
          <Sub k="clip-theme" t={tx('Décor')} note={videoBg.current ? tx('Ma vidéo') : tx(THEMES[scenario.theme]?.n || '')} open>
          <div className="chips seg">
            {[['anim', 'Décor animé'], ['mine', 'Mes photos'], ['video', 'Vidéos réelles'], ['photo', 'Photos réelles']].map(([k, n]) => <button key={k} className={'chip' + (decor === k ? ' on' : '')} onClick={() => setDecor(k)}>{tx(n)}</button>)}
          </div>
          {decor === 'mine' ? <div style={{ marginTop: 8 }}>
            <div className="row">
              <label className="btn pri"><Ic n="images" /> {tx('Choisir mes photos')}<input type="file" accept="image/*" multiple hidden onChange={async (e) => { photos.current = (await Promise.all([...e.target.files].slice(0, 12).map(loadImage))).filter(Boolean); e.target.value = ''; if (videoBg.current) removeVideo(); bump(); say(tx('{n} photo(s) ajoutée(s)', { n: photos.current.length })); }} /></label>
              <label className="btn"><Ic n="camera" /> {tx('Prendre une photo')}<input type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const im = e.target.files[0] && (await loadImage(e.target.files[0])); e.target.value = ''; if (im) { photos.current = [...photos.current, im].slice(-12); if (videoBg.current) removeVideo(); bump(); } }} /></label>
              {photos.current.length > 0 && <button className="btn sm" onClick={() => { photos.current = []; bump(); }}><Ico n="trash" s={18} /> {tx('Retirer')}</button>}
            </div>
            {photos.current.length > 0 && <div className="mini-thumbs">{photos.current.map((im, i) => <img key={i} src={im.src} alt="" />)}</div>}
            <div className="hint" style={{ marginTop: 6 }}>{tx('Jusqu’à 12 photos : elles défilent une par ligne de paroles, avec un léger mouvement. Tu peux ajouter des effets dans Visuel.')}</div>
          </div> : decor !== 'anim' ? <RealMedia kind={decor} orient={song.clip.format === '16:9' ? 'landscape' : song.clip.format === '1:1' ? 'square' : 'portrait'} say={say}
            onVideo={(blob) => { attachVideo(blob, { vMode: 'plein', vLoop: true, vSound: 'app', cutout: false, mirror: false }).then(() => say(tx('Vidéo réelle ajoutée au clip'))); }}
            onPhotos={async (blobs) => { photos.current = (await Promise.all(blobs.map((b) => loadImage(b)))).filter(Boolean); if (videoBg.current) removeVideo(); bump(); say(tx('{n} photo(s) ajoutée(s)', { n: photos.current.length })); }} /> : <>
          <label className="f">{tx("Décor animé")} <small style={{ color: 'var(--dim)' }}>· {Object.keys(THEMES).length} {tx('styles')}</small></label>
          <div className="chips cats">{Object.entries(THEME_CATS).map(([k, n]) => <button key={k} className={'chip' + ((themeCat || THEMES[scenario.theme]?.c || 'lum') === k ? ' on' : '')} onClick={() => setThemeCat(k)}>{tx(n)}</button>)}</div>
          <div className="chips" style={{ marginTop: 6 }}>{Object.entries(THEMES).filter(([, t]) => t.c !== 'old').filter(([, t]) => t.c === (themeCat || THEMES[scenario.theme]?.c || 'lum')).map(([k, t]) => <button key={k} className={'chip' + (scenario.theme === k ? ' on' : '')} onClick={() => up((s) => { s.clip.theme = k; if (s.clip.scenario) s.clip.scenario = { ...s.clip.scenario, theme: k, sections: {} }; })}>{tx(t.n)}</button>)}</div>
          </>}
          </Sub>
          <Sub k="clip-look" t={tx('Visuel : couleurs et effets')} note={[tx(LOOKS[song.clip.look || 'naturel']), ...(song.clip.overlays || []).map((o) => tx(OVERLAYS[o]))].join(' · ')}>
          <label className="f">{tx('Couleurs')}</label>
          <div className="chips">{Object.entries(LOOKS).map(([k, n]) => <button key={k} className={'chip' + ((song.clip.look || 'naturel') === k ? ' on' : '')} onClick={() => up((s) => (s.clip.look = k))}>{tx(n)}</button>)}</div>
          <label className="f">{tx('Effets (plusieurs possibles)')}</label>
          <div className="chips">{Object.entries(OVERLAYS).map(([k, n]) => { const on = (song.clip.overlays || []).includes(k); return <button key={k} className={'chip' + (on ? ' on' : '')} onClick={() => up((s) => { const a = s.clip.overlays || []; s.clip.overlays = on ? a.filter((x) => x !== k) : [...a, k]; })}>{tx(n)}</button>; })}</div>
          <label className="f">{tx('Spectre audio')}</label>
          <div className="chips">{Object.entries(SPECTRA).map(([k, n]) => <button key={k} className={'chip' + ((song.clip.spectrum || 'cercle') === k ? ' on' : '')} onClick={() => up((s) => (s.clip.spectrum = k))}>{tx(n)}</button>)}</div>
          </Sub>
          <Sub k="clip-opt" t={tx('Paroles, pochette et scénario IA')}>
          <label className="row nw" style={{ fontSize: 12.5, marginTop: 8 }}><input type="checkbox" checked={song.clip.disc !== false} onChange={(e) => up((s) => (s.clip.disc = e.target.checked))} /> {coverUrl ? tx('Pastille de ma pochette qui tourne (style TikTok)') : tx('Pastille de pochette (crée ta pochette dans Mon album)')}</label>
          <label className="row nw" style={{ fontSize: 12.5, marginTop: 8 }}><input type="checkbox" checked={song.clip.lyrBox !== false} onChange={(e) => up((s) => (s.clip.lyrBox = e.target.checked))} /> {tx('Paroles dans une case qui s’adapte au fond (meilleur contraste)')}</label>
          <label className="f">{tx('Animation des paroles')}</label>
          <div className="chips">{Object.entries(TEXT_STYLES).map(([k, n]) => <button key={k} className={'chip' + ((song.clip.textStyle || scenario.textStyle || 'karaoke') === k ? ' on' : '')} onClick={() => up((s) => { s.clip.textStyle = k; })}>{tx(n)}</button>)}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn ai" disabled={!!busy} onClick={aiClip}>{busy === 'clip' ? <Magic kind="clip" /> : <><Ic n="sparkles" /> {tx('Scénario IA')}</>}</button>

            <label className="btn"><Ic n="images" /> {tx("Mes photos")}<input type="file" accept="image/*" multiple hidden onChange={async (e) => { photos.current = (await Promise.all([...e.target.files].slice(0, 12).map(loadImage))).filter(Boolean); bump(); say(tx('{n} photo(s) ajoutée(s)', { n: photos.current.length })); }} /></label>
            {song.clip.scenario && <button className="btn sm" onClick={() => up((s) => (s.clip.scenario = null))}><Ic n="undo" /> {tx("Thème simple")}</button>}
          </div>
          <div className="hint" style={{ marginTop: 8 }}>{tx("Sonyria écrit le scénario : un thème, des couleurs et des mots-clés par section. L’animation suit le son et les paroles s’affichent en karaoké. Tes photos défilent en fond, une par ligne.")}</div>
          </Sub>
        </div>
        <div className="card">
          <h3><Ico n="share" s={28} /> {tx("Exporter")}</h3>
          {exporting ? <>
            <div className="row"><span className="busy" /> {tx('Export {w} en cours… garde l’écran allumé.', { w: exporting === 'clip' ? tx('du clip') : exporting === 'album' ? tx('de l’album') : exporting === 'wav' ? 'WAV' : 'MP4' })}</div>
            {exporting !== 'wav' && <button className="btn sm" style={{ marginTop: 8 }} onClick={() => exportStop.current?.()}><Ic n="stop" /> {tx("Arrêter et enregistrer")}</button>}
          </> : <>
          <label className="f">{tx("Partie à exporter")}</label>
          <div className="chips" style={{ marginBottom: 10 }}>{[['all', 'Toute la chanson'], ['chorus', 'Le refrain'], ['30', '30 s'], ['60', '60 s']].map(([k, n]) => <button key={k} className={'chip' + (range === k ? ' on' : '')} onClick={() => setRange(k)}>{tx(n)}</button>)}</div>
          <div className="row">
            <button className="btn pri" onClick={() => exportLive(true)}><Ico n="play" s={22} /> {tx("Clip MP4")}</button>
            <button className="btn" onClick={() => exportLive(false)}><Ico n="disc-note" s={22} /> {tx("Audio MP4")}</button>
            <button className="btn" onClick={exportWav}><Ico n="wav" s={22} /> {tx("WAV studio")}</button>
          </div></>}
          <div className="hint" style={{ marginTop: 8 }}>{tx("Clip MP4 en H.264 + AAC, 1080p, 30 images/s : prêt pour TikTok, Reels, Shorts et YouTube. 30 s et 60 s partent du 1er refrain. L’export se fait en temps réel ; le WAV (chanson complète) est instantané. Les instruments sont de vrais enregistrements sous licences libres (voir Réglages › Crédits).")}</div>
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
        <button className="tbtn" onClick={() => { stop(); }} aria-label={tx("Arrêter")}><Ico n="stop" s={34} /></button>
        <button className="play" onClick={() => (playing ? stop() : play({ from: 0 }))} aria-label={tx("Lecture")}>{playing ? <Ico n="pause" s={52} /> : <Ico n="play" s={52} />}</button>
        {coverUrl && <img className={'tdisc' + (playing ? ' spin' : '')} src={coverUrl} alt="" onClick={() => setSheet({ type: 'songs' })} />}
        <div className="tinfo">
          <b>{rec ? <><span className="rec-dot" /> {tx("Enregistrement…")}</> : song.title}</b>
          {tx(M.STYLES[song.style].n)} · {keyLabel} · {song.bpm} BPM · <span className="pos">{posLabel}</span>
        </div>
        <button className={'tbtn' + (loop ? ' on' : '')} onClick={() => setLoop(!loop)} aria-label={tx("Boucle")}><Ico n="loop" s={34} dim={!loop} /></button>
        <button className="tbtn" onClick={() => setKara(true)} aria-label={tx("Karaoké")}><Ico n="microphone" s={30} /></button>
        <button className="tbtn" style={{ color: '#ef4444' }} onClick={() => (rec ? finishRec() : startRec())} aria-label={tx("Enregistrer")}>{rec ? <Ico n="stop" s={34} /> : <Ico n="record" s={34} />}</button>
      </div></div>

      {cam && <CamStudio song={song} tl={tl} eng={eng} ensureAudio={ensureAudio} play={play} stop={() => { eng.current?.stop(); setPlaying(false); }} onDone={onFilmed} onClose={() => setCam(false)} scenario={scenario} photos={() => photos.current} onPhotos={async (files) => { photos.current = (await Promise.all(files.slice(0, 12).map(loadImage))).filter(Boolean); bump(); }} />}
      {kara && <Karaoke song={song} tl={tl} eng={eng} playing={playing} rec={rec} onClose={() => setKara(false)} onPlay={() => (playing ? stop() : play({ from: 0 }))} onRec={() => (rec ? finishRec() : startRec())} />}

      {sheet && <div className="sheet-bg" onClick={() => setSheet(null)}><div className="sheet" onClick={(e) => e.stopPropagation()}>
        {sheet.type === 'chord' && <>
          <h3>{tx("Choisir l’accord")}</h3>
          <div className="ch-grid">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const cur = song.blocks[sheet.bi].lines[sheet.li].chords[sheet.ci];
              return <button key={d} className={cur === d ? 'on' : ''} onClick={async () => { up((s) => { s.blocks[sheet.bi].lines[sheet.li].chords[sheet.ci] = d; s.blocks[sheet.bi].lines[sheet.li].custom = true; }); const e = await ensureAudio(); e.previewChord(song, d); }}>
                {M.chordName(d, song.key, song.mode, song.fr)}<small>{['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][d - 1]}</small></button>;
            })}
          </div>
          <button className="btn wide" style={{ marginTop: 12 }} onClick={() => setSheet(null)}>{tx("OK")}</button>
        </>}
        {sheet.type === 'profile' && me && <>
          <h3><img src={avSrc(me.av)} alt="" style={{ width: 34, height: 34, borderRadius: '50%' }} /> {tx("Mon profil")}</h3>
          <label className="f">{tx("Prénom")}</label><input type="text" value={me.name || ''} onChange={(e) => setMe({ ...me, name: e.target.value })} />
          <label className="f">{tx("Nom d’artiste")}</label><input type="text" value={me.artist || ''} onChange={(e) => setMe({ ...me, artist: e.target.value })} />
          <label className="f">{tx("Avatar")}</label>
          <div style={{ maxHeight: 320, display: 'flex' }}><AvatarGrid value={me.av} onPick={(a) => setMe({ ...me, av: a })} /></div>
          <button className="btn wide" style={{ marginTop: 12 }} onClick={() => setSheet(null)}>{tx("OK")}</button>
        </>}
        {sheet.type === 'songs' && <SongsSheet song={song} me={me} load={load} close={() => setSheet(null)} say={say} onCover={(album) => setSheet({ type: 'cover', album })} onAlbumMp4={(album) => { setSheet(null); exportAlbum(album); }} coverV={coverV} onVersions={(id) => setSheet({ type: 'versions', id })} />}
        {sheet.type === 'versions' && <VersionsSheet songId={sheet.id} song={song} load={load} say={say} snapshot={snapshot} back={() => setSheet({ type: 'songs' })} close={() => setSheet(null)} />}
        {sheet.type === 'cover' && <CoverEditor album={sheet.album} song={song} me={me} onSave={(url) => { saveCover(sheet.album, url); setCoverV((x) => x + 1); say(tx('Pochette enregistrée')); setSheet({ type: 'songs' }); }} onCancel={() => setSheet({ type: 'songs' })} />}
        {sheet.type === 'settings' && <>
          <h3><Ico n="settings" s={28} /> {tx("Réglages")}</h3>
          <div className="hint">{tx('IA : ')}{aiStatus == null ? '…' : aiStatus.ai ? tx('Clé Anthropic détectée ✓') : tx('Aucune clé (ajoute ANTHROPIC_API_KEY dans Vercel)')}</div>
          {aiStatus?.locked && <><label className="f">{tx("Code d’accès IA")}</label><input type="text" value={code} onChange={(e) => { setCode(e.target.value); localStorage.setItem('sonyria-code', e.target.value); }} placeholder={tx("Code défini dans Vercel")} /></>}
          <label className="f">{tx('Langue')}</label>
          <div className="chips"><button className={'chip' + (lang === 'fr' ? ' on' : '')} onClick={() => setLang('fr')}>Français</button><button className={'chip' + (lang === 'en' ? ' on' : '')} onClick={() => setLang('en')}>English</button></div>
          <label className="f">{tx("Notation")}</label>
          <div className="chips"><button className={'chip' + (!song.fr ? ' on' : '')} onClick={() => up((s) => (s.fr = false))}>C D E</button><button className={'chip' + (song.fr ? ' on' : '')} onClick={() => up((s) => (s.fr = true))}>{tx("Do Ré Mi")}</button></div>
          <label className="f">{tx("Profil")}</label>
          <div className="row"><button className="btn sm" onClick={() => setSheet({ type: 'profile' })}><Ic n="user" /> {tx("Prénom, nom d’artiste, avatar")}</button><button className="btn sm" onClick={() => { setMe({ ...me, onboarded: false }); setSheet(null); }}><Ic n="undo" /> {tx("Revoir l’accueil")}</button></div>
          <SyncPanel me={me} say={say} song={song} onPulled={async (ids) => { if (ids.includes(song.id)) { const r = await DB.getSong(song.id); if (r?.song) { const d = newSong(''); load({ ...d, ...r.song, mix: { ...d.mix, ...r.song.mix }, clip: { ...d.clip, ...r.song.clip } }); } } }} />
          <label className="f">{tx('Crédits des sons')}</label>
          <div className="hint">{tx('Vrais instruments enregistrés, sous licences libres :')} Splendid Grand Piano (domaine public), Rhodes J. Learman, VCSL, D. Smolken (CC0), FluidR3_GM – Frank Wen (MIT) / B. Gleitzman (CC BY 3.0), Pearl Master Studio – enoe (CC BY 3.0), LinnDrum (domaine public), TR-808 – Michael Fischer. <a href="/samples/CREDITS.txt" target="_blank" rel="noopener" style={{ color: 'var(--cyan)' }}>{tx('Détails')}</a></div>
          <label className="f">{tx("Installer l’app")}</label>
          <div className="hint">{tx("Android / Chrome : bouton « Installer » en haut, ou menu ⋮ → « Installer l’application ». iPhone : Partager → « Sur l’écran d’accueil ».")}</div>
          <button className="btn wide" style={{ marginTop: 14 }} onClick={() => setSheet(null)}>{tx("Fermer")}</button>
        </>}
      </div></div>}

      {!splash && me?.onboarded && installUI && !installUI.standalone && !installUI.dismissed && (install || installUI.ios) && (
        <div className="inst-bar">
          <img src="/icon-192.png" alt="" />
          <div className="grow">
            <b>{tx('Installer Sonyria')}</b>
            <small>{install ? tx('Sur ton écran d’accueil, en plein écran, même hors ligne.') : tx('iPhone : touche Partager, puis « Sur l’écran d’accueil ».')}</small>
          </div>
          {install && <button className="btn pri sm" onClick={doInstall}>{tx('Installer')}</button>}
          <button className="mini" onClick={closeInstall} aria-label={tx('Fermer')}><Ic n="x" /></button>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
      {printOpen && <PrintView song={song} me={me} onClose={() => setPrintOpen(false)} />}
      {fs && <div className={'fs fs-' + fs}>
        <div className="fs-bar">
          <button className="play" onClick={() => (playing ? stop() : play(fs === 'beat' ? { from: 0, to: Math.min(tl.bars.length, 4), loop: true } : { from: 0 }))} aria-label={tx('Lecture')}>{playing ? <Ico n="pause" s={48} /> : <Ico n="play" s={48} />}</button>
          <div className="fs-title"><b>{fs === 'beat' ? 'Beat table' : fs === 'arr' ? tx('Arrangement') : tx('Table de son')}</b><small>{song.title} · {tx(M.STYLES[song.style].n)} · {song.bpm} BPM · <span className="pos">{posLabel}</span></small></div>
          {fs === 'beat' && <div className="row nw" style={{ gap: 4 }}>
            <button className="tbtn" onClick={() => up((s) => (s.bpm = clamp(s.bpm - 1, 50, 200)))}>−</button>
            <b className="fs-bpm">{song.bpm}</b>
            <button className="tbtn" onClick={() => up((s) => (s.bpm = clamp(s.bpm + 1, 50, 200)))}>+</button>
            <button className="btn sm" onClick={tapTempo}><Ic n="tap" /> Tap</button>
          </div>}
          <button className="btn sm" onClick={closeFs}><Ic n="min" /> {tx('Quitter')}</button>
        </div>
        <div className="fs-body">
          {fs === 'beat' && <>{presetsEl}{beatGridEl}<div style={{ height: 12 }} />{padsEl}</>}
          {fs === 'arr' && <Arrangement song={song} up={up} preload={async () => { const e = await ensureAudio(); prepareSamples(e.ctx, song); }} />}
          {fs === 'mix' && <Mixer song={song} up={up} eng={eng} playing={playing} />}
        </div>
      </div>}
      </div>
    </>
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

function CamStudio({ song, tl, eng, ensureAudio, play, stop, onDone, onClose, scenario, photos, onPhotos }) {
  const vRef = useRef(null), cvRef = useRef(null), rdr = useRef(null);
  const [cut, setCut] = useState(!!song.clip.cutout || true);
  const [cutState, setCutState] = useState('');
  useEffect(() => { if (!cut) return; setCutState('load'); loadCutout().then(() => setCutState('ok')).catch(() => { setCutState('fail'); setCut(false); }); }, [cut]);
  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const [W, H] = FORMATS[song.clip.format] || [1080, 1920]; cv.width = Math.round(W / 2); cv.height = Math.round(H / 2);
    rdr.current = new ClipRenderer(cv);
    let raf; const freq = new Uint8Array(512);
    const f = () => {
      const e = eng.current; const st = e?.songTime(); if (e) e.analyser.getByteFrequencyData(freq);
      rdr.current.setup(scenario, photos(), vRef.current);
      const tt = st && !st.countIn ? st.t : (tl.lines[0]?.syl[0]?.g || 0) * s16(song.bpm) + 0.8;
      rdr.current.draw(tt, tl, { ...song, clip: { ...song.clip, vMode: 'plein', vLoop: true, vOff: 0, cutout: cut && cutState === 'ok', mirror: fac.current === 'user' } }, e?.playing ? freq : null);
      raf = requestAnimationFrame(f);
    };
    f(); return () => cancelAnimationFrame(raf);
  }, [cut, cutState, tl]); // eslint-disable-line
  const [facing, setFacing] = useState('user');
  const [stream, setStream] = useState(null);
  const [state, setState] = useState('idle');
  const [count, setCount] = useState(0);
  const [withVoice, setWithVoice] = useState(false);
  const [err, setErr] = useState('');
  const [li, setLi] = useState(-1);
  const [view, setView] = useState('clip');
  const [prompt, setPrompt] = useState(true);
  const mr = useRef(null), chunks = useRef([]), fac = useRef(facing);
  fac.current = facing;
  useEffect(() => {
    let st, dead = false; setErr('');
    (async () => {
      try {
        st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
        if (dead) { st.getTracks().forEach((x) => x.stop()); return; }
        setStream(st); if (vRef.current) { vRef.current.srcObject = st; vRef.current.play().catch(() => {}); }
      } catch (e) { setErr(tx('Caméra inaccessible : autorise la caméra et le micro dans ton navigateur.')); }
    })();
    return () => { dead = true; st?.getTracks().forEach((x) => x.stop()); };
  }, [facing]);
  useEffect(() => {
    let raf, last = -2;
    const f = () => { const st = eng.current?.songTime(); const c = st && !st.countIn ? currentLine(tl, song, st.t) : null; const i = c ? c.idx : -1; if (i !== last) { last = i; setLi(i); } raf = requestAnimationFrame(f); };
    f(); return () => cancelAnimationFrame(raf);
  }, [tl]); // eslint-disable-line
  const finish = () => { if (mr.current && mr.current.state !== 'inactive') mr.current.stop(); stop(); setState('idle'); };
  const start = async () => {
    if (!stream) return;
    await ensureAudio();
    setState('count'); for (let i = 3; i > 0; i--) { setCount(i); await new Promise((r) => setTimeout(r, 800)); }
    const ms = new MediaStream(withVoice ? stream.getTracks() : stream.getVideoTracks());
    const mime = pickMime(true);
    let rec; try { rec = new MediaRecorder(ms, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : {}); } catch (e) { rec = new MediaRecorder(ms); }
    chunks.current = []; rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => { const blob = new Blob(chunks.current, { type: rec.mimeType || 'video/webm' }); if (blob.size) onDone(blob, { mirror: fac.current === 'user', voice: withVoice, cutout: cut && cutState === 'ok' }); };
    mr.current = rec; rec.start(500);
    play({ from: 0, onEnd: () => setTimeout(finish, 300) });
    setState('rec');
  };
  const lineH = 66;
  const shown = Math.max(0, li);
  return (
    <div className="cam">
      <video ref={vRef} className={'cam-src' + (view === 'cam' ? ' show' + (facing === 'user' ? ' mir' : '') : '')} playsInline muted />
      <div className="cam-top">
        <button className="btn sm" onClick={() => { finish(); onClose(); }}><Ic n="x" /> {tx('Fermer')}</button>
        <span className="grow" />
        {state === 'rec' && <span className="cam-rec"><span className="rec-dot" /> REC</span>}
        <button className="btn sm" disabled={state !== 'idle'} onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}><Ic n="camera" /> {tx('Tourner')}</button>
      </div>
      <div className="cam-stage">
        <canvas ref={cvRef} className={'cam-v' + (view === 'cam' ? ' hide' : '')} />
        {prompt && tl.lines.length > 0 && <div className="prompter">
          <div className="prompter-in" style={{ transform: `translateY(${-shown * lineH}px)` }}>
            {tl.lines.map((l, i) => <div key={i} className={'pl' + (i === li ? ' now' : i < li ? ' past' : '')} style={{ height: lineH }}>{l.first && <small>{M.localLabel(l.label)}</small>}{l.text}</div>)}
          </div>
        </div>}
        {err && <div className="cam-err">{err}</div>}
        {state === 'count' && <div className="cam-count">{count}</div>}
      </div>
      <div className="cam-bot">
        {state === 'idle' && <div className="chips" style={{ justifyContent: 'center' }}>
          <button className={'chip' + (view === 'clip' ? ' on' : '')} onClick={() => setView(view === 'clip' ? 'cam' : 'clip')}><Ic n="film" size={14} /> {tx('Clip en direct')}</button>
          <button className={'chip' + (prompt ? ' on' : '')} onClick={() => setPrompt(!prompt)}><Ic n="file" size={14} /> {tx("Téléprompteur")}</button>
          <button className={'chip' + (cut ? ' on' : '')} onClick={() => setCut(!cut)}>{cutState === 'load' && cut ? <span className="busy" /> : <Ic n="sparkles" size={14} />} {tx('Fond derrière moi')}</button>
          <label className="chip"><Ic n="images" size={14} /> {tx('Mon fond (photo)')}<input type="file" accept="image/*" multiple hidden onChange={(e) => onPhotos([...e.target.files])} /></label>
          <label className="chip"><input type="checkbox" checked={withVoice} onChange={(e) => setWithVoice(e.target.checked)} /> {tx('Garder ma voix (écouteurs)')}</label>
        </div>}
        {cutState === 'fail' && <div className="hint" style={{ textAlign: 'center' }}>{tx('Le détourage n’a pas pu se charger (connexion). Ta vidéo garde son vrai fond.')}</div>}
        <div className="row nw" style={{ justifyContent: 'center', gap: 16 }}>
          <button className={'cam-btn' + (state === 'rec' ? ' on' : '')} disabled={!stream || state === 'count'} onClick={() => (state === 'rec' ? finish() : start())} aria-label={tx('Enregistrer')}><span /></button>
        </div>
        <div className="hint" style={{ textAlign: 'center' }}>{state === 'rec' ? tx('Touche pour arrêter') : tx('Ta caméra est enregistrée seule : tu pourras changer le fond, le thème et les paroles du clip ensuite.')}</div>
      </div>
    </div>
  );
}

function CoverEditor({ album, song, me, onSave, onCancel }) {
  const cv = useRef(null);
  const [o, setO] = useState(() => ({ bg: 'theme', theme: song.clip?.theme || 'coucher', title: album || tx('Mon album'), artist: me?.artist || me?.name || '', font: 'sora', layout: 'bas', color: '#ffffff', t: 8.4, seed: 7, zoom: 1, photo: null }));
  const [cat, setCat] = useState(THEMES[o.theme]?.c || 'nat');
  useEffect(() => { if (cv.current) drawCover(cv.current, o); }, [o]);
  const set = (k, x) => setO((p) => ({ ...p, [k]: x }));
  return <>
    <h3><Ic n="palette" /> {tx('Ma pochette d’album')}</h3>
    <canvas ref={cv} className="cover-cv" />
    <label className="f">{tx('Titre')}</label><input type="text" value={o.title} onChange={(e) => set('title', e.target.value)} />
    <label className="f">{tx('Artiste')}</label><input type="text" value={o.artist} onChange={(e) => set('artist', e.target.value)} />
    <label className="f">{tx('Fond')}</label>
    <div className="chips">
      <button className={'chip' + (o.bg === 'theme' ? ' on' : '')} onClick={() => set('bg', 'theme')}>{tx('Thème illustré')}</button>
      <label className={'chip' + (o.bg === 'photo' ? ' on' : '')}><Ic n="images" size={14} /> {tx('Ma photo')}<input type="file" accept="image/*" hidden onChange={async (e) => { const im = e.target.files[0] && (await loadImage(e.target.files[0])); if (im) setO((p) => ({ ...p, bg: 'photo', photo: im })); }} /></label>
      {o.bg === 'theme' && <button className="chip" onClick={() => setO((p) => ({ ...p, t: Math.random() * 40, seed: 1 + Math.floor(Math.random() * 9999) }))}><Ic n="dice" size={14} /> {tx('Varier')}</button>}
    </div>
    {o.bg === 'theme' && <>
      <div className="chips cats" style={{ marginTop: 6 }}>{Object.entries(THEME_CATS).map(([k, n]) => <button key={k} className={'chip' + (cat === k ? ' on' : '')} onClick={() => setCat(k)}>{tx(n)}</button>)}</div>
      <div className="chips" style={{ marginTop: 6 }}>{Object.entries(THEMES).filter(([, t]) => t.c === cat).map(([k, t]) => <button key={k} className={'chip' + (o.theme === k ? ' on' : '')} onClick={() => set('theme', k)}>{tx(t.n)}</button>)}</div>
    </>}
    {o.bg === 'photo' && <><label className="f">{tx('Zoom')}</label><input type="range" min="1" max="2.5" step="0.05" value={o.zoom} onChange={(e) => set('zoom', +e.target.value)} style={{ width: '100%' }} /></>}
    <label className="f">{tx('Écriture')}</label>
    <div className="chips">{Object.entries(COVER_FONTS).map(([k, f]) => <button key={k} className={'chip' + (o.font === k ? ' on' : '')} onClick={() => set('font', k)}>{tx(f.n)}</button>)}</div>
    <div className="chips" style={{ marginTop: 6 }}>{Object.entries(COVER_LAYOUTS).map(([k, n]) => <button key={k} className={'chip' + (o.layout === k ? ' on' : '')} onClick={() => set('layout', k)}>{tx(n)}</button>)}</div>
    <div className="chips" style={{ marginTop: 6 }}>{[['#ffffff', 'Blanc'], ['grad', 'Néon'], ['#fde68a', 'Or'], ['#111111', 'Noir'], ['#f472b6', 'Rose']].map(([c, n]) => <button key={c} className={'chip' + (o.color === c ? ' on' : '')} onClick={() => set('color', c)}><span className="sw" style={{ background: c === 'grad' ? 'var(--grad)' : c }} /> {tx(n)}</button>)}</div>
    <div className="row" style={{ marginTop: 12 }}>
      <button className="btn pri" onClick={() => onSave(drawCover(cv.current, o))}><Ic n="check" /> {tx('Enregistrer la pochette')}</button>
      <button className="btn" onClick={onCancel}>{tx('Annuler')}</button>
      {loadCover(album) && <button className="btn sm" style={{ color: 'var(--pink)' }} onClick={() => onSave('')}><Ico n="trash" s={18} /> {tx('Retirer')}</button>}
    </div>
    <div className="hint" style={{ marginTop: 6 }}>{tx('Ta pochette apparaît quand ta musique joue, en pastille qui tourne dans tes clips (style TikTok) et dans l’album en MP4.')}</div>
  </>;
}

function VersionsSheet({ songId, song, load, say, snapshot, back, close }) {
  const [list, setList] = useState(null);
  const [arm, setArm] = useState(null);
  const [title, setTitle] = useState('');
  const refresh = () => DB.listVersions(songId).then(setList).catch(() => setList([]));
  useEffect(() => { refresh(); DB.getSong(songId).then((r) => setTitle(r?.title || (songId === song.id ? song.title : ''))); }, [songId]); // eslint-disable-line
  const isCur = songId === song.id;
  const restore = async (v) => {
    if (!confirm(tx('Revenir à la version « {n} » ? Ta version actuelle est gardée dans la liste.', { n: v.name }))) return;
    if (isCur) await snapshot(tx('Avant de revenir en arrière'), 'named');
    else { const r = await DB.getSong(songId); if (r?.song) await DB.saveVersion(songId, r.song, tx('Avant de revenir en arrière'), 'named'); }
    const rec = await DB.getVersion(v.id); if (!rec?.song) return;
    const d = newSong(''); load({ ...d, ...structuredClone(rec.song), id: songId, hasOriginal: true, mix: { ...d.mix, ...rec.song.mix }, clip: { ...d.clip, ...rec.song.clip } });
    say(tx('Version « {n} » rétablie', { n: v.name })); close();
  };
  const remove = async (v) => {
    if (arm !== v.id) { setArm(v.id); say(tx('Touche encore pour supprimer cette version')); return; }
    const warn = v.kind === 'original' ? tx('Supprimer l’ORIGINAL de ta chanson ? Tu ne pourras plus y revenir.') : tx('Supprimer la version « {n} » ? C’est définitif.', { n: v.name });
    if (!confirm(warn)) { setArm(null); return; }
    await DB.deleteVersion(v.id); setArm(null); refresh(); say(tx('Version supprimée'));
  };
  const when = (t) => new Date(t).toLocaleString(getLang() === 'en' ? 'en-CA' : 'fr-CA', { dateStyle: 'medium', timeStyle: 'short' });
  return <>
    <h3><Ico n="folder" s={26} /> {tx('Versions')} · {title || tx('Sans titre')}</h3>
    <div className="hint">{tx('Ton original est toujours gardé. Sonyria garde aussi ta progression (toutes les 3 minutes de travail et à chaque étape importante) pour que tu puisses revenir en arrière.')}</div>
    {isCur && <button className="btn pri" style={{ margin: '10px 0' }} onClick={async () => { const n = (prompt(tx('Nom de cette version'), tx('Ma version')) || '').trim(); if (!n) return; await snapshot(n, 'named'); refresh(); say(tx('Version enregistrée')); }}><Ic n="plus" /> {tx('Enregistrer une version maintenant')}</button>}
    {list == null ? <span className="busy" /> : !list.length ? <div className="hint">{tx('Aucune version pour l’instant : elles apparaissent dès que tu travailles ta chanson.')}</div> :
      <div className="vers">{list.map((v) => <div key={v.id} className={'ver ' + v.kind}>
        <div className="grow"><b>{v.kind === 'original' ? '★ ' : ''}{v.name}</b><small>{when(v.updated)}{v.style ? ' · ' + tx(M.STYLES[v.style]?.n || v.style) : ''} · {tx('{n} lignes', { n: v.lines })}</small></div>
        <button className="btn sm" onClick={() => restore(v)}><Ic n="undo" /> {tx('Revenir')}</button>
        <button className={'tgl' + (arm === v.id ? ' on' : '')} onClick={() => remove(v)} aria-label={tx('Supprimer')}><Ico n="trash" s={20} /></button>
      </div>)}</div>}
    <div className="row" style={{ marginTop: 12 }}><button className="btn" onClick={back}><Ico n="disc-note" s={18} /> {tx('Mon album')}</button><button className="btn" onClick={close}>{tx('Fermer')}</button></div>
  </>;
}

function SyncPanel({ me, say, onPulled }) {
  const [ready, setReady] = useState(null);
  const [spaces, setSpaces] = useState(() => loadSpaces());
  const [busy, setBusy] = useState('');
  const [join, setJoin] = useState(null); // 'me' | 'team'
  const [code, setCode] = useState('');
  useEffect(() => { syncReady().then(setReady); }, []);
  const persist = (a) => { saveSpaces(a); setSpaces(a); };
  const run = async (sp) => {
    setBusy(sp.code);
    try { const r = await syncSpace(sp, { me }); say(tx('Synchro terminée : {a} reçue(s), {b} envoyée(s)', { a: r.pulled.length, b: r.pushed })); if (r.pulled.length) onPulled(r.pulled); setSpaces(loadSpaces()); }
    catch (e) { say(tx('Synchro impossible : {e}', { e: e.message })); }
    setBusy('');
  };
  const mine = spaces.find((x) => x.kind === 'me');
  const teams = spaces.filter((x) => x.kind === 'team');
  const copy = (c) => { navigator.clipboard?.writeText(prettyCode(c)).then(() => say(tx('Code copié'))).catch(() => {}); };
  const shareCode = (sp) => { const t = sp.kind === 'team' ? tx('Rejoins mon équipe « {n} » dans Sonyria : Réglages → Synchro → Rejoindre une équipe. Code : {c}', { n: sp.name, c: prettyCode(sp.code) }) : prettyCode(sp.code); if (navigator.share) navigator.share({ text: t }).catch(() => {}); else copy(sp.code); };
  const doJoin = async () => {
    const c = normCode(code); if (c.length < 10) return say(tx('Code incomplet'));
    setBusy('join');
    try {
      const p = await peekSpace(c);
      if (join === 'team') {
        if (!p.meta) { say(tx('Aucune équipe trouvée avec ce code')); setBusy(''); return; }
        const sp = { kind: 'team', code: c, name: p.meta.name || tx('Équipe'), album: p.meta.album ?? '' };
        persist([...spaces.filter((x) => x.code !== c), sp]); setJoin(null); setCode(''); await run(sp);
      } else {
        const sp = { kind: 'me', code: c, name: tx('Mes appareils') };
        persist([...spaces.filter((x) => x.kind !== 'me'), sp]); setJoin(null); setCode(''); await run(sp);
      }
    } catch (e) { say(tx('Synchro impossible : {e}', { e: e.message })); }
    setBusy('');
  };
  const leave = (sp) => { if (!confirm(tx('Arrêter la synchro « {n} » sur cet appareil ? Tes chansons restent ici.', { n: sp.name }))) return; persist(spaces.filter((x) => x.code !== sp.code)); };
  const Row = ({ sp }) => <div className="sync-row">
    <div className="grow"><b>{sp.name}</b>{sp.kind === 'team' && <small> · {tx('album')} « {sp.album || tx('Mon album')} »</small>}
      <div className="sync-code" onClick={() => copy(sp.code)}>{prettyCode(sp.code)}</div>
      <small>{sp.last ? tx('Dernière synchro : {t}', { t: new Date(sp.last).toLocaleTimeString(getLang() === 'en' ? 'en-CA' : 'fr-CA', { hour: '2-digit', minute: '2-digit' }) }) : tx('Pas encore synchronisé')}</small></div>
    <div className="col">
      <button className="btn sm pri" disabled={!!busy} onClick={() => run(sp)}>{busy === sp.code ? <span className="busy" /> : <Ic n="loop" />} {tx('Synchroniser')}</button>
      <button className="btn sm" onClick={() => shareCode(sp)}><Ico n="share" s={16} /> {tx('Partager le code')}</button>
      <button className="btn sm" onClick={() => leave(sp)}>{tx('Arrêter')}</button>
    </div>
  </div>;
  return <>
    <label className="f">{tx('Synchro entre mes appareils et mon équipe')}</label>
    {ready === false ? <div className="hint">{tx('La synchro n’est pas encore activée sur le serveur de Sonyria.')}</div> : <>
      <div className="hint" style={{ marginBottom: 8 }}>{tx('Un code relie tes appareils (toutes tes chansons) ou ton équipe (un album partagé). Ça se synchronise tout seul chaque minute quand l’app est ouverte.')}</div>
      <div className="sync-box">
        <b><Ic n="phone" /> {tx('Mes appareils')}</b>
        {mine ? <Row sp={mine} /> : <div className="row" style={{ marginTop: 6 }}>
          <button className="btn sm pri" onClick={async () => { const sp = { kind: 'me', code: normCode(newCode()), name: tx('Mes appareils') }; persist([...spaces, sp]); await run(sp); }}>{tx('Créer mon code')}</button>
          <button className="btn sm" onClick={() => setJoin('me')}>{tx('J’ai déjà un code')}</button>
        </div>}
      </div>
      <div className="sync-box">
        <b><Ic n="users" /> {tx('Mes équipes')}</b>
        {teams.map((sp) => <Row key={sp.code} sp={sp} />)}
        <div className="row" style={{ marginTop: 6 }}>
          <button className="btn sm pri" onClick={async () => {
            const n = (prompt(tx('Nom de l’équipe')) || '').trim(); if (!n) return;
            const a = (prompt(tx('Quel album partager avec l’équipe ? (un nouvel album sera créé s’il n’existe pas)'), n) || '').trim(); if (!a) return;
            try { const al = JSON.parse(localStorage.getItem('sonyria-albums') || '[]'); if (!al.includes(a)) localStorage.setItem('sonyria-albums', JSON.stringify([...al, a])); } catch (e) {}
            const sp = { kind: 'team', code: normCode(newCode()), name: n, album: a === tx('Mon album') ? '' : a }; persist([...spaces, sp]); await run(sp);
            say(tx('Équipe créée — partage le code à tes coéquipiers'));
          }}>{tx('Créer une équipe')}</button>
          <button className="btn sm" onClick={() => setJoin('team')}>{tx('Rejoindre une équipe')}</button>
        </div>
      </div>
      {join && <div className="sync-box" style={{ borderColor: 'var(--cyan)' }}>
        <b>{join === 'team' ? tx('Code de l’équipe') : tx('Code de mes appareils')}</b>
        <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX" style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: 2, textTransform: 'uppercase', marginTop: 6 }} />
        <div className="row" style={{ marginTop: 6 }}><button className="btn sm pri" disabled={busy === 'join'} onClick={doJoin}>{busy === 'join' ? <span className="busy" /> : <Ic n="check" />} {tx('Relier')}</button><button className="btn sm" onClick={() => { setJoin(null); setCode(''); }}>{tx('Annuler')}</button></div>
      </div>}
      <div className="hint" style={{ marginTop: 6 }}>{tx('Garde tes codes privés : toute personne qui a le code peut voir et modifier les chansons de cet espace.')}</div>
    </>}
  </>;
}

function Sub({ k, t, note, open, children }) {
  const [o, setO] = useState(() => { try { const x = localStorage.getItem('sonyria-sub:' + k); return x == null ? !!open : x === '1'; } catch (e) { return !!open; } });
  const tog = () => { const n = !o; setO(n); try { localStorage.setItem('sonyria-sub:' + k, n ? '1' : '0'); } catch (e) {} };
  return <div className={'sub' + (o ? ' open' : '')}>
    <button type="button" className="sub-h" onClick={tog}><span>{t}</span>{note ? <small>{note}</small> : null}<i /></button>
    {o && <div className="sub-b">{children}</div>}
  </div>;
}

const REAL_IDEAS = [['Coucher de soleil', 'sunset ocean'], ['Plage', 'beach waves'], ['Ville la nuit', 'city night lights'], ['Route de nuit', 'night drive road'], ['Pluie', 'rain window'], ['Forêt', 'forest sunlight'], ['Montagnes', 'mountains clouds'], ['Concert', 'concert crowd lights'], ['Amour', 'couple love silhouette'], ['Neige', 'snow falling'], ['Sous l’eau', 'underwater light'], ['Ciel étoilé', 'starry night sky'], ['Fumée', 'smoke colorful'], ['Danse', 'dancing silhouette'], ['Feu', 'fire flames'], ['Fleurs', 'flowers wind'], ['Nuages', 'clouds timelapse'], ['Studio', 'recording studio microphone']];
function RealMedia({ kind, orient, onVideo, onPhotos, say }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState('');
  const [ready, setReady] = useState(null);
  const [picked, setPicked] = useState([]);
  useEffect(() => { fetch('/api/stock').then((r) => r.json()).then((j) => setReady(!!j.ready)).catch(() => setReady(false)); }, []);
  useEffect(() => { setItems(null); setPicked([]); }, [kind]);
  const search = async (query) => {
    const qq = (query || q).trim(); if (!qq) return; setQ(qq); setBusy('search');
    try { const j = await fetch(`/api/stock?kind=${kind}&orient=${orient}&lang=${getLang()}&q=${encodeURIComponent(qq)}`).then((r) => r.json()); if (j.error) throw new Error(j.error); setItems(j.items || []); }
    catch (e) { say(tx('Recherche impossible : {e}', { e: e.message })); }
    setBusy('');
  };
  const grab = async (url) => {
    try { const r = await fetch(url); if (r.ok) return await r.blob(); } catch (e) {}
    const r2 = await fetch('/api/stock/file?u=' + encodeURIComponent(url)); if (!r2.ok) throw new Error('download'); return r2.blob();
  };
  const pickVideo = async (it) => { setBusy(String(it.id)); try { onVideo(await grab(it.url)); } catch (e) { say(tx('Téléchargement impossible')); } setBusy(''); };
  const usePhotos = async () => { setBusy('photos'); try { const blobs = []; for (const it of items.filter((x) => picked.includes(x.id))) blobs.push(await grab(it.url)); onPhotos(blobs); setPicked([]); } catch (e) { say(tx('Téléchargement impossible')); } setBusy(''); };
  if (ready === false) return <div className="hint" style={{ marginTop: 8 }}>{tx('Les vidéos et photos réelles ne sont pas encore activées : il faut ajouter une clé Pexels (gratuite) dans Vercel.')}</div>;
  return <div className="real">
    <div className="row nw" style={{ marginTop: 8 }}>
      <input type="text" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder={kind === 'video' ? tx('Chercher une vidéo (ex. coucher de soleil)') : tx('Chercher des photos')} />
      <button className="btn sm pri" onClick={() => search()} disabled={busy === 'search'}>{busy === 'search' ? <span className="busy" /> : tx('Chercher')}</button>
    </div>
    <div className="chips" style={{ marginTop: 6 }}>{REAL_IDEAS.map(([fr, en]) => <button key={en} className="chip" onClick={() => search(getLang() === 'en' ? en : fr)}>{tx(fr)}</button>)}</div>
    {items && (!items.length ? <div className="hint">{tx('Aucun résultat — essaie un autre mot.')}</div> : <div className="real-grid">
      {items.map((it) => <button key={it.id} className={'real-it' + (picked.includes(it.id) ? ' on' : '')} onClick={() => kind === 'video' ? pickVideo(it) : setPicked((p) => (p.includes(it.id) ? p.filter((x) => x !== it.id) : [...p, it.id].slice(-12)))}>
        <img src={it.thumb} alt="" loading="lazy" />
        {kind === 'video' && <small>{it.dur}s</small>}
        {busy === String(it.id) && <span className="busy" />}
      </button>)}
    </div>)}
    {kind === 'photo' && picked.length > 0 && <button className="btn pri wide" style={{ marginTop: 8 }} disabled={busy === 'photos'} onClick={usePhotos}>{busy === 'photos' ? <span className="busy" /> : <Ic n="check" />} {tx('Utiliser {n} photo(s) en fond', { n: picked.length })}</button>}
    <div className="hint" style={{ marginTop: 6 }}>{kind === 'video' ? tx('Touche une vidéo : elle devient le fond de ton clip, tes paroles par-dessus.') : tx('Choisis jusqu’à 12 photos : elles défilent une par ligne de paroles.')} {tx('Vidéos et photos de Pexels, libres de droits.')}</div>
  </div>;
}

function Structure({ song, up, tl, play, clock }) {
  const form = M.songForm(song);
  const auto = !Array.isArray(song.form) || !song.form.length;
  const [adding, setAdding] = useState(false);
  const setForm = (f) => up((s) => { s.form = f; });
  const move = (i, d) => { const f = [...form]; const j = i + d; if (j < 0 || j >= f.length) return; [f[i], f[j]] = [f[j], f[i]]; setForm(f); };
  const secs = tl.bars.length * 16 * s16(song.bpm);
  const curFi = clock?.active ? tl.lines[clock.active.line]?.fi : -1;
  const name = (bi) => { const b = song.blocks[bi]; const lab = M.localLabel(b.label); const ty = tx(TYPES[b.type]); return lab ? (lab.toLowerCase().startsWith(ty.toLowerCase()) ? lab : `${lab} · ${ty}`) : ty; };
  const playFi = (fi) => { const L = tl.lines.filter((l) => l.fi === fi); if (L.length) play({ from: L[0].b0, to: L[L.length - 1].b0 + L[L.length - 1].bars }); };
  return (
    <div className="card struct">
      <h3><Ico n="measure" s={28} /> {tx("Structure de la chanson")}<span className="sp" />
        <button className={'btn sm' + (auto ? ' pri' : '')} onClick={() => setForm(null)} title={tx('Retour automatique au refrain après chaque couplet')}><Ic n="loop" /> Auto</button>
      </h3>
      <div className="hint" style={{ marginBottom: 8 }}>{tx('La chanson complète, dans l’ordre joué : {n} sections · ≈ {d}. Le refrain revient après chaque couplet; déplace, ajoute ou enlève des sections.', { n: form.length, d: `${Math.floor(secs / 60)} min ${String(Math.round(secs % 60)).padStart(2, '0')} s` })}</div>
      <div className="struct-list">
        {form.map((bi, i) => (
          <div key={i} className={'struct-row ' + (song.blocks[bi]?.type || '') + (curFi === i ? ' live' : '')}>
            <span className="struct-n">{i + 1}</span>
            <button className="grow struct-name" onClick={() => playFi(i)}><Ic n="play" size={13} fill="currentColor" /> {name(bi)}</button>
            <button className="mini" onClick={() => move(i, -1)} disabled={!i} aria-label={tx('Monter')}>↑</button>
            <button className="mini" onClick={() => move(i, 1)} disabled={i === form.length - 1} aria-label={tx('Descendre')}>↓</button>
            <button className="mini" onClick={() => setForm(form.filter((_, j) => j !== i))} disabled={form.length < 2} aria-label={tx('Enlever')}>×</button>
          </div>
        ))}
      </div>
      {!adding ? <button className="btn wide" style={{ marginTop: 8 }} onClick={() => setAdding(true)}><Ic n="plus" /> {tx('Ajouter une section')}</button> : (
        <div className="chips" style={{ marginTop: 8 }}>
          {song.blocks.map((b, bi) => <button key={bi} className="chip" onClick={() => { setForm([...form, bi]); setAdding(false); }}>{name(bi)}</button>)}
          <button className="chip" onClick={() => setAdding(false)}>×</button>
        </div>
      )}
    </div>
  );
}

function Arrangement({ song, up, preload, onFull }) {
  const [adding, setAdding] = useState(null); // null | 'role' | nom du rôle
  const layers = ensureLayers(song);
  const edit = (id, fn) => up((s) => { const l = ensureLayers(s).find((x) => x.id === id); if (l) fn(l); });
  return (
    <div className="card arr">
      <h3><Ico n="mixer" s={28} /> {tx('Arrangement')}<span className="sp" />
        <button className="btn sm" onClick={() => { up((s) => { s.layers = defaultLayers(s); }); preload(); }} title={tx('Remettre l’arrangement du style')}><Ic n="undo" /></button>
        {onFull && <button className="btn sm pri" onClick={onFull} aria-label={tx('Plein écran')}><Ic n="max" /></button>}
      </h3>
      <div className="hint" style={{ marginBottom: 8 }}>{tx('Instruments de la proposition. Ajoute, enlève ou dose chaque instrument, même pendant que ça joue.')}</div>
      {layers.map((l) => (
        <div key={l.id} className={'arr-row' + (l.on === false ? ' off' : '')}>
          <button className="arr-ico" onClick={() => edit(l.id, (x) => (x.on = x.on === false))} title={l.on === false ? tx('Activer') : tx('Couper')}><Ico n={instIcon(l.role, l.inst)} s={34} dim={l.on === false} /></button>
          <div className="arr-main">
            <select value={l.inst} onChange={(e) => { edit(l.id, (x) => (x.inst = e.target.value)); preload(); }}>
              {ROLES[l.role].insts.map((i) => <option key={i} value={i}>{tx(instName(l.role, i))}</option>)}
            </select>
            <div className="arr-vol">
              <small>{tx(ROLES[l.role].n)}</small>
              <input type="range" min="0" max="1.5" step="0.05" value={l.vol ?? 1} onChange={(e) => edit(l.id, (x) => (x.vol = +e.target.value))} />
              <output>{Math.round((l.vol ?? 1) * 100)} %</output>
            </div>
          </div>
          <button className={'arr-tgl' + (l.on === false ? '' : ' on')} onClick={() => edit(l.id, (x) => (x.on = x.on === false))} aria-label={tx('Couper')}>{l.on === false ? tx('OFF') : tx('ON')}</button>
          <button className="mini" onClick={() => up((s) => (s.layers = ensureLayers(s).filter((x) => x.id !== l.id)))} aria-label={tx('Supprimer')}><Ico n="trash" s={20} /></button>
        </div>
      ))}
      {!adding ? <button className="btn wide" style={{ marginTop: 8 }} onClick={() => setAdding('role')}><Ic n="plus" /> {tx('Ajouter un instrument')}</button> : (
        <div className="arr-add">
          <div className="row"><b>{adding === 'role' ? tx('Quel rôle ?') : tx('Quel instrument ?')}</b><span className="grow" /><button className="mini" onClick={() => setAdding(null)}><Ic n="x" /></button></div>
          <div className="chips" style={{ marginTop: 8 }}>
            {adding === 'role'
              ? Object.entries(ROLES).map(([r, d]) => <button key={r} className="chip" onClick={() => setAdding(r)}><Ico n={d.icon} s={20} /> {tx(d.n)}</button>)
              : ROLES[adding].insts.map((i) => <button key={i} className="chip" onClick={() => { const r = adding; up((s) => ensureLayers(s).push(newLayer(r, i, 0.8))); setAdding(null); preload(); }}><Ico n={instIcon(adding, i)} s={20} /> {tx(instName(adding, i))}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}

function PrintView({ song, me, onClose }) {
  const [mode, setMode] = useState('score');
  const [busy, setBusy] = useState(true);
  const ref = useRef(null);
  const fr = song.fr;
  useEffect(() => {
    if (mode !== 'score' || !ref.current) { setBusy(false); return; }
    setBusy(true);
    renderScore(ref.current, song, { width: Math.min(760, ref.current.clientWidth || 760), fr }).catch((e) => { ref.current.textContent = String(e); }).finally(() => setBusy(false));
  }, [mode]); // eslint-disable-line
  const sheet = mode === 'chords' ? chordSheet(song, fr) : null;
  const keyName = `${(fr ? M.NOTE_FR : M.NOTE_EN)[song.key]} ${tx(song.mode === 'maj' ? 'majeur' : 'mineur')}`;
  return (
    <div className="printview">
      <div className="pv-bar no-print">
        <div className="seg3">
          <button className={mode === 'score' ? 'on' : ''} onClick={() => setMode('score')}>{tx('Partition complète')}</button>
          <button className={mode === 'chords' ? 'on' : ''} onClick={() => setMode('chords')}>{tx('Paroles + accords')}</button>
          <button className={mode === 'lyrics' ? 'on' : ''} onClick={() => setMode('lyrics')}>{tx('Paroles seules')}</button>
        </div>
        <span className="grow" />
        <button className="btn sm pri" onClick={() => window.print()}><Ic n="download" /> {tx('Imprimer / PDF')}</button>
        <button className="btn sm" onClick={onClose}><Ic n="x" /></button>
      </div>
      <div className="sheet-page">
        <div className="sc-head">
          <h1>{song.title}</h1>
          <div className="sc-by">{tx('Paroles et musique')} : {song.artist || me?.artist || me?.name || '—'}</div>
          <div className="sc-meta">{tx(M.STYLES[song.style].n)} · ♩ = {song.bpm} · {tx('Tonalité')} : {keyName}</div>
        </div>
        {mode === 'score' && <>{busy && <div className="no-print hint"><span className="busy" /> {tx('Gravure de la partition…')}</div>}<div ref={ref} className="sc-score" /></>}
        {mode === 'chords' && sheet.map((b, i) => (
          <div key={i} className="cs-block"><div className="sc-sec">{b.label}</div>
            {b.lines.map((l, j) => <div key={j} className="cs-line">{l.map((s, k) => <span key={k} className={'cs-syl' + (s.end ? ' we' : '')}><b>{s.chord || '\u00a0'}</b>{s.t}</span>)}</div>)}
          </div>))}
        {mode === 'lyrics' && song.blocks.map((b, i) => <div key={i} className="cs-block"><div className="sc-sec">{M.localLabel(b.label)}</div>{b.lines.map((l, j) => <div key={j} className="ly-line">{l.text}</div>)}</div>)}
        <div className="sc-foot">Sonyria · sonyria.vercel.app</div>
      </div>
    </div>
  );
}

const GUIDE = [
  { tab: 'paroles', anchor: 'g-lyrics', t: 'Tes paroles', d: 'Écris ou colle ton texte, ou dépose une photo de ton cahier, un PDF ou un fichier Word. Mets [Couplet], [Refrain] ou [Pont] au-dessus de chaque bloc. Le bouton « Corriger avec Sonyria » corrige l’orthographe sans toucher à tes mots.' },
  { tab: 'paroles', anchor: 'g-amb', t: 'L’ambiance', d: 'Touche une des ambiances proposées : tu entends tout de suite un extrait. Tu peux aussi choisir toi-même le style, la tonalité et le tempo juste en dessous.' },
  { tab: 'melodie', anchor: null, t: 'La mélodie', d: 'Écoute les propositions A, B, C, D ou demande une mélodie à Sonyria. Touche un accord pour le changer, ou une syllabe pour monter, descendre ou allonger sa note. Le bouton Partition imprime le tout.' },
  { tab: 'beat', anchor: null, t: 'Le beat', d: 'Choisis la batterie (acoustique, TR-808, LinnDrum), ajuste le tempo et touche les cases de la grille pour créer ton rythme.' },
  { tab: 'studio', anchor: null, t: 'Enregistrer', d: 'Mets des écouteurs, puis enregistre ta voix avec le karaoké qui défile. Tu peux aussi fredonner une mélodie : Sonyria la transcrit et ajoute la musique.' },
  { tab: 'table', anchor: null, t: 'Le mixage', d: 'Monte ou baisse chaque instrument et ta voix avec les faders. Ajoute de l’écho et de la réverb à ta voix dans le Studio.' },
  { tab: 'clip', anchor: null, t: 'Partager', d: 'Crée ton vidéoclip et exporte en MP4 pour TikTok, Reels ou YouTube, ou en WAV. Tes chansons sont sauvegardées automatiquement dans Mes chansons.' },
];

function GuideCard({ step, go, hide }) {
  const g = GUIDE[step];
  return (
    <div className="guide">
      <div className="gsteps">{GUIDE.map((x, i) => <button key={i} className={(i === step ? 'on' : '') + (i < step ? ' done' : '')} onClick={() => go(i)} aria-label={tx(x.t)}>{i < step ? <Ic n="check" size={11} /> : i + 1}</button>)}</div>
      <div className="gbody">
        <div className="gtitle">{tx('Étape {n} sur {t}', { n: step + 1, t: GUIDE.length })} · <b>{tx(g.t)}</b></div>
        <p>{tx(g.d)}</p>
        <div className="row">
          {step > 0 && <button className="btn sm" onClick={() => go(step - 1)}><Ic n="prev" /> {tx('Retour')}</button>}
          <span className="grow" />
          {step < GUIDE.length - 1 ? <button className="btn sm pri" onClick={() => go(step + 1)}>{tx('Étape suivante')} <Ic n="next" /></button>
            : <button className="btn sm pri" onClick={hide}><Ic n="check" /> {tx('J’ai compris')}</button>}
        </div>
      </div>
      <button className="gx" onClick={hide} aria-label={tx('Masquer le guide')}><Ic n="x" size={16} /></button>
    </div>
  );
}

const MAGIC = {
  ocr: ['Créons quelque chose de merveilleux…', 'Tes mots prennent vie…', 'On déchiffre ta plume avec soin…', 'Chaque ligne trouve sa place…', 'Ta chanson se réveille…'],
  compose: ['La magie opère…', 'On cherche la mélodie parfaite…', 'Les notes se posent sur tes mots…', 'Créons quelque chose de merveilleux…'],
  polish: ['On peaufine chaque rime…', 'Tes vers prennent leur envol…', 'Créons quelque chose de merveilleux…'],
  amb: ['On cherche l’ambiance idéale…', 'Chaque style a sa couleur…'],
  clip: ['On imagine ton clip…', 'Lumières, couleurs, action…', 'Créons quelque chose de merveilleux…'],
};
function Magic({ kind }) {
  const list = MAGIC[kind] || MAGIC.ocr;
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % list.length), 2600); return () => clearInterval(t); }, [list.length]);
  return <span className="magic"><span className="sparkle"><Ic n="sparkles" size={16} g /></span><span key={i} className="mtxt">{tx(list[i])}</span></span>;
}

function HumBeat({ eng }) {
  const [st, setSt] = useState({ beat: -1, count: null, lv: 0 });
  useEffect(() => {
    let raf; const d = new Uint8Array(512);
    const f = () => {
      const e = eng.current; const cp = e?.clickPos;
      if (e && cp) {
        const dt = e.ctx.currentTime - cp.T1;
        let lv = 0; const a = e.micAnalyser; if (a) { a.getByteTimeDomainData(d); for (let i = 0; i < d.length; i++) lv = Math.max(lv, Math.abs(d[i] - 128)); }
        setSt({ beat: dt >= 0 ? Math.floor(dt / cp.beat) % 4 : -1, count: dt < 0 ? Math.ceil(-dt / cp.beat) : null, lv: lv / 128 });
      }
      raf = requestAnimationFrame(f);
    };
    f(); return () => cancelAnimationFrame(raf);
  }, [eng]);
  return (
    <div className="humbeat">
      {st.count ? <div className="cnt">{st.count}</div> : <div className="dots">{[0, 1, 2, 3].map((i) => <i key={i} className={st.beat === i ? 'on' : ''} />)}</div>}
      <div className="meter"><i style={{ width: Math.min(100, st.lv * 140) + '%' }} /></div>
    </div>
  );
}

function MicMeter({ eng }) {
  const [lv, setLv] = useState(0);
  useEffect(() => {
    let raf; const d = new Uint8Array(512);
    const f = () => { const a = eng.current?.micAnalyser; if (a) { a.getByteTimeDomainData(d); let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i] - 128)); setLv(m / 128); } raf = requestAnimationFrame(f); };
    f(); return () => cancelAnimationFrame(raf);
  }, [eng]);
  return <div><div className="hint"><Ic n="mic" size={13} /> {tx("Micro actif — niveau")}</div><div className="meter"><i style={{ width: Math.min(100, lv * 140) + '%' }} /></div></div>;
}

function Mixer({ song, up, eng, playing, onFull }) {
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
      <h3><Ico n="mixer" s={28} /> {tx("Table de son")}<span className="sp" />{onFull && <button className="btn sm pri" onClick={onFull}><Ic n="max" /> {tx('Plein écran')}</button>}</h3>
      <div className="console">
        {strips.map(([k, n, i]) => <Strip key={k} name={tx(n)} icon={i} val={m[k]} meter={lv[k]} set={(x) => up((s) => (s.mix[k] = x))} mute={m.mute[k]} solo={m.solo[k]}
          onMute={() => up((s) => (s.mix.mute[k] = !s.mix.mute[k]))} onSolo={() => up((s) => (s.mix.solo[k] = !s.mix.solo[k]))} />)}
        {song.tracks.map((t) => <Strip key={t.id} name={t.name} icon="voice-wave" val={t.vol} meter={lv['tr_' + t.id]} set={(x) => up((s) => (s.tracks.find((y) => y.id === t.id).vol = x))} mute={t.mute} solo={t.solo}
          onMute={() => up((s) => { const y = s.tracks.find((z) => z.id === t.id); y.mute = !y.mute; })} onSolo={() => up((s) => { const y = s.tracks.find((z) => z.id === t.id); y.solo = !y.solo; })}
          extra={<input type="range" className="knob" min="-1" max="1" step="0.05" value={t.pan || 0} title={tx("Panoramique")} onChange={(e) => up((s) => (s.tracks.find((y) => y.id === t.id).pan = +e.target.value))} />} />)}
        <Strip name={tx("Master")} icon="speaker" val={m.master} meter={lv.master} set={(x) => up((s) => (s.mix.master = x))} />
      </div>
      {!playing && <div className="hint" style={{ marginTop: 8 }}>{tx("Lance la lecture pour voir les vumètres bouger.")}</div>}
    </div>
    <div className="card">
      <h3><Ico n="fx" s={28} /> {tx("Effets de la voix guide")}</h3>
      <Slider label="Écho" v={m.leadEcho} min={0} max={0.7} step={0.01} fmt={(x) => Math.round(x * 100)} on={(x) => up((s) => (s.mix.leadEcho = x))} />
      <Slider label="Réverb" v={m.leadReverb} min={0} max={1} step={0.01} fmt={(x) => Math.round(x * 100)} on={(x) => up((s) => (s.mix.leadReverb = x))} />
      <div className="hint">{tx("Les effets de tes prises (écho, réverb, doublage, brillance) se règlent piste par piste dans l’onglet Studio.")}</div>
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
      {onMute && <div className="row nw" style={{ gap: 4 }}><button className="imgtgl" onClick={onMute} aria-label={tx("Muet")}><Ico n="mute-m" s={30} dim={!mute} /></button><button className="imgtgl" onClick={onSolo} aria-label={tx("Solo")}><Ico n="solo" s={30} dim={!solo} /></button></div>}
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
        <button className="icon-btn" onClick={onClose} aria-label={tx("Fermer")}><Ic n="x" /></button>
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

function SongsSheet({ song, me, load, close, say, onCover, onAlbumMp4, coverV, onVersions }) {
  const [list, setList] = useState(null);
  const [arm, setArm] = useState(null);
  const [withRec, setWithRec] = useState(true);
  const [ask, setAsk] = useState(false);
  const [sharing, setSharing] = useState(false);
  const fileIn = useRef(null);
  const hasRec = song.tracks?.some((t) => t.data);
  const doShare = async () => {
    setSharing(true);
    try {
      const f = await songToFile(song, me, withRec);
      const r = await shareFile(f, song.title, tx('Ouvre ce fichier dans Sonyria : Mes chansons → Ouvrir une chanson reçue · sonyria.vercel.app'));
      if (r === 'downloaded') say(tx('Fichier {f} enregistré — envoie-le par courriel, texto ou Messenger', { f: f.name }));
      else if (r === 'shared') say(tx('Chanson partagée'));
    } catch (e) { say(tx('Partage impossible')); }
    setSharing(false);
  };
  const openReceived = async (file) => {
    if (!file) return;
    try {
      const { song: s, from } = await fileToSong(file);
      const d = newSong(''); load({ ...d, ...s, mix: { ...d.mix, ...s.mix }, clip: { ...d.clip, ...s.clip } }); close();
      say(from ? tx('Chanson de {n} ouverte — elle est maintenant dans tes chansons', { n: from }) : tx('Chanson ouverte — elle est maintenant dans tes chansons'));
    } catch (e) { say(tx('Ce fichier n’est pas une chanson Sonyria')); }
  };
  const DEF = tx('Mon album');
  const [media, setMedia] = useState([]);
  const [albums, setAlbums] = useState(() => { try { return JSON.parse(localStorage.getItem('sonyria-albums') || '[]'); } catch (e) { return []; } });
  const [sel, setSel] = useState(() => { try { return song.album || localStorage.getItem('sonyria-album') || DEF; } catch (e) { return DEF; } });
  const [moving, setMoving] = useState(null);
  const [prev, setPrev] = useState(null);
  const refresh = () => { DB.listSongs().then(setList).catch(() => setList([])); DB.listMedia().then(setMedia).catch(() => setMedia([])); };
  useEffect(() => { refresh(); }, []);
  const albOf = (x) => x.album || DEF;
  const allAlbums = [...new Set([DEF, ...albums, ...(list || []).map(albOf), song.album || DEF])];
  const pick = (a) => { setSel(a); try { localStorage.setItem('sonyria-album', a === DEF ? '' : a); } catch (e) {} };
  const saveAlbums = (arr) => { setAlbums(arr); try { localStorage.setItem('sonyria-albums', JSON.stringify(arr)); } catch (e) {} };
  const newAlbum = () => { const n = (prompt(tx('Nom du nouvel album')) || '').trim(); if (!n) return; saveAlbums([...new Set([...albums, n])]); pick(n); };
  const setAlbum = async (id, a) => {
    const v = a === DEF ? '' : a;
    if (id === song.id) song.album = v;
    const r = await DB.getSong(id); if (r) { r.song.album = v; await DB.saveSong(r); }
    setMoving(null); refresh(); say(tx('Rangée dans « {a} »', { a }));
  };
  const renameAlbum = async () => {
    const n = (prompt(tx('Nouveau nom de l’album'), sel) || '').trim(); if (!n || n === sel) return;
    for (const x of list || []) if (albOf(x) === sel) { const r = await DB.getSong(x.id); if (r) { r.song.album = n; await DB.saveSong(r); } }
    if ((song.album || DEF) === sel) song.album = n;
    saveAlbums([...new Set([...albums.filter((x) => x !== sel), n])]); pick(n); refresh();
  };
  const openSong = async (id) => { const r = await DB.getSong(id); if (r) { const d = newSong(''); load({ ...d, ...r.song, mix: { ...d.mix, ...r.song.mix }, clip: { ...d.clip, ...r.song.clip } }); close(); } };
  const mFile = (m) => new File([m.blob], m.name, { type: m.blob.type || (m.kind === 'clip' ? 'video/mp4' : 'audio/mp4') });
  const dl = (m) => { const a = document.createElement('a'); a.href = URL.createObjectURL(m.blob); a.download = m.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); };
  const UP = { youtube: 'https://www.youtube.com/upload', tiktok: 'https://www.tiktok.com/upload', instagram: 'https://www.instagram.com/', facebook: 'https://www.facebook.com/' };
  const shareTo = async (m, where) => {
    const f = mFile(m), title = (list || []).find((x) => x.id === m.songId)?.title || 'Sonyria';
    try { if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title, text: `${title} 🎵 #Sonyria` }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
    dl(m);
    if (where && UP[where]) { window.open(UP[where], '_blank', 'noopener'); say(tx('Fichier téléchargé : dépose-le sur la page qui vient de s’ouvrir')); }
    else say(tx('Fichier téléchargé'));
  };
  const inAlb = (list || []).filter((x) => albOf(x) === sel);
  const fmtSize = (b) => (b > 1e6 ? (b / 1e6).toFixed(1) + ' Mo' : Math.round(b / 1e3) + ' Ko');
  const day = (t) => new Date(t).toLocaleDateString(getLang() === 'en' ? 'en-CA' : 'fr-CA');
  return <>
    <h3><Ico n="disc-note" s={28} /> {tx('Mon album')}</h3>
    <div className="chips alb-tabs">
      {allAlbums.map((a) => <button key={a} className={'chip' + (sel === a ? ' on' : '')} onClick={() => pick(a)}>{a} <small>{(list || []).filter((x) => albOf(x) === a).length}</small></button>)}
      <button className="chip" onClick={newAlbum}><Ic n="plus" size={14} /> {tx('Nouvel album')}</button>
      {sel !== DEF && <button className="chip" onClick={renameAlbum}><Ic n="pen" size={14} /> {tx('Renommer')}</button>}
    </div>
    <div className="alb-head">
      {(() => { const u = loadCover(sel === DEF ? '' : sel); return u ? <img src={u} alt="" className="alb-cover" onClick={() => onCover(sel === DEF ? '' : sel)} /> : <button className="alb-cover empty" onClick={() => onCover(sel === DEF ? '' : sel)}><Ico n="disc-note" s={34} /><small>{tx('Créer ma pochette')}</small></button>; })()}
      <div className="grow">
        <b>{sel}</b>
        <div className="hint">{tx('{n} chanson(s)', { n: inAlb.length })}{me?.artist || me?.name ? ' · ' + (me.artist || me.name) : ''}</div>
        <div className="row" style={{ marginTop: 6 }}>
          <button className="btn sm" onClick={() => onCover(sel === DEF ? '' : sel)}><Ic n="palette" /> {tx('Pochette')}</button>
          <button className="btn sm pri" disabled={!inAlb.length} onClick={() => onAlbumMp4(sel)}><Ico n="play" s={18} /> {tx('Album en MP4')}</button>
        </div>
      </div>
    </div>
    {media.filter((m) => m.songId === 'album:' + (sel === DEF ? '' : sel)).map((m) => <div key={m.id} className="alb-media">
      <div className="row nw"><Ico n="disc-note" s={20} /><div className="grow"><b>{tx('Album complet')}</b><small> · {fmtSize(m.size || m.blob.size)} · {day(m.updated)}</small></div>
        <button className="mini" onClick={() => dl(m)}><Ic n="download" /></button>
        <button className={'tgl' + (arm === m.id ? ' on' : '')} onClick={async () => { if (arm !== m.id) { setArm(m.id); say(tx('Touche encore la corbeille pour supprimer')); return; } await DB.deleteMedia(m.id); setArm(null); refresh(); }}><Ico n="trash" s={20} /></button></div>
      <div className="chips" style={{ marginTop: 6 }}><button className="chip on" onClick={() => shareTo(m)}><Ico n="share" s={16} /> {tx('Partager')}</button><button className="chip" onClick={() => shareTo(m, 'youtube')}>YouTube</button><button className="chip" onClick={() => shareTo(m, 'tiktok')}>TikTok</button><button className="chip" onClick={() => shareTo(m, 'instagram')}>Instagram</button><button className="chip" onClick={() => shareTo(m, 'facebook')}>Facebook</button></div>
    </div>)}
    <div className="hint" style={{ margin: '6px 0 10px' }}>{tx('Tes chansons et tes clips exportés se rangent ici au fur et à mesure. Les nouvelles chansons vont dans l’album choisi.')}</div>
    {ask && <div className="ask-style">
      <b>{tx('On reste dans le même style ?')}</b>
      <div className="hint">{styleLabel(song)}</div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn pri" onClick={() => { const n = freshFrom(song, true); n.album = sel === DEF ? '' : sel; load(n); close(); say(tx('Nouvelle chanson dans le même style')); }}><Ic n="check" /> {tx('Oui, même style')}</button>
        <button className="btn" onClick={() => { const n = freshFrom(song, false); n.album = sel === DEF ? '' : sel; load(n); close(); }}>{tx('Non, nouveau style')}</button>
        <button className="mini" onClick={() => setAsk(false)}><Ic n="x" /></button>
      </div>
    </div>}
    <div className="row" style={{ marginBottom: 10 }}>
      <button className="btn pri" onClick={() => { if (song.lyrics?.trim() || song.tracks?.length) setAsk(true); else { const n = freshFrom(song, false); n.album = sel === DEF ? '' : sel; load(n); close(); } }}>{tx("＋ Nouvelle chanson")}</button>
      <button className="btn" onClick={() => { const c = structuredClone(serialize(song)); c.id = 's' + Date.now(); c.title = song.title + tx(' (copie)'); load(c); close(); say(tx('Copie créée')); }}>{tx("⧉ Dupliquer")}</button>
    </div>
    {list == null ? <span className="busy" /> : !inAlb.length ? <div className="hint">{tx('Cet album est vide pour l’instant.')}</div> :
      inAlb.map((x) => {
        const ms = media.filter((m) => m.songId === x.id);
        return <div key={x.id} className={'alb-song' + (x.id === song.id ? ' cur' : '')}>
          <div className="row nw">
            <button className="grow" style={{ textAlign: 'left' }} onClick={() => openSong(x.id)}>
              <b>{x.title || tx('Sans titre')}</b>{x.id === song.id && <span className="badge" style={{ marginLeft: 6 }}>{tx("ouverte")}</span>}
              <div className="hint">{x.style ? tx(M.STYLES[x.style]?.n || x.style) + ' · ' : ''}{tx('{n} lignes', { n: x.lines || 0 })} · {day(x.updated)}</div>
            </button>
            <button className="btn sm" onClick={() => onVersions(x.id)}>{tx('Versions')}</button>
            <button className="mini" onClick={() => setMoving(moving === x.id ? null : x.id)} aria-label={tx('Changer d’album')}><Ico n="folder" s={20} /></button>
            <button className={'tgl' + (arm === x.id ? ' on' : '')} onClick={async () => {
              if (arm !== x.id) { setArm(x.id); say(tx('Touche encore la corbeille pour supprimer')); return; }
              if (!confirm(tx('Supprimer « {t} » avec toutes ses versions et ses clips ? C’est définitif.', { t: x.title || tx('Sans titre') }))) { setArm(null); return; }
              await DB.deleteSong(x.id); setArm(null); refresh();
              if (x.id === song.id) { load(newSong('')); say(tx('Chanson supprimée — page blanche prête')); } else say(tx('Chanson supprimée'));
            }} aria-label={tx("Supprimer")}><Ico n="trash" s={22} /></button>
          </div>
          {moving === x.id && <div className="chips" style={{ marginTop: 6 }}>
            {allAlbums.filter((a) => a !== albOf(x)).map((a) => <button key={a} className="chip" onClick={() => setAlbum(x.id, a)}>→ {a}</button>)}
            <button className="chip" onClick={async () => { const n = (prompt(tx('Nom du nouvel album')) || '').trim(); if (n) { saveAlbums([...new Set([...albums, n])]); await setAlbum(x.id, n); } }}><Ic n="plus" size={14} /> {tx('Nouvel album')}</button>
          </div>}
          {ms.map((m) => <div key={m.id} className="alb-media">
            <div className="row nw">
              <button className="mini" onClick={() => setPrev(prev?.id === m.id ? null : { id: m.id, url: URL.createObjectURL(m.blob) })}><Ico n={m.kind === 'clip' ? 'play' : 'disc-note'} s={20} /></button>
              <div className="grow"><b>{m.kind === 'clip' ? tx('Vidéoclip') : m.kind === 'wav' ? 'WAV' : tx('Audio')}</b><small> · {fmtSize(m.size || m.blob.size)} · {day(m.updated)}</small></div>
              <button className="mini" onClick={() => dl(m)} aria-label={tx('Télécharger')}><Ic n="download" /></button>
              <button className={'tgl' + (arm === m.id ? ' on' : '')} onClick={async () => { if (arm !== m.id) { setArm(m.id); say(tx('Touche encore la corbeille pour supprimer')); return; } await DB.deleteMedia(m.id); setArm(null); refresh(); }} aria-label={tx('Supprimer')}><Ico n="trash" s={20} /></button>
            </div>
            {prev?.id === m.id && (m.kind === 'clip' ? <video src={prev.url} controls playsInline className="alb-prev" /> : <audio src={prev.url} controls style={{ width: '100%', marginTop: 6 }} />)}
            <div className="chips" style={{ marginTop: 6 }}>
              <button className="chip on" onClick={() => shareTo(m)}><Ico n="share" s={16} /> {tx('Partager')}</button>
              {m.kind === 'clip' && <>
                <button className="chip" onClick={() => shareTo(m, 'youtube')}>YouTube</button>
                <button className="chip" onClick={() => shareTo(m, 'tiktok')}>TikTok</button>
                <button className="chip" onClick={() => shareTo(m, 'instagram')}>Instagram</button>
                <button className="chip" onClick={() => shareTo(m, 'facebook')}>Facebook</button>
              </>}
            </div>
          </div>)}
          {!ms.length && x.id === song.id && <div className="hint" style={{ marginTop: 4 }}>{tx('Exporte un clip ou un audio (onglet Clip) : il apparaîtra ici, prêt à partager.')}</div>}
        </div>;
      })}
    <div className="share-box" style={{ marginTop: 14 }}>
      <b><Ico n="share" s={22} /> {tx('Partager avec quelqu’un qui a Sonyria')}</b>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn pri" disabled={sharing} onClick={doShare}>{sharing ? <span className="busy" /> : <Ico n="share" s={20} />} {tx('Partager « {t} »', { t: song.title || tx('Sans titre') })}</button>
        <button className="btn" onClick={() => fileIn.current?.click()}><Ico n="upload" s={20} /> {tx('Ouvrir une chanson reçue')}</button>
        <input ref={fileIn} type="file" accept=".sonyria,.json,application/octet-stream" hidden onChange={(e) => { openReceived(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {hasRec && <label className="row" style={{ fontSize: 12.5, marginTop: 6 }}><input type="checkbox" checked={withRec} onChange={(e) => setWithRec(e.target.checked)} /> {tx('Inclure mes enregistrements de voix (fichier plus gros)')}</label>}
      <div className="hint" style={{ marginTop: 6 }}>{tx('Tout est inclus : paroles, mélodie, accords, beat, instruments et structure. L’autre personne ouvre le fichier .sonyria dans son app et peut le modifier.')}</div>
    </div>
    {list?.length > 0 && <button className="btn sm" style={{ color: 'var(--pink)', marginTop: 12 }} onClick={async () => {
      if (arm !== 'all') { setArm('all'); say(tx('Touche encore pour tout supprimer')); return; }
      if (!confirm(tx('Tout supprimer : toutes les chansons, versions et clips ? C’est définitif.'))) { setArm(null); return; }
      for (const x of list) await DB.deleteSong(x.id);
      for (const m of media) await DB.deleteMedia(m.id);
      setArm(null); refresh(); load(newSong('')); say(tx('Tout a été supprimé'));
    }}><Ico n="trash" s={18} /> {arm === 'all' ? tx('Confirmer : tout supprimer') : tx('Tout supprimer (toutes les chansons et clips)')}</button>}
  </>;
}

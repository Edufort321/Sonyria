// Sonyria — import d'un MP4/audio : séparation voix/instrumental, tempo, tonalité, accords, transcription, reconstruction
import * as M from './music';

// ---------- séparation (méthode du canal central) ----------
function onePoleLP(x, sr, fc) {
  const a = Math.exp((-2 * Math.PI * fc) / sr), y = new Float32Array(x.length);
  let p = 0; for (let i = 0; i < x.length; i++) { p = (1 - a) * x[i] + a * p; y[i] = p; } return y;
}
export function separate(buf) {
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const n = L.length, sr = buf.sampleRate;
  const mono = new Float32Array(n), side = new Float32Array(n);
  for (let i = 0; i < n; i++) { mono[i] = (L[i] + R[i]) / 2; side[i] = (L[i] - R[i]) / 2; }
  const stereo = buf.numberOfChannels > 1 && side.some((v, i) => i % 997 === 0 && Math.abs(v) > 1e-3);
  if (!stereo) return { mono, voice: mono, inst: null, sr, stereo: false };
  // instrumental = côtés + graves du centre (la voix est presque toujours au centre)
  const lowMid = onePoleLP(mono, sr, 160);
  const inst = new Float32Array(n);
  for (let i = 0; i < n; i++) inst[i] = side[i] * 1.4 + lowMid[i];
  // voix ≈ centre sans les graves ni les côtés
  const voice = new Float32Array(n);
  const hi = onePoleLP(mono, sr, 7000);
  for (let i = 0; i < n; i++) voice[i] = hi[i] - lowMid[i];
  return { mono, voice, inst, sr, stereo: true };
}

// ---------- FFT ----------
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j], vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr; im[i + j] = ui + vi; re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
function downsample(x, sr, target = 11025) {
  const f = Math.max(1, Math.round(sr / target)), out = new Float32Array(Math.floor(x.length / f));
  for (let i = 0; i < out.length; i++) { let s = 0; for (let k = 0; k < f; k++) s += x[i * f + k]; out[i] = s / f; }
  return { x: out, sr: sr / f };
}
function chromaAt(ds, t0, t1) {
  const N = 4096, ch = new Float32Array(12);
  const hann = chromaAt.h || (chromaAt.h = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)));
  for (let t = t0; t + N / ds.sr <= t1 + 0.01; t += 0.18) {
    const a = Math.floor(t * ds.sr); if (a + N > ds.x.length) break;
    const re = new Float32Array(N), im = new Float32Array(N);
    for (let i = 0; i < N; i++) re[i] = ds.x[a + i] * hann[i];
    fft(re, im);
    for (let k = Math.ceil((60 * N) / ds.sr); k < (1100 * N) / ds.sr; k++) {
      const f = (k * ds.sr) / N, mag = Math.hypot(re[k], im[k]);
      const pc = M.mod(Math.round(12 * Math.log2(f / 440)) + 9, 12);
      ch[pc] += mag;
    }
  }
  const mx = Math.max(...ch, 1e-9);
  return ch.map((v) => v / mx);
}
const MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
function corr(a, b) { const ma = a.reduce((x, y) => x + y) / 12, mb = b.reduce((x, y) => x + y) / 12; let n = 0, da = 0, db = 0; for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return n / Math.sqrt(da * db || 1); }

// ---------- tempo, temps fort, tonalité, accords ----------
export function analyzeMusic(mono, sr) {
  const bpm = M.detectBpm(mono, sr) || 100;
  // enveloppe d'attaques (10 ms) pour trouver le 1er temps fort
  const hop = Math.round(sr * 0.01), env = []; let prev = 0;
  for (let i = 0; i + hop < mono.length; i += hop) { let s = 0; for (let j = 0; j < hop; j += 2) s += mono[i + j] ** 2; const e = Math.sqrt(s / (hop / 2)); env.push(Math.max(0, e - prev)); prev = e; }
  const P = 6000 / bpm, bar = 4 * P;
  let bestPh = 0, best = -1;
  for (let ph = 0; ph < bar; ph++) {
    let s = 0; for (let k = 0; ph + k * bar < env.length; k++) { s += env[Math.round(ph + k * bar)] || 0; s += 0.4 * (env[Math.round(ph + k * bar + 2 * P)] || 0); }
    if (s > best) { best = s; bestPh = ph; }
  }
  const phase = bestPh * 0.01;
  const ds = downsample(mono, sr);
  const dur = mono.length / sr, barDur = 240 / bpm;
  const total = chromaAt(ds, 0, dur);
  let key = 0, mode = 'maj', bk = -2;
  for (let k = 0; k < 12; k++) {
    const rot = (p) => Array.from({ length: 12 }, (_, i) => p[M.mod(i - k, 12)]);
    const cM = corr(total, rot(MAJ)), cm = corr(total, rot(MIN));
    if (cM > bk) { bk = cM; key = k; mode = 'maj'; }
    if (cm > bk) { bk = cm; key = k; mode = 'min'; }
  }
  // accord par mesure (degrés diatoniques de la tonalité)
  const chords = [];
  for (let b = 0; phase + b * barDur < dur; b++) {
    const c = chromaAt(ds, phase + b * barDur, phase + (b + 1) * barDur);
    let bd = 1, bs = -1;
    for (let d = 1; d <= 7; d++) {
      const { pc, q } = M.chordInfo(d, key, mode);
      const third = M.mod(pc + (q === '' ? 4 : 3), 12), fifth = M.mod(pc + (q === 'dim' ? 6 : 7), 12);
      const s = c[pc] * 1.25 + c[third] + c[fifth] * 0.8 - 0.3 * (c.reduce((a, v) => a + v, 0) - c[pc] - c[third] - c[fifth]) / 9 + (d === 1 || d === 4 || d === 5 || d === 6 ? 0.05 : 0);
      if (s > bs) { bs = s; bd = d; }
    }
    chords.push(bd);
  }
  return { bpm, phase, key, mode, chords, duration: dur };
}

// ---------- transcription (Whisper dans le navigateur) ----------
let asrPromise = null;
export async function transcribe(voice, sr, onProgress) {
  // rééchantillonnage 16 kHz
  const len = Math.ceil((voice.length * 16000) / sr);
  const oc = new OfflineAudioContext(1, len, 16000);
  const b = oc.createBuffer(1, voice.length, sr); b.getChannelData(0).set(voice);
  const s = oc.createBufferSource(); s.buffer = b; s.connect(oc.destination); s.start();
  const pcm = (await oc.startRendering()).getChannelData(0);
  if (!asrPromise) {
    asrPromise = (async () => {
      const T = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
      T.env.allowLocalModels = false;
      return T.pipeline('automatic-speech-recognition', 'onnx-community/whisper-base', {
        dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, device: 'wasm',
        progress_callback: (p) => { if (p.status === 'progress' && p.file?.endsWith('.onnx')) onProgress?.(`Téléchargement du modèle de transcription… ${Math.round(p.progress)} %`); },
      });
    })().catch((e) => { asrPromise = null; throw e; });
  }
  const asr = await asrPromise;
  onProgress?.('Transcription des paroles… (peut prendre 1 à 3 minutes)');
  const out = await asr(pcm, { language: 'french', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
  return (out.chunks || [{ text: out.text, timestamp: [0, pcm.length / 16000] }])
    .map((c) => ({ text: c.text.trim(), start: c.timestamp[0] ?? 0, end: c.timestamp[1] ?? (c.timestamp[0] ?? 0) + 3 }))
    .filter((c) => c.text && !/^\[.*\]$|^\(.*\)$|♪/.test(c.text));
}

// ---------- reconstruction de la chanson ----------
function syllableCount(text) { return M.syllabifyLine(text).length; }

export function buildSong(song, A, segs, voice, sr) {
  const barDur = 240 / A.bpm, d16 = barDur / 16;
  // 1) segments -> vers (≤ 12 syllabes), temps répartis au prorata des syllabes
  const lines = [];
  segs.forEach((sg) => {
    const words = sg.text.split(/\s+/).filter(Boolean);
    const total = Math.max(1, syllableCount(sg.text));
    let cur = [], cnt = 0, t = sg.start;
    const flush = () => { if (!cur.length) return; const txt = cur.join(' '); const n = syllableCount(txt); const d = ((sg.end - sg.start) * n) / total; lines.push({ text: txt.replace(/^[a-zà-ÿ]/, (c) => c.toUpperCase()), start: t, end: t + d }); t += d; cur = []; cnt = 0; };
    words.forEach((w) => { const n = syllableCount(w); if (cnt + n > 12 && cnt >= 5) flush(); cur.push(w); cnt += n; if (/[.!?;]$/.test(w) && cnt >= 5) flush(); });
    flush();
  });
  if (!lines.length) throw new Error('Aucune parole détectée');
  // 2) vers -> sections (pause > 1,5 mesure ou 8 vers)
  const blocks = []; let cur = null;
  lines.forEach((l, i) => {
    const gap = i ? l.start - lines[i - 1].end : 99;
    if (!cur || gap > barDur * 1.5 || cur.length >= 8) { cur = []; blocks.push(cur); }
    cur.push(l);
  });
  const norm = (b) => b.map((l) => l.text).join(' ').toLowerCase().replace(/[^a-zà-ÿ ]/g, '');
  const sim = (a, b) => { const A1 = new Set(norm(a).split(' ')), B1 = new Set(norm(b).split(' ')); let n = 0; A1.forEach((w) => B1.has(w) && n++); return n / Math.max(1, Math.min(A1.size, B1.size)); };
  let v = 0;
  const heads = blocks.map((b, i) => (blocks.some((o, j) => j !== i && sim(b, o) > 0.6) ? '[Refrain]' : `[Couplet ${++v}]`));
  song.lyrics = blocks.map((b, i) => heads[i] + '\n' + b.map((l) => l.text).join('\n')).join('\n\n');
  song.blocks = M.parseLyrics(song.lyrics);
  // 3) syllabes calées sur les attaques de la voix + hauteur chantée
  const all = [];
  lines.forEach((L) => {
    const syls = M.syllabifyLine(L.text);
    const a = Math.max(0, Math.floor((L.start - 0.15) * sr)), z = Math.min(voice.length, Math.floor((L.end + 0.2) * sr));
    let on = M.detectOnsets(voice.subarray(a, z), sr).onsets.map((o) => ({ t: o.t + a / sr, s: o.s }));
    while (on.length > syls.length) { let wi = 0; on.forEach((o, i) => { if (o.s < on[wi].s) wi = i; }); on.splice(wi, 1); }
    if (on.length < syls.length) on = syls.map((_, i) => ({ t: L.start + ((L.end - L.start) * i) / syls.length }));
    on.sort((x, y) => x.t - y.t);
    all.push({ L, syls, times: on.map((o) => o.t) });
  });
  const pitchesAll = all.map((x) => x.times.map((t, i) => M.detectPitch(voice, sr, t + 0.03, Math.min(x.times[i + 1] ?? t + 0.5, t + 0.6))));
  const valid = pitchesAll.flat().filter(Boolean).sort((a, b) => a - b);
  const med = valid[Math.floor(valid.length / 2)];
  song.key = A.key; song.mode = A.mode; song.bpm = A.bpm;
  const shift = med ? Math.round((M.tonicMidi(A.key) + 5 - med) / 12) * 12 : 0;
  // 4) mesures contiguës à partir du 1er vers (temps chanson = temps audio − phase)
  const st = (t) => Math.round((t - A.phase) / d16);
  let B = Math.max(0, Math.floor(st(all[0].times[0]) / 16));
  song.introBars = B; song.introChords = A.chords.slice(0, B);
  let k = 0;
  song.blocks.forEach((b) => b.lines.forEach((line) => {
    const x = all[k], ps = pitchesAll[k], nx = all[k + 1]; k++;
    if (!x) return;
    const base = B * 16;
    const local = x.times.map((t) => Math.max(0, st(t) - base));
    for (let j = 1; j < local.length; j++) if (local[j] <= local[j - 1]) local[j] = local[j - 1] + 1;
    const lastL = local[local.length - 1];
    const nextFirst = nx ? st(nx.times[0]) : null;
    let bars = nextFirst !== null ? Math.max(Math.floor(nextFirst / 16), B + Math.floor(lastL / 16) + 1) - B : Math.ceil((lastL + 4) / 16);
    bars = Math.max(1, Math.min(8, bars));
    const L16 = bars * 16, endStep = nextFirst !== null ? nextFirst - base : lastL + 4;
    const notes = []; let prevEnd = 0;
    // si le nombre de syllabes diffère du découpage de l'app, on étire les temps
    const n = line.syls.length;
    for (let j = 0; j < n; j++) {
      const src = Math.min(local.length - 1, Math.floor((j * local.length) / n));
      const s0 = Math.min(Math.max(local[src], prevEnd), L16 - 1);
      const nxs = j < n - 1 ? local[Math.min(local.length - 1, Math.floor(((j + 1) * local.length) / n))] : Math.min(L16, Math.max(endStep, s0 + 1));
      const dur = Math.max(1, Math.min(8, nxs - s0, L16 - s0));
      const pm = ps[src];
      notes.push({ p: pm ? M.midiToPos(pm + shift, A.key, A.mode) : 2, rest: Math.max(0, s0 - prevEnd), dur });
      prevEnd = s0 + dur;
    }
    line.bars = bars; line.notes = notes; line.custom = true;
    line.chords = Array.from({ length: bars }, (_, i) => A.chords[B + i] || 1);
    B += bars;
  }));
  song.intro = false;
  return song;
}

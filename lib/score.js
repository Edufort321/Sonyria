// Sonyria — partition imprimable : mélodie (portée en clé de sol), accords au-dessus, paroles sous les notes
import * as M from './music';

let VF = null;
async function vex() {
  if (!VF) {
    VF = await import('vexflow/bravura');
    try { await document.fonts.load('30px Bravura'); await document.fonts.load('12px Academico'); } catch (e) {}
  }
  return VF;
}

const FLAT_MAJ = [5, 10, 3, 8, 1, 6], FLAT_MIN = [2, 7, 0, 5, 10, 3];
const SHARP_N = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const FLAT_N = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];
const KEY_MAJ = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const KEY_MIN = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
export const keySpec = (key, mode) => (mode === 'maj' ? KEY_MAJ : KEY_MIN)[key];
const useFlats = (key, mode) => (mode === 'maj' ? FLAT_MAJ : FLAT_MIN).includes(key);
function vfKey(midi, flats) { const n = (flats ? FLAT_N : SHARP_N)[M.mod(midi, 12)]; return `${n}/${Math.floor(midi / 12) - 1}`; }

// durées en doubles-croches -> valeurs VexFlow
const DUR = { 16: ['w', 0], 12: ['h', 1], 8: ['h', 0], 6: ['q', 1], 4: ['q', 0], 3: ['8', 1], 2: ['8', 0], 1: ['16', 0] };
function split(len, pos) {
  // découpe une durée en valeurs standard, en respectant les temps (pos = position dans la mesure)
  const out = [];
  while (len > 0) {
    let pick = 1;
    for (const d of [16, 12, 8, 6, 4, 3, 2, 1]) {
      if (d > len) continue;
      const aligned = d >= 8 ? pos % 8 === 0 : d >= 4 ? pos % 4 === 0 || d === 6 && pos % 2 === 0 : d >= 2 ? pos % 2 === 0 || d === 3 : true;
      if (aligned) { pick = d; break; }
    }
    out.push(pick); len -= pick; pos += pick;
  }
  return out;
}

// événements d'un vers : notes et silences, coupés aux barres de mesure
function lineEvents(line, song) {
  const L16 = line.bars * 16, ev = [];
  let t = 0;
  (line.notes || []).forEach((n, i) => {
    if (n.rest > 0) { ev.push({ t, len: n.rest, rest: true }); t += n.rest; }
    const syl = line.syls[i];
    ev.push({ t, len: n.dur, midi: M.posToMidi(n.p, song.key, song.mode), syl: syl ? syl.t + (syl.end ? '' : ' -') : '' });
    t += n.dur;
  });
  if (t < L16) ev.push({ t, len: L16 - t, rest: true });
  // découpe aux barres + valeurs standard
  const bars = Array.from({ length: line.bars }, () => []);
  ev.forEach((e) => {
    let start = e.t, left = Math.min(e.len, L16 - e.t), first = true, prev = null;
    while (left > 0) {
      const b = Math.floor(start / 16), pos = start % 16, inBar = Math.min(left, 16 - pos);
      split(inBar, pos).forEach((d) => {
        const item = { ...e, d, first, tieFrom: prev };
        if (b < bars.length) bars[b].push(item);
        prev = e.rest ? null : item; first = false;
      });
      start += inBar; left -= inBar;
    }
  });
  return bars;
}

export async function renderScore(root, song, { width = 760, fr = false } = {}) {
  const V = await vex();
  const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Annotation, StaveTie, Beam, Dot } = V;
  root.innerHTML = '';
  const flats = useFlats(song.key, song.mode), spec = keySpec(song.key, song.mode);
  let firstLine = true;
  song.blocks.forEach((b) => {
    const h = document.createElement('div'); h.className = 'sc-sec'; h.textContent = M.localLabel(b.label); root.appendChild(h);
    b.lines.forEach((line) => {
      if (!line.notes || !line.chords) return;
      const bars = lineEvents(line, song);
      const box = document.createElement('div'); box.className = 'sc-line'; root.appendChild(box);
      const H = 150, r = new Renderer(box, Renderer.Backends.SVG); r.resize(width, H);
      const ctx = r.getContext(); ctx.setFont('Academico', 11);
      const lead = firstLine ? 110 : 80, bw = (width - lead - 10) / line.bars;
      const allNotes = [], ties = [];
      bars.forEach((items, bi) => {
        const stave = new Stave(bi === 0 ? 5 : 5 + lead + bw * bi, 30, bi === 0 ? lead + bw : bw);
        if (bi === 0) { stave.addClef('treble').addKeySignature(spec); if (firstLine) stave.addTimeSignature('4/4'); }
        stave.setContext(ctx).draw();
        const notes = items.map((it) => {
          const [dur, dots] = DUR[it.d];
          const n = it.rest ? new StaveNote({ keys: ['b/4'], duration: dur + 'r' }) : new StaveNote({ keys: [vfKey(it.midi, flats)], duration: dur, autoStem: true });
          for (let k = 0; k < dots; k++) Dot.buildAndAttach([n], { all: true });
          if (!it.rest && it.first && it.syl) n.addModifier(new Annotation(it.syl).setFont('Sora', 11).setVerticalJustification(Annotation.VerticalJustify.BOTTOM), 0);
          if (it.tieFrom) ties.push([it.tieFrom.vf, n]);
          it.vf = n; return n;
        });
        // accord au-dessus de la mesure
        const ch = line.chords[bi];
        if (notes[0] && ch) notes[0].addModifier(new Annotation(M.chordName(ch, song.key, song.mode, fr)).setFont('Sora', 13, 'bold').setVerticalJustification(Annotation.VerticalJustify.TOP), 0);
        const voice = new Voice({ numBeats: 4, beatValue: 4 }).setMode(Voice.Mode.SOFT).addTickables(notes);
        Accidental.applyAccidentals([voice], spec);
        const beams = Beam.generateBeams(notes.filter((n) => !n.isRest()), { groups: [new V.Fraction(2, 8)] });
        new Formatter().joinVoices([voice]).format([voice], Math.max(40, stave.getNoteEndX() - stave.getNoteStartX() - 10));
        voice.draw(ctx, stave);
        beams.forEach((bm) => bm.setContext(ctx).draw());
        allNotes.push(...notes);
      });
      ties.forEach(([a, c]) => { try { new StaveTie({ firstNote: a, lastNote: c, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw(); } catch (e) {} });
      firstLine = false;
    });
  });
}

// version « paroles + accords » (pour guitare / piano) : l'accord au-dessus de la syllabe où il commence
export function chordSheet(song, fr) {
  return song.blocks.map((b) => ({
    label: M.localLabel(b.label),
    lines: b.lines.map((l) => {
      const marks = {}; let t = 0;
      (l.notes || []).forEach((n, i) => { t += n.rest || 0; const bar = Math.floor(t / 16); if (marks[bar] == null) marks[bar] = i; t += n.dur; });
      const chordAt = {};
      (l.chords || []).forEach((c, bi) => { const idx = marks[bi] ?? (l.syls.length - 1); const nm = M.chordName(c, song.key, song.mode, fr); chordAt[idx] = chordAt[idx] ? chordAt[idx] + ' ' + nm : nm; });
      return l.syls.map((s, i) => ({ t: s.t, end: s.end, chord: chordAt[i] || '' }));
    }),
  }));
}

// Sonyria — instruments échantillonnés (vrais enregistrements), chargés à la demande et partagés entre contextes audio
let MAN = null;
const BUF = {}; // BUF[nom][midi] = AudioBuffer ; BUF['kit:808'][kick] = AudioBuffer
const LOADING = {};

export const INSTRUMENTS = {
  piano: 'Piano à queue', epiano: 'Piano Rhodes', guitar: 'Guitare acoustique', nylon: 'Guitare classique', eguitar: 'Guitare électrique',
  drive: 'Guitare saturée', strings: 'Cordes', choir: 'Chœur', sax: 'Saxophone ténor', altosax: 'Saxophone alto', trumpet: 'Trompette', flute: 'Flûte',
  bass: 'Basse électrique', upright: 'Contrebasse',
};
export const KITS = { acoustic: 'Batterie acoustique', '808': 'TR-808', linn: 'LinnDrum', synth: 'Synthétique' };
export const KIT_PIECES = ['kick', 'snare', 'clap', 'hat', 'open', 'crash', 'tom'];

async function manifest() {
  if (!MAN) MAN = await fetch('/samples/instruments.json').then((r) => r.json()).catch(() => ({}));
  return MAN;
}
async function decode(ctx, url) {
  const r = await fetch(url); if (!r.ok) throw new Error(url);
  const ab = await r.arrayBuffer();
  return await new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
}
export function loadInstrument(ctx, name) {
  if (BUF[name] || !INSTRUMENTS[name]) return Promise.resolve();
  if (!LOADING[name]) LOADING[name] = (async () => {
    const m = await manifest();
    const keys = m[name] || [];
    const out = {};
    await Promise.all(keys.map(async (k) => { try { out[k] = await decode(ctx, `/samples/${name}/${k}.m4a`); } catch (e) {} }));
    if (Object.keys(out).length) BUF[name] = out;
  })();
  return LOADING[name];
}
export function loadKit(ctx, kit) {
  const id = 'kit:' + kit;
  if (kit === 'synth' || BUF[id]) return Promise.resolve();
  if (!LOADING[id]) LOADING[id] = (async () => {
    const out = {};
    await Promise.all(KIT_PIECES.map(async (k) => { try { out[k] = await decode(ctx, `/samples/drums/${kit}/${k}.m4a`); } catch (e) {} }));
    BUF[id] = out;
  })();
  return LOADING[id];
}
export const hasInstrument = (name) => !!BUF[name];
// échantillon le plus proche + vitesse de lecture pour atteindre la note
export function pick(name, midi) {
  const b = BUF[name]; if (!b) return null;
  let best = null, bd = 1e9;
  for (const k in b) { const d = Math.abs(+k - midi) + (+k < midi ? 0.1 : 0); if (d < bd) { bd = d; best = +k; } }
  return best == null ? null : { buffer: b[best], rate: Math.pow(2, (midi - best) / 12) };
}
export const kitPiece = (kit, piece) => BUF['kit:' + kit]?.[piece] || null;

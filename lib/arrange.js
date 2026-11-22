// Sonyria — arrangement : liste des instruments (couches) qu'on peut ajouter, enlever et doser en direct
import { STYLES } from './music';

export const ROLES = {
  drums: { n: 'Batterie', icon: 'drumkit', insts: ['acoustic', '808', 'linn', 'synth'] },
  bass: { n: 'Basse', icon: 'bass', insts: ['bass', 'upright', 'synth'] },
  chords: { n: 'Accords', icon: 'piano', insts: ['piano', 'epiano', 'pluck', 'nylon', 'eguitar', 'power', 'strings', 'choir', 'synthpad', 'supersaw'] },
  pad: { n: 'Nappe (accords tenus)', icon: 'wave-blue', insts: ['strings', 'choir', 'synthpad', 'epiano'] },
  arp: { n: 'Arpèges', icon: 'pad-grid', insts: ['piano', 'epiano', 'nylon', 'pluck', 'eguitar'] },
  melody: { n: 'Mélodie', icon: 'note', insts: ['voix', 'piano', 'sax', 'altosax', 'trumpet', 'flute', 'guitar', 'nylon', 'strings', 'synth'] },
  harmony: { n: 'Contre-chant (tierce)', icon: 'wave-pink', insts: ['voix', 'strings', 'sax', 'altosax', 'trumpet', 'flute', 'piano', 'synth'] },
};

// noms affichés (clé = son, selon le rôle)
const NAMES = {
  drums: { acoustic: 'Batterie acoustique', '808': 'TR-808', linn: 'LinnDrum', synth: 'Batterie synthétique' },
  bass: { bass: 'Basse électrique', upright: 'Contrebasse', synth: 'Basse synthé 808' },
  any: {
    piano: 'Piano à queue', epiano: 'Piano Rhodes', pluck: 'Guitare acoustique', nylon: 'Guitare classique', eguitar: 'Guitare électrique', guitar: 'Guitare électrique',
    power: 'Guitare saturée', strings: 'Cordes', choir: 'Chœur', synthpad: 'Nappe synthé', supersaw: 'Supersaw', voix: 'Chœur (aah)', sax: 'Saxophone ténor',
    altosax: 'Saxophone alto', trumpet: 'Trompette', flute: 'Flûte', synth: 'Synthé',
  },
};
export const instName = (role, inst) => (NAMES[role] && NAMES[role][inst]) || NAMES.any[inst] || inst;
const ICONS = {
  piano: 'piano', epiano: 'keyboard', pluck: 'guitar-acoustic', nylon: 'guitar-acoustic', eguitar: 'guitar-electric', guitar: 'guitar-electric', power: 'guitar-electric',
  strings: 'violin', choir: 'microphone', voix: 'microphone', synthpad: 'synth', supersaw: 'synth', synth: 'synth', sax: 'sax', altosax: 'sax', trumpet: 'trumpet',
  flute: 'flute', bass: 'bass', upright: 'bass', acoustic: 'drumkit', '808': 'pads', linn: 'pads',
};
export const instIcon = (role, inst) => (role === 'drums' && inst === 'synth' ? 'synth' : ICONS[inst] || ROLES[role]?.icon || 'note');

const STYLE_KIT = { pop: 'acoustic', ballade: 'acoustic', rock: 'acoustic', folk: 'acoustic', jazz: 'acoustic', afro: 'acoustic', hiphop: '808', trap: '808', rnb: '808', reggaeton: '808', edm: '808', lofi: 'linn' };
const STYLE_BASS = { jazz: 'upright', folk: 'upright', trap: 'synth', hiphop: 'synth', edm: 'synth' };
// instruments ajoutés par défaut selon le style (en plus de batterie, basse, accords, mélodie)
const STYLE_EXTRA = {
  ballade: [{ role: 'pad', inst: 'strings', vol: 0.6 }],
  pop: [{ role: 'arp', inst: 'pluck', vol: 0.45 }],
  rnb: [{ role: 'pad', inst: 'synthpad', vol: 0.5 }],
  folk: [{ role: 'arp', inst: 'nylon', vol: 0.5 }],
  jazz: [],
  lofi: [{ role: 'pad', inst: 'synthpad', vol: 0.45 }],
  edm: [{ role: 'arp', inst: 'piano', vol: 0.4 }],
  trap: [{ role: 'arp', inst: 'piano', vol: 0.35 }],
};
const STYLE_CHORD = { pop: 'piano', ballade: 'piano', hiphop: 'epiano', trap: 'synthpad', rnb: 'epiano', rock: 'power', folk: 'pluck', reggaeton: 'nylon', afro: 'nylon', edm: 'supersaw', lofi: 'epiano', jazz: 'epiano' };

let uid = 0;
const mk = (role, inst, vol = 1) => ({ id: `${role}-${Date.now().toString(36)}-${uid++}`, role, inst, vol, on: true });

export function defaultLayers(song) {
  const st = song.style, sty = STYLES[st];
  const L = [
    mk('drums', song.kit || STYLE_KIT[st] || 'acoustic', 1),
    mk('bass', STYLE_BASS[st] || 'bass', 1),
    mk('chords', song.chordSound || STYLE_CHORD[st] || sty.chord, 0.9),
    ...(STYLE_EXTRA[st] || []).map((x) => mk(x.role, x.inst, x.vol)),
    mk('melody', song.leadSound || sty.lead || 'voix', 1),
  ];
  if (song.harmony && song.harmony !== 'off') L.push(mk('harmony', song.leadSound || 'voix', 0.7));
  return L;
}
export function ensureLayers(song) { if (!Array.isArray(song.layers) || !song.layers.length) song.layers = defaultLayers(song); return song.layers; }
export const newLayer = mk;

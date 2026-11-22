// Sonyria — synchro par code : entre mes appareils (tout) et avec une équipe (un album partagé)
import * as DB from './storage';
import { songToFile, fileToSong } from './share';
import { loadCover, saveCover } from './cover';

const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

export function newCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(12));
  let s = ''; r.forEach((b, i) => { s += A[b % A.length]; if (i === 3 || i === 7) s += '-'; }); return s;
}
export const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const prettyCode = (c) => normCode(c).replace(/(.{4})(?=.)/g, '$1-');
export async function spaceOf(code) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('sonyria:' + normCode(code)));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const loadSpaces = () => LS.get('sonyria-spaces', []);
export const saveSpaces = (a) => LS.set('sonyria-spaces', a);
// chansons supprimées ici, à effacer aussi ailleurs (gardées 60 jours)
export function markDeleted(id) { const d = LS.get('sonyria-deleted', {}); d[id] = Date.now(); LS.set('sonyria-deleted', d); }
const b64 = (s) => btoa(unescape(encodeURIComponent(s || '_'))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function syncReady() { try { const r = await fetch('/api/sync', { cache: 'no-store' }).then((x) => x.json()); return !!r.ready; } catch (e) { return false; } }

// envoi par morceaux de 3,5 Mo (limite des fonctions Vercel) : un petit fichier « pointeur » liste les morceaux
const CHUNK = 3.5 * 1024 * 1024;
async function post(path, blob) {
  const r = await fetch('/api/sync?path=' + encodeURIComponent(path), { method: 'POST', headers: { 'content-type': blob.type || 'application/octet-stream' }, body: blob });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'envoi ' + r.status); return j;
}
async function put(path, data) {
  if (data.size <= CHUNK) return post(path, data);
  const n = Math.ceil(data.size / CHUNK);
  for (let i = 0; i < n; i++) await post(`${path}.p${i}`, data.slice(i * CHUNK, (i + 1) * CHUNK, 'application/octet-stream'));
  return post(path, new Blob([JSON.stringify({ sonyriaParts: n, size: data.size })], { type: 'application/json' }));
}
const fileUrl = (b) => '/api/sync?file=' + encodeURIComponent(b.p) + '&t=' + b.at;
async function getBlob(by, key, at) {
  const b = await fetch(fileUrl(by[key])).then((x) => x.blob());
  if (b.size < 200) { const t = await b.text(); if (t.startsWith('{"sonyriaParts"')) { const { sonyriaParts: n } = JSON.parse(t); const parts = []; for (let i = 0; i < n; i++) { const k = `${key}.p${i}`; if (!by[k]) throw new Error('morceau manquant'); parts.push(await fetch(fileUrl(by[k])).then((x) => x.blob())); } return new Blob(parts); } return new Blob([t]); }
  return b;
}

// lit l'espace distant (sans rien changer) : utile pour rejoindre une équipe
export async function peekSpace(code) {
  const space = await spaceOf(code);
  const r = await fetch('/api/sync?space=' + space, { cache: 'no-store' }).then((x) => x.json());
  if (r.error) throw new Error(r.error);
  const meta = r.blobs.find((b) => b.p.endsWith('/meta.json'));
  const m = meta ? await fetch(fileUrl(meta)).then((x) => x.json()).catch(() => null) : null;
  return { space, meta: m, songs: r.blobs.filter((b) => b.p.endsWith('.sonyria')).length };
}

export function deviceId() { let d = LS.get('sonyria-device', ''); if (!d) { d = Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => x.toString(16).padStart(2, '0')).join(''); LS.set('sonyria-device', d); } return d; }
export async function syncSpace(sp, opts = {}) {
  const me0 = opts.me;
  const space = await spaceOf(sp.code), pre = `sonyria/${space}/`;
  const r = await fetch('/api/sync?space=' + space, { cache: 'no-store' }).then((x) => x.json());
  if (r.error) throw new Error(r.error);
  const by = {}; r.blobs.forEach((b) => (by[b.p.slice(pre.length)] = b));
  const meta = by['meta.json'] ? await fetch(fileUrl(by['meta.json'])).then((x) => x.json()).catch(() => ({})) : {};
  meta.deleted = meta.deleted || {}; meta.covers = meta.covers || {};
  if (sp.kind === 'team') { meta.name = meta.name || sp.name; meta.album = meta.album ?? sp.album; }
  let metaDirty = !by['meta.json'];
  const synced = LS.get('sonyria-synced:' + space, {});
  const inScope = (x) => sp.kind !== 'team' || (x.album || '') === (sp.album || '');
  let local = (await DB.listSongs()).filter(inScope);
  const res = { pulled: [], pushed: 0, removed: 0 };

  // suppressions : d'ici vers l'espace, puis de l'espace vers ici
  const gone = LS.get('sonyria-deleted', {}), now = Date.now(), toDel = [];
  Object.entries(gone).forEach(([id, t]) => {
    if (now - t > 60 * 864e5) { delete gone[id]; return; }
    if (!meta.deleted[id]) { meta.deleted[id] = t; metaDirty = true; }
    Object.entries(by).forEach(([k, b]) => { if (k.startsWith(`songs/${id}.sonyria`)) toDel.push(b.url); });
  });
  LS.set('sonyria-deleted', gone);
  if (toDel.length) await fetch('/api/sync', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ urls: toDel }) }).catch(() => {});
  for (const x of local) if (meta.deleted[x.id] && meta.deleted[x.id] > (x.updated || 0)) { await DB.deleteSong(x.id); res.removed++; }
  local = local.filter((x) => !(meta.deleted[x.id] && meta.deleted[x.id] > (x.updated || 0)));

  // qui a changé quoi depuis la dernière synchro (par appareil, sans se fier aux horloges) :
  // - changé seulement ailleurs → on récupère; changé seulement ici → on envoie;
  // - changé des deux côtés → on garde les deux (copie « autre appareil »), rien n'est écrasé
  const me = deviceId(); meta.v = meta.v || {};
  for (const [p, b] of Object.entries(by)) {
    if (!p.startsWith('songs/') || !p.endsWith('.sonyria')) continue;
    const id = p.slice(6, -8); if (meta.deleted[id] || toDel.includes(b.url) || id === opts.busyId) continue;
    const mv = meta.v[id], sy = synced[id] && typeof synced[id] === 'object' ? synced[id] : null;
    const loc = (await DB.listSongs()).find((x) => x.id === id);
    const remoteChanged = !loc || (mv && mv.dev !== me && (!sy || mv.at !== sy.remote));
    if (!remoteChanged) continue;
    const localChanged = loc && (!sy || (loc.updated || 0) > sy.local + 500);
    try {
      const blob = await getBlob(by, p, b.at);
      const { song } = await fileToSong(new File([blob], id + '.sonyria'), true);
      if (sp.kind === 'team') song.album = sp.album || '';
      if (loc && localChanged) { // conflit : on garde les deux versions
        song.id = id + '-' + me.slice(0, 4) + Date.now().toString(36); song.title = (song.title || '') + ' (autre appareil)';
        await DB.saveSong({ id: song.id, title: song.title, updated: Date.now(), song }); res.conflicts = (res.conflicts || 0) + 1;
        continue;
      }
      const now = Date.now();
      await DB.saveSong({ id, title: song.title, updated: now, song });
      synced[id] = { local: now, remote: mv ? mv.at : b.at }; res.pulled.push(id);
    } catch (e) {}
  }

  // envoyer ce qui a changé ici
  for (const x of local) {
    if (res.pulled.includes(x.id)) continue;
    const sy = synced[x.id] && typeof synced[x.id] === 'object' ? synced[x.id] : null;
    if (by[`songs/${x.id}.sonyria`] && sy && (x.updated || 0) <= sy.local + 500) continue;
    const rec = await DB.getSong(x.id); if (!rec?.song) continue;
    const f = await songToFile({ ...rec.song, id: x.id }, me0, true);
    await put(`${pre}songs/${x.id}.sonyria`, f);
    meta.v[x.id] = { at: rec.updated || Date.now(), dev: me }; metaDirty = true;
    synced[x.id] = { local: rec.updated || 0, remote: meta.v[x.id].at }; res.pushed++;
  }

  // pochettes des albums concernés
  const albums = sp.kind === 'team' ? [sp.album || ''] : [...new Set(['', ...(await DB.listSongs()).map((x) => x.album || '')])];
  for (const a of albums) {
    const k = b64(a), url = loadCover(a), at = LS.get('sonyria-cover-at:' + a, 0), rm = meta.covers[k];
    if (url && (!rm || at > rm.at)) {
      await put(`${pre}covers/${k}.txt`, new Blob([url], { type: 'text/plain' }));
      meta.covers[k] = { at: at || Date.now(), album: a }; metaDirty = true;
    } else if (rm && rm.at > at && by[`covers/${k}.txt`]) {
      const txt = await fetch(fileUrl(by[`covers/${k}.txt`])).then((x) => x.text()).catch(() => '');
      if (txt.startsWith('data:image')) { saveCover(a, txt); LS.set('sonyria-cover-at:' + a, rm.at); }
    }
  }

  if (metaDirty) await put(`${pre}meta.json`, new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  LS.set('sonyria-synced:' + space, synced);
  const all = loadSpaces(); const i = all.findIndex((s) => s.code === sp.code); if (i >= 0) { all[i].last = Date.now(); saveSpaces(all); }
  return res;
}

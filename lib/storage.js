// Sonyria — sauvegarde locale (IndexedDB) : chansons + enregistrements
const DB = 'sonyria', V = 1;
function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, V);
    r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction('songs', mode); const st = t.objectStore('songs');
    const out = fn(st); t.oncomplete = () => res(out?.result ?? out); t.onerror = () => rej(t.error);
  });
}
export const saveSong = (rec) => tx('readwrite', (s) => s.put(rec));
export const getSong = (id) => tx('readonly', (s) => s.get(id));
export const deleteSong = async (id) => {
  try { const d = JSON.parse(localStorage.getItem('sonyria-deleted') || '{}'); d[id] = Date.now(); localStorage.setItem('sonyria-deleted', JSON.stringify(d)); } catch (e) {}
  const media = await listMedia(id).catch(() => []);
  const vers = await listVersions(id).catch(() => []);
  return tx('readwrite', (s) => { media.forEach((m) => s.delete(m.id)); vers.forEach((v) => s.delete(v.id)); s.delete('video:' + id); return s.delete(id); });
};
// clips et audios exportés, rangés avec leur chanson
export const saveMedia = (songId, kind, blob, name) => tx('readwrite', (s) => s.put({ id: 'media:' + Date.now() + Math.random().toString(36).slice(2, 6), songId, kind, blob, name, size: blob.size, updated: Date.now() }));
export const deleteMedia = (id) => tx('readwrite', (s) => s.delete(id));
export async function listMedia(songId) {
  const db = await open();
  return new Promise((res) => {
    const out = []; const c = db.transaction('songs').objectStore('songs').openCursor(IDBKeyRange.bound('media:', 'media:\uffff'));
    c.onsuccess = () => { const cur = c.result; if (cur) { const v = cur.value; if (!songId || v.songId === songId) out.push(v); cur.continue(); } else res(out.sort((a, b) => b.updated - a.updated)); };
    c.onerror = () => res(out);
  });
}
export async function listSongs() {
  const db = await open();
  return new Promise((res) => {
    const out = []; const c = db.transaction('songs').objectStore('songs').openCursor();
    c.onsuccess = () => { const cur = c.result; if (cur) { const v = cur.value; if (!String(v.id).includes(':')) out.push({ id: v.id, title: v.title, updated: v.updated, album: v.song?.album || '', style: v.song?.style || '', lines: (v.song?.lyrics || '').split('\n').filter(Boolean).length }); cur.continue(); } else res(out.sort((a, b) => b.updated - a.updated)); };
    c.onerror = () => res(out);
  });
}

// versions d'une chanson : l'original est toujours gardé, puis les étapes (auto ou nommées)
export const saveVersion = (songId, song, name, kind = 'auto') => tx('readwrite', (s) => s.put({ id: 'ver:' + songId + ':' + Date.now(), songId, name, kind, song, updated: Date.now() }));
export const deleteVersion = (id) => tx('readwrite', (s) => s.delete(id));
export const getVersion = (id) => tx('readonly', (s) => s.get(id));
export async function listVersions(songId) {
  const db = await open();
  return new Promise((res) => {
    const out = []; const p = 'ver:' + songId + ':';
    const c = db.transaction('songs').objectStore('songs').openCursor(IDBKeyRange.bound(p, p + '\uffff'));
    c.onsuccess = () => { const cur = c.result; if (cur) { const { song, ...v } = cur.value; out.push({ ...v, lines: (song?.lyrics || '').split('\n').filter(Boolean).length, style: song?.style }); cur.continue(); } else res(out.sort((a, b) => b.updated - a.updated)); };
    c.onerror = () => res(out);
  });
}
// garde l'original et les versions nommées; seulement les 25 dernières versions automatiques
export async function pruneVersions(songId) {
  const v = (await listVersions(songId)).filter((x) => x.kind === 'auto');
  for (const x of v.slice(25)) await deleteVersion(x.id);
}

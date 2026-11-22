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
export const deleteSong = (id) => tx('readwrite', (s) => s.delete(id));
export async function listSongs() {
  const db = await open();
  return new Promise((res) => {
    const out = []; const c = db.transaction('songs').objectStore('songs').openCursor();
    c.onsuccess = () => { const cur = c.result; if (cur) { const v = cur.value; out.push({ id: v.id, title: v.title, updated: v.updated }); cur.continue(); } else res(out.sort((a, b) => b.updated - a.updated)); };
    c.onerror = () => res(out);
  });
}

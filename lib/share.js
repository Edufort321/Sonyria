// Sonyria — partager une chanson dans un fichier .sonyria (paroles, composition, beat, arrangement, enregistrements)
const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (b) => { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
function pcm16(f32) { const o = new Int16Array(f32.length); for (let i = 0; i < f32.length; i++) { const v = Math.max(-1, Math.min(1, f32[i])); o[i] = v < 0 ? v * 0x8000 : v * 0x7fff; } return new Uint8Array(o.buffer); }
function f32(u8) { const a = new Int16Array(u8.buffer, u8.byteOffset, u8.byteLength >> 1); const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] / 0x8000; return o; }

async function gzip(text) {
  if (typeof CompressionStream === 'undefined') return new Blob([text], { type: 'application/json' });
  const st = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Blob([await new Response(st).arrayBuffer()], { type: 'application/octet-stream' });
}
async function gunzip(buf) {
  const u = new Uint8Array(buf);
  if (u[0] === 0x1f && u[1] === 0x8b) {
    const st = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(st).text();
  }
  return new TextDecoder().decode(u);
}

export async function songToFile(song, me, withRec = true) {
  const { tracks = [], ...rest } = song;
  const pack = {
    sonyria: 1, from: me?.artist || me?.name || '', sent: Date.now(),
    song: { ...JSON.parse(JSON.stringify({ ...rest, tracks: [] })), tracks: withRec ? tracks.filter((t) => t.data).map(({ buffer, data, ...t }) => ({ ...t, pcm: toB64(pcm16(data)) })) : [] },
  };
  const blob = await gzip(JSON.stringify(pack));
  const name = (song.title || 'chanson').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'chanson';
  return new File([blob], name + '.sonyria', { type: 'application/octet-stream' });
}

export async function fileToSong(file) {
  const text = await gunzip(await file.arrayBuffer());
  const pack = JSON.parse(text);
  const s = pack.song || pack;
  if (!s || !Array.isArray(s.blocks)) throw new Error('not a song');
  s.tracks = (s.tracks || []).map(({ pcm, ...t }) => ({ ...t, data: pcm ? f32(fromB64(pcm)) : t.data, buffer: null }));
  s.id = 's' + Date.now();
  return { song: s, from: pack.from || '' };
}

// partage natif (téléphone) sinon téléchargement
export async function shareFile(file, title, text) {
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title, text }); return 'shared'; }
  } catch (e) { if (e?.name === 'AbortError') return 'cancel'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  return 'downloaded';
}

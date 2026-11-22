// Sonyria — lecture des compositions déposées : photos (manuscrits), PDF, Word (.docx), texte
export async function imageToJpeg(file, max = 1800, q = 0.85) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const sc = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', q));
    return { type: 'image/jpeg', data: await toB64(blob) };
  } finally { URL.revokeObjectURL(url); }
}
export async function toB64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(s);
}
// .docx = archive zip ; on lit word/document.xml
export async function docxText(file) {
  const b = new Uint8Array(await file.arrayBuffer()), dv = new DataView(b.buffer);
  let eocd = -1; for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('docx');
  let p = dv.getUint32(eocd + 16, true); const n = dv.getUint16(eocd + 10, true);
  for (let k = 0; k < n; k++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl));
    if (name === 'word/document.xml') {
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      const data = b.subarray(start, start + csize);
      let xml;
      if (method === 0) xml = new TextDecoder().decode(data);
      else xml = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
      return xml.split(/<\/w:p>/).map((para) => para.replace(/<w:br[^>]*>/g, '\n').replace(/<w:tab[^>]*>/g, ' ').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }
    p += 46 + nl + xl + cl;
  }
  throw new Error('docx');
}

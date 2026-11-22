// Sonyria — détourage de la personne (fond derrière moi) avec MediaPipe, chargé seulement quand on en a besoin
const VER = '1.2.3';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

let seg = null, loading = null, failed = false;
export const cutoutReady = () => !!seg;
export const cutoutFailed = () => failed;

export function loadCutout() {
  if (seg) return Promise.resolve(seg);
  if (loading) return loading;
  loading = (async () => {
    try {
      const V = await import(/* webpackIgnore: true */ `${CDN}/vision_bundle.mjs`);
      const fs = await V.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
      const make = (delegate) => V.ImageSegmenter.createFromOptions(fs, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', outputCategoryMask: false, outputConfidenceMasks: true });
      try { seg = await make('GPU'); } catch (e) { seg = await make('CPU'); }
      return seg;
    } catch (e) { failed = true; loading = null; throw e; }
  })();
  return loading;
}

// Découpe la personne de la vidéo et la dessine sur g (W×H), en « cover », avec bords adoucis.
export class Cutter {
  constructor() {
    this.small = document.createElement('canvas'); this.sg = this.small.getContext('2d', { willReadFrequently: true });
    this.mask = document.createElement('canvas'); this.mg = this.mask.getContext('2d');
    this.person = document.createElement('canvas'); this.pg = this.person.getContext('2d');
    this.ts = 0; this.lastMask = null;
  }
  draw(g, W, H, vd, mirror) {
    if (!seg || !vd || !vd.videoWidth) return false;
    const vw = vd.videoWidth, vh = vd.videoHeight;
    const sw = 256, sh = Math.max(64, Math.round((256 * vh) / vw));
    if (this.small.width !== sw || this.small.height !== sh) { this.small.width = sw; this.small.height = sh; this.mask.width = sw; this.mask.height = sh; this.img = this.mg.createImageData(sw, sh); }
    this.sg.drawImage(vd, 0, 0, sw, sh);
    const now = Math.max(this.ts + 1, performance.now()); this.ts = now;
    try {
      seg.segmentForVideo(this.small, now, (r) => {
        const m = r.confidenceMasks?.[0]; if (!m) return;
        const f = m.getAsFloat32Array(), d = this.img.data;
        for (let i = 0; i < f.length; i++) { const a = Math.min(1, Math.max(0, (f[i] - 0.35) * 2.5)); d[i * 4 + 3] = a * 255; }
        this.mg.putImageData(this.img, 0, 0); this.lastMask = true;
      });
    } catch (e) {}
    if (!this.lastMask) return false;
    if (this.person.width !== W || this.person.height !== H) { this.person.width = W; this.person.height = H; }
    const p = this.pg, sc = Math.max(W / vw, H / vh), iw = vw * sc, ih = vh * sc, x = (W - iw) / 2, y = (H - ih) / 2;
    p.globalCompositeOperation = 'source-over'; p.clearRect(0, 0, W, H);
    p.save(); if (mirror) { p.translate(W, 0); p.scale(-1, 1); }
    p.drawImage(vd, x, y, iw, ih);
    p.globalCompositeOperation = 'destination-in'; p.imageSmoothingEnabled = true; p.filter = 'blur(2px)';
    p.drawImage(this.mask, x, y, iw, ih);
    p.restore(); p.filter = 'none'; p.globalCompositeOperation = 'source-over';
    g.drawImage(this.person, 0, 0);
    return true;
  }
}

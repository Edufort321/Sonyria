// Sonyria — nettoyage de la voix : enlève le bruit ambiant (souffle, ventilation, pièce)
// et la musique qui a « fui » dans le micro (haut-parleur), pour mettre les paroles en avant.
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], j = i + k + len / 2;
        const vr = re[j] * cr - im[j] * ci, vi = re[j] * ci + im[j] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[j] = ur - vr; im[j] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
const N = 1024, HOP = 256, BINS = N / 2 + 1;
const HANN = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
function mags(x) {
  const F = Math.max(1, Math.ceil((x.length - N) / HOP) + 1), out = [], ph = [];
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let f = 0; f < F; f++) {
    const o = f * HOP; for (let i = 0; i < N; i++) { re[i] = (x[o + i] || 0) * HANN[i]; im[i] = 0; }
    fft(re, im);
    const m = new Float32Array(BINS), p = new Float32Array(BINS * 2);
    for (let k = 0; k < BINS; k++) { m[k] = Math.hypot(re[k], im[k]); p[2 * k] = re[k]; p[2 * k + 1] = im[k]; }
    out.push(m); ph.push(p);
  }
  return { M: out, P: ph, F };
}
// rééchantillonne (linéaire) un signal de srA vers srB
export function resample(x, srA, srB) {
  if (srA === srB) return x;
  const r = srA / srB, n = Math.floor(x.length / r), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = i * r, a = Math.floor(p), f = p - a; o[i] = (x[a] || 0) * (1 - f) + (x[a + 1] || 0) * f; }
  return o;
}
/**
 * data: voix enregistrée (Float32Array), sr: fréquence
 * ref: musique jouée pendant la prise, alignée et à la même fréquence (optionnel)
 * strength: 0..1
 */
export function cleanVoice(data, sr, ref = null, strength = 0.8) {
  const X = mags(data), F = X.F;
  // profil du bruit : moyenne des 15 % de trames les plus calmes
  const en = X.M.map((m, f) => [m.reduce((a, b) => a + b, 0), f]).sort((a, b) => a[0] - b[0]);
  const q = en.slice(0, Math.max(3, Math.floor(F * 0.15)));
  const noise = new Float32Array(BINS); q.forEach(([, f]) => { const m = X.M[f]; for (let k = 0; k < BINS; k++) noise[k] += m[k] / q.length; });
  // fuite de la musique : gain de transfert par fréquence (moindres carrés)
  let R = null, H = null;
  if (ref) {
    R = mags(ref).M; H = new Float32Array(BINS);
    const num = new Float64Array(BINS), den = new Float64Array(BINS);
    for (let f = 0; f < Math.min(F, R.length); f++) for (let k = 0; k < BINS; k++) { num[k] += X.M[f][k] * R[f][k]; den[k] += R[f][k] * R[f][k]; }
    for (let k = 0; k < BINS; k++) H[k] = den[k] > 1e-9 ? Math.min(2, num[k] / den[k]) * 0.85 : 0;
  }
  const a = 1 + 1.5 * strength, b = 1 + strength, floor = 0.12 - 0.08 * strength;
  const out = new Float32Array(data.length + N), norm = new Float32Array(data.length + N);
  const re = new Float64Array(N), im = new Float64Array(N), prev = new Float32Array(BINS).fill(1);
  const lowK = Math.round((90 / sr) * N); // passe-haut ~90 Hz (grondement, vibrations)
  for (let f = 0; f < F; f++) {
    const m = X.M[f], p = X.P[f], r = R && R[f];
    for (let k = 0; k < BINS; k++) {
      const x2 = m[k] * m[k] + 1e-12;
      let n2 = a * noise[k] * noise[k];
      if (r) { const mk = H[k] * r[k]; n2 += b * mk * mk; }
      let g = Math.sqrt(Math.max(0, 1 - n2 / x2));
      g = Math.max(floor, 0.6 * g + 0.4 * prev[k]); prev[k] = g;
      if (k <= lowK) g *= k / (lowK + 1);
      re[k] = p[2 * k] * g; im[k] = p[2 * k + 1] * g;
      if (k > 0 && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; }
    }
    fft(im, re); // FFT inverse (échange re/im)
    const o = f * HOP;
    for (let i = 0; i < N; i++) { out[o + i] += (re[i] / N) * HANN[i]; norm[o + i] += HANN[i] * HANN[i]; }
  }
  const y = new Float32Array(data.length);
  for (let i = 0; i < y.length; i++) y[i] = norm[i] > 1e-3 ? out[i] / norm[i] : 0;
  return y;
}

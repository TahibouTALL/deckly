// Offline background remover: U²-Net (u2netp, Apache-2.0) run with ONNX Runtime Web (MIT), on this computer.
let session = null, ortLoaded = null;

function loadOrt() {
  if (!ortLoaded) ortLoaded = new Promise((res, rej) => {
    if (window.ort) return res(window.ort);
    const s = document.createElement('script'); s.src = 'vendor/ort/ort.wasm.min.js';
    s.onload = () => res(window.ort); s.onerror = () => rej(new Error('ONNX Runtime missing'));
    document.head.appendChild(s);
  });
  return ortLoaded;
}

async function getSession() {
  if (session) return session;
  const ort = await loadOrt();
  ort.env.wasm.wasmPaths = new URL('vendor/ort/', location.href).href;
  ort.env.wasm.numThreads = 1; // works everywhere, no special browser isolation needed
  session = await ort.InferenceSession.create('assets/models/u2netp.onnx', { executionProviders: ['wasm'] });
  return session;
}

const SIZE = 320;
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

// returns a PNG data URL of the image with its background made transparent
export async function removeBackground(src) {
  const [sess, img] = await Promise.all([getSession(), loadImg(src)]);
  const ort = window.ort;
  // 1. the image at 320 x 320, normalised like the model was trained
  const c = document.createElement('canvas'); c.width = c.height = SIZE;
  const cx = c.getContext('2d'); cx.drawImage(img, 0, 0, SIZE, SIZE);
  const px = cx.getImageData(0, 0, SIZE, SIZE).data;
  const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  const input = new Float32Array(3 * SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) for (let ch = 0; ch < 3; ch++) input[ch * SIZE * SIZE + i] = (px[i * 4 + ch] / 255 - mean[ch]) / std[ch];
  // 2. run the model: the first output is the foreground mask
  const out = await sess.run({ [sess.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
  const m = out[sess.outputNames[0]].data;
  let lo = Infinity, hi = -Infinity; for (const v of m) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const mc = document.createElement('canvas'); mc.width = mc.height = SIZE;
  const mx = mc.getContext('2d'); const md = mx.createImageData(SIZE, SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    let a = (m[i] - lo) / (hi - lo || 1);
    a = Math.min(1, Math.max(0, (a - 0.08) / 0.84)); // crisper edges
    md.data[i * 4 + 3] = Math.round(a * 255);
  }
  mx.putImageData(md, 0, 0);
  // 3. the mask, scaled up smoothly, becomes the alpha of the full-size photo
  const W = img.naturalWidth, H = img.naturalHeight;
  const k = Math.min(1, 2400 / Math.max(W, H));
  const o = document.createElement('canvas'); o.width = Math.round(W * k); o.height = Math.round(H * k);
  const ox = o.getContext('2d');
  ox.imageSmoothingQuality = 'high';
  ox.drawImage(mc, 0, 0, o.width, o.height);
  ox.globalCompositeOperation = 'source-in';
  ox.drawImage(img, 0, 0, o.width, o.height);
  return o.toDataURL('image/png');
}

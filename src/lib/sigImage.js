// Helpers that turn typed names, drawings and uploaded photos into transparent PNG signatures.

export const SIG_FONTS = [
  { family: 'Dancing Script', label: 'Classic' },
  { family: 'Great Vibes', label: 'Elegant' },
  { family: 'Allura', label: 'Formal' },
  { family: 'Sacramento', label: 'Slim' },
  { family: 'Homemade Apple', label: 'Handwritten' },
  { family: 'Caveat', label: 'Casual' },
];

export const INK_COLORS = [
  { value: '#111827', label: 'Black' },
  { value: '#1e3a8a', label: 'Navy' },
  { value: '#2563eb', label: 'Blue' },
];

export async function textToPng(text, family, color, size = 110) {
  const font = `${size}px "${family}"`;
  try {
    await document.fonts.load(font, text);
  } catch {
    /* fall back to whatever font is available */
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  const width = ctx.measureText(text).width;
  canvas.width = Math.ceil(width + size * 1.4);
  canvas.height = Math.ceil(size * 2.4);
  ctx.font = font; // resizing the canvas resets its state
  ctx.fillStyle = color;
  ctx.fillText(text, size * 0.7, size * 1.5);
  return trimCanvas(canvas, 8);
}

// Crops a canvas to its non-transparent pixels and returns { src, aspect }.
export function trimCanvas(canvas, pad = 4) {
  const { width: w, height: h } = canvas;
  const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  const ow = x1 - x0 + 1;
  const oh = y1 - y0 + 1;
  const out = document.createElement('canvas');
  out.width = ow;
  out.height = oh;
  out.getContext('2d').drawImage(canvas, x0, y0, ow, oh, 0, 0, ow, oh);
  return { src: out.toDataURL('image/png'), aspect: ow / oh };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = url;
  });
}

// Turns a photo/scan of a signature into a transparent PNG by fading out the light paper.
export async function imageFileToSig(file, removeBackground = true) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, 1400 / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (removeBackground) {
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = image.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (lum > 200) d[i + 3] = 0;
        else if (lum > 140) d[i + 3] = Math.round(d[i + 3] * ((200 - lum) / 60));
      }
      ctx.putImageData(image, 0, 0);
    }
    return trimCanvas(canvas, 4);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function checkPng(color = '#111827') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 100;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = color;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(14, 54);
  ctx.lineTo(40, 80);
  ctx.lineTo(88, 20);
  ctx.stroke();
  return { src: canvas.toDataURL('image/png'), aspect: 1 };
}

// Renders text to a PNG the exact size of its box (fallback for characters standard PDF fonts lack).
export function textBoxPng(text, w, h, size, color) {
  const s = 4;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * s);
  canvas.height = Math.ceil(h * s);
  const ctx = canvas.getContext('2d');
  ctx.font = `${size * s}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = color;
  ctx.fillText(text, 2 * s, (h / 2 + size * 0.35) * s);
  return canvas.toDataURL('image/png');
}

import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { textBoxPng } from './sigImage.js';

export const TEXT_COLOR = '#111827';
export const fontSizeFor = (h) => h * 0.68;

function dataUrlToBytes(dataUrl) {
  const bin = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Stamps every placed field onto the original PDF. Field coordinates are in the
// page's scale-1 viewport space; pdf.js converts them to PDF user space, which
// also handles rotated pages and cropped/offset page boxes.
export async function exportSignedPdf(bytes, pages, fields) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pdfPages = doc.getPages();
  const images = new Map();

  const embed = async (src) => {
    if (!images.has(src)) images.set(src, await doc.embedPng(dataUrlToBytes(src)));
    return images.get(src);
  };

  for (const f of fields) {
    const page = pdfPages[f.page];
    const { viewport } = pages[f.page];
    const rotate = degrees(viewport.rotation || 0);

    const drawImage = async (src) => {
      const [x, y] = viewport.convertToPdfPoint(f.x, f.y + f.h);
      page.drawImage(await embed(src), { x, y, width: f.w, height: f.h, rotate });
    };

    if (f.type === 'image') {
      await drawImage(f.src);
      continue;
    }
    const text = (f.text || '').trim();
    if (!text) continue;
    const size = fontSizeFor(f.h);
    try {
      font.encodeText(text); // throws if Helvetica can't represent a character
      const [x, y] = viewport.convertToPdfPoint(f.x + 2, f.y + f.h / 2 + size * 0.35);
      page.drawText(text, { x, y, size, font, color: rgb(0.067, 0.094, 0.153), rotate });
    } catch {
      await drawImage(textBoxPng(text, f.w, f.h, size, TEXT_COLOR));
    }
  }
  return doc.save();
}

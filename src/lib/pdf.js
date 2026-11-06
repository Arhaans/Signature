import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Loads a PDF and returns each page with its scale-1 viewport (units = PDF points).
export async function loadPdf(bytes) {
  // pdf.js takes ownership of the buffer it is given, so hand it a copy.
  const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const proxy = await pdf.getPage(i);
    pages.push({ proxy, viewport: proxy.getViewport({ scale: 1 }) });
  }
  return { pdf, pages };
}

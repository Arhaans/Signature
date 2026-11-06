// Local helper server: converts Word/ODT/RTF documents to PDF using LibreOffice.
import express from 'express';
import multer from 'multer';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const run = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.API_PORT) || 3001;
const CONVERTIBLE = new Set(['.doc', '.docx', '.odt', '.rtf', '.txt']);

const SOFFICE = [
  process.env.SOFFICE_PATH,
  '/opt/homebrew/bin/soffice',
  '/usr/local/bin/soffice',
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  '/usr/bin/soffice',
].find((p) => p && existsSync(p));

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.get('/api/health', (_req, res) => res.json({ ok: true, wordConversion: Boolean(SOFFICE) }));

app.post('/api/convert', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!CONVERTIBLE.has(ext)) return res.status(400).json({ error: `Unsupported file type: ${ext || 'unknown'}` });
  if (!SOFFICE) return res.status(500).json({ error: 'LibreOffice is not installed, so Word files cannot be converted. Install it with: brew install --cask libreoffice' });

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'signature-'));
  try {
    const input = path.join(dir, `input${ext}`);
    await fs.writeFile(input, req.file.buffer);
    // A private profile dir lets this run even while the LibreOffice app is open.
    const profile = pathToFileURL(path.join(dir, 'profile')).href;
    await run(SOFFICE, [`-env:UserInstallation=${profile}`, '--headless', '--convert-to', 'pdf', '--outdir', dir, input], {
      timeout: 120_000,
    });
    const pdf = await fs.readFile(path.join(dir, 'input.pdf'));
    res.type('application/pdf').send(pdf);
  } catch (err) {
    console.error('Conversion failed:', err.message);
    res.status(500).json({ error: 'Could not convert this document to PDF.' });
  } finally {
    fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Signature server on http://127.0.0.1:${PORT} (Word conversion: ${SOFFICE ? 'on' : 'off'})`);
});

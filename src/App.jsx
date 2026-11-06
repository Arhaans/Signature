import { useEffect, useRef, useState } from 'react';
import { loadPdf } from './lib/pdf.js';
import { exportSignedPdf } from './lib/exportPdf.js';
import { useLocalStorage } from './lib/useLocalStorage.js';
import Sidebar from './components/Sidebar.jsx';
import PdfPage from './components/PdfPage.jsx';
import SignatureModal from './components/SignatureModal.jsx';

const PDF_RE = /\.pdf$/i;
const WORD_RE = /\.(docx?|odt|rtf|txt)$/i;
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5];

let counter = 0;
const uid = () => `f${Date.now().toString(36)}${counter++}`;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

function defaultSize(payload) {
  if (payload.type === 'image') {
    let h = payload.kind === 'initials' ? 30 : payload.kind === 'check' ? 16 : 40;
    let w = h * payload.aspect;
    const maxW = payload.kind === 'initials' ? 90 : 200;
    if (w > maxW) {
      w = maxW;
      h = w / payload.aspect;
    }
    return { w, h };
  }
  const len = (payload.text || '').length;
  return { w: payload.kind === 'text' && !len ? 140 : Math.max(60, len * 7.5 + 12), h: 20 };
}

export default function App() {
  const [doc, setDoc] = useState(null); // { name, bytes, pdf, pages }
  const [fields, setFields] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1.25);
  const [placing, setPlacing] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // 'signature' | 'initials'
  const [fileDrag, setFileDrag] = useState(false);
  const [profile, setProfile] = useLocalStorage('sig.profile', { name: '', initials: '', color: '#1e3a8a' });
  const [custom, setCustom] = useLocalStorage('sig.custom', []);
  const dragPayload = useRef(null);
  const fileInput = useRef(null);

  async function openFile(file) {
    if (!file) return;
    setError('');
    const isPdf = PDF_RE.test(file.name) || file.type === 'application/pdf';
    if (!isPdf && !WORD_RE.test(file.name)) {
      setError('Please choose a PDF or Word document (.pdf, .docx, .doc, .odt, .rtf).');
      return;
    }
    setBusy(isPdf ? 'Opening document…' : 'Converting Word document to PDF…');
    try {
      let bytes;
      if (isPdf) {
        bytes = new Uint8Array(await file.arrayBuffer());
      } else {
        const body = new FormData();
        body.append('file', file);
        const res = await fetch('/api/convert', { method: 'POST', body });
        if (!res.ok) {
          const msg = (await res.json().catch(() => ({}))).error;
          throw new Error(msg || `Conversion failed (${res.status}). Is the local server running?`);
        }
        bytes = new Uint8Array(await res.arrayBuffer());
      }
      const loaded = await loadPdf(bytes);
      doc?.pdf.destroy();
      setDoc({ name: file.name.replace(/\.[^.]+$/, ''), bytes, ...loaded });
      setFields([]);
      setSelectedId(null);
      setPlacing(null);
    } catch (e) {
      setError(e.message || 'Could not open that file.');
    } finally {
      setBusy('');
    }
  }

  function placeAt(pageIndex, cx, cy, payload) {
    const { width: pw, height: ph } = doc.pages[pageIndex].viewport;
    const { w, h } = defaultSize(payload);
    const field = {
      id: uid(),
      page: pageIndex,
      type: payload.type,
      kind: payload.kind,
      src: payload.src,
      text: payload.text,
      x: clamp(cx - w / 2, 0, pw - w),
      y: clamp(cy - h / 2, 0, ph - h),
      w,
      h,
      autoEdit: payload.kind === 'text',
    };
    setFields((fs) => [...fs, field]);
    setSelectedId(field.id);
    setPlacing(null);
  }

  const updateField = (id, patch) => setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const deleteField = (id) => {
    setFields((fs) => fs.filter((f) => f.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, [contenteditable]')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        deleteField(selectedId);
      } else if (e.key === 'Escape') {
        setPlacing(null);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  async function download() {
    setBusy('Preparing signed PDF…');
    try {
      const out = await exportSignedPdf(doc.bytes, doc.pages, fields);
      const url = URL.createObjectURL(new Blob([out], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.name}-signed.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      setError(`Could not create the signed PDF: ${e.message}`);
    } finally {
      setBusy('');
    }
  }

  function stepZoom(dir) {
    const i = ZOOMS.findIndex((z) => z >= zoom - 0.001);
    setZoom(ZOOMS[clamp(i + dir, 0, ZOOMS.length - 1)]);
  }

  const isFileDrag = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✍︎</span> Signature
        </div>
        <div className="doc-title">{doc ? `${doc.name} · ${doc.pages.length} page${doc.pages.length > 1 ? 's' : ''}` : ''}</div>
        <div className="top-actions">
          {doc && (
            <div className="zoom">
              <button onClick={() => stepZoom(-1)} aria-label="Zoom out">−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => stepZoom(1)} aria-label="Zoom in">+</button>
            </div>
          )}
          <button className="btn" onClick={() => fileInput.current.click()}>
            {doc ? 'Open another' : 'Open document'}
          </button>
          <button className="btn primary" disabled={!doc || !fields.length} onClick={download}>
            Download signed PDF
          </button>
          <input
            ref={fileInput}
            type="file"
            hidden
            accept=".pdf,.doc,.docx,.odt,.rtf,.txt,application/pdf"
            onChange={(e) => {
              openFile(e.target.files[0]);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      <div className="body">
        <Sidebar
          disabled={!doc}
          profile={profile}
          setProfile={setProfile}
          custom={custom}
          placing={placing}
          onCreate={setModal}
          onDeleteCustom={(id) => setCustom((c) => c.filter((s) => s.id !== id))}
          onPick={(p) => setPlacing((cur) => (cur?.key === p.key ? null : p))}
          onDragStart={(p) => (dragPayload.current = p)}
        />

        <main
          className={`viewer ${fileDrag ? 'file-drag' : ''}`}
          onDragOver={(e) => {
            if (isFileDrag(e)) {
              e.preventDefault();
              setFileDrag(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setFileDrag(false);
          }}
          onDrop={(e) => {
            setFileDrag(false);
            if (e.dataTransfer.files.length) {
              e.preventDefault();
              openFile(e.dataTransfer.files[0]);
            }
          }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          {placing && <div className="hint">Click on the page to place it · Esc to cancel</div>}
          {!doc ? (
            <div className="empty" onClick={() => fileInput.current.click()}>
              <div className="empty-icon">📄</div>
              <h2>Drop a PDF or Word document here</h2>
              <p>or click to browse · .pdf, .docx, .doc, .odt, .rtf</p>
              <p className="muted">Everything stays on this computer.</p>
            </div>
          ) : (
            doc.pages.map((page, i) => (
              <PdfPage
                key={`${doc.name}-${i}`}
                page={page}
                index={i}
                zoom={zoom}
                fields={fields.filter((f) => f.page === i)}
                selectedId={selectedId}
                placing={placing}
                onSelect={setSelectedId}
                onChange={updateField}
                onDelete={deleteField}
                onPlace={(x, y, payload) => placeAt(i, x, y, payload || placing)}
                takeDragPayload={() => {
                  const p = dragPayload.current;
                  dragPayload.current = null;
                  return p;
                }}
              />
            ))
          )}
        </main>
      </div>

      {modal && (
        <SignatureModal
          kind={modal}
          profile={profile}
          onClose={() => setModal(null)}
          onSave={(sig) => {
            setCustom((c) => [{ id: uid(), kind: modal, ...sig }, ...c]);
            setModal(null);
          }}
        />
      )}
      {busy && (
        <div className="busy">
          <div className="spinner" /> {busy}
        </div>
      )}
      {error && (
        <div className="toast" role="alert">
          {error}
          <button onClick={() => setError('')} aria-label="Dismiss">×</button>
        </div>
      )}
    </div>
  );
}

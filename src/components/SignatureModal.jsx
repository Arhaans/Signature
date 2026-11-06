import { useEffect, useRef, useState } from 'react';
import { INK_COLORS, SIG_FONTS, imageFileToSig, textToPng, trimCanvas } from '../lib/sigImage.js';

function DrawPad({ color, padRef }) {
  const canvasRef = useRef(null);
  const drawing = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    c.getContext('2d').scale(dpr, dpr);
    padRef.current = {
      canvas: c,
      clear: () => c.getContext('2d').clearRect(0, 0, c.width, c.height),
    };
  }, [padRef]);

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <canvas
      ref={canvasRef}
      className="draw-pad"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = pos(e);
        drawing.current = { last: p, mid: p };
        const ctx = canvasRef.current.getContext('2d');
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return;
        const p = pos(e);
        const { last, mid } = drawing.current;
        const nextMid = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
        const ctx = canvasRef.current.getContext('2d');
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(mid.x, mid.y);
        ctx.quadraticCurveTo(last.x, last.y, nextMid.x, nextMid.y);
        ctx.stroke();
        drawing.current = { last: p, mid: nextMid };
      }}
      onPointerUp={() => (drawing.current = null)}
      onPointerCancel={() => (drawing.current = null)}
    />
  );
}

export default function SignatureModal({ kind, profile, onClose, onSave }) {
  const isInitials = kind === 'initials';
  const [tab, setTab] = useState('draw');
  const [color, setColor] = useState(profile.color);
  const [text, setText] = useState(isInitials ? profile.initials || '' : profile.name || '');
  const [font, setFont] = useState(SIG_FONTS[0].family);
  const [upload, setUpload] = useState(null); // { file, preview }
  const [removeBg, setRemoveBg] = useState(true);
  const [error, setError] = useState('');
  const padRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!upload) return;
    let cancelled = false;
    imageFileToSig(upload.file, removeBg)
      .then((sig) => !cancelled && setUpload((u) => ({ ...u, preview: sig })))
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [upload?.file, removeBg]);

  async function save() {
    setError('');
    let sig = null;
    if (tab === 'type') sig = text.trim() ? await textToPng(text.trim(), font, color) : null;
    else if (tab === 'draw') sig = trimCanvas(padRef.current.canvas, 6);
    else sig = upload?.preview || null;
    if (!sig) {
      setError(tab === 'draw' ? 'Draw your signature first.' : tab === 'type' ? 'Type something first.' : 'Choose an image first.');
      return;
    }
    onSave(sig);
  }

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={`Create ${kind}`}>
        <div className="modal-head">
          <h2>Create {isInitials ? 'initials' : 'signature'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="tabs">
          {['draw', 'type', 'upload'].map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {tab !== 'upload' && (
            <div className="ink">
              <span>Ink</span>
              {INK_COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.label}
                  className={`swatch ${color === c.value ? 'on' : ''}`}
                  style={{ background: c.value }}
                  onClick={() => setColor(c.value)}
                />
              ))}
            </div>
          )}

          {tab === 'draw' && (
            <>
              <DrawPad color={color} padRef={padRef} />
              <div className="row-between">
                <span className="muted small">Sign with your mouse or trackpad</span>
                <button className="link" onClick={() => padRef.current?.clear()}>
                  Clear
                </button>
              </div>
            </>
          )}

          {tab === 'type' && (
            <>
              <input className="big-input" value={text} placeholder={isInitials ? 'Your initials' : 'Your name'} onChange={(e) => setText(e.target.value)} />
              <div className="font-grid">
                {SIG_FONTS.map((f) => (
                  <button
                    key={f.family}
                    className={`font-option ${font === f.family ? 'on' : ''}`}
                    style={{ fontFamily: `"${f.family}"`, color }}
                    onClick={() => setFont(f.family)}
                  >
                    {text || (isInitials ? 'AM' : 'Your name')}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'upload' && (
            <>
              <label className="upload-drop">
                {upload?.preview ? <img src={upload.preview.src} alt="Signature preview" /> : <span>Choose a photo or scan of your signature (PNG, JPG)</span>}
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && setUpload({ file: e.target.files[0] })} />
              </label>
              <label className="check-row">
                <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} /> Remove white background
              </label>
            </>
          )}
          {error && <p className="error">{error}</p>}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            Save {isInitials ? 'initials' : 'signature'}
          </button>
        </div>
      </div>
    </div>
  );
}

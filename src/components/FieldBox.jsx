import { useState } from 'react';
import { TEXT_COLOR, fontSizeFor } from '../lib/exportPdf.js';

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

export default function FieldBox({ field: f, zoom, pageW, pageH, selected, onSelect, onChange, onDelete }) {
  const [editing, setEditing] = useState(Boolean(f.autoEdit));
  const isText = f.type === 'text';

  function startDrag(e, mode) {
    if (e.button !== 0) return;
    if (editing && mode === 'move') return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(f.id);
    const sx = e.clientX;
    const sy = e.clientY;
    const o = { ...f };
    const move = (ev) => {
      const dx = (ev.clientX - sx) / zoom;
      const dy = (ev.clientY - sy) / zoom;
      if (mode === 'move') {
        onChange(f.id, { x: clamp(o.x + dx, 0, pageW - o.w), y: clamp(o.y + dy, 0, pageH - o.h) });
        return;
      }
      if (isText) {
        onChange(f.id, { w: clamp(o.w + dx, 24, pageW - o.x), h: clamp(o.h + dy, 10, pageH - o.y) });
      } else {
        const ratio = o.w / o.h; // images keep their proportions
        let w = clamp(o.w + Math.max(dx, dy * ratio), 12, pageW - o.x);
        if (o.y + w / ratio > pageH) w = (pageH - o.y) * ratio;
        onChange(f.id, { w, h: w / ratio });
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const style = { left: f.x * zoom, top: f.y * zoom, width: f.w * zoom, height: f.h * zoom };
  const textStyle = { fontSize: fontSizeFor(f.h) * zoom, lineHeight: `${f.h * zoom}px`, color: TEXT_COLOR, paddingLeft: 2 * zoom };

  return (
    <div
      className={`field ${selected ? 'selected' : ''} ${isText ? 'text' : ''}`}
      style={style}
      onPointerDown={(e) => startDrag(e, 'move')}
      onDoubleClick={() => isText && setEditing(true)}
    >
      {isText ? (
        editing ? (
          <input
            autoFocus
            value={f.text || ''}
            placeholder="Type here"
            style={textStyle}
            onChange={(e) => onChange(f.id, { text: e.target.value })}
            onBlur={() => {
              setEditing(false);
              if (f.autoEdit) onChange(f.id, { autoEdit: false });
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <div className="field-text" style={textStyle}>
            {f.text || <span className="placeholder">Double-click to type</span>}
          </div>
        )
      ) : (
        <img src={f.src} alt={f.kind} draggable={false} />
      )}
      {selected && (
        <>
          <button
            className="field-delete"
            title="Remove"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onDelete(f.id)}
          >
            ×
          </button>
          <div className="field-resize" onPointerDown={(e) => startDrag(e, 'resize')} />
        </>
      )}
    </div>
  );
}

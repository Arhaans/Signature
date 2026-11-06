import { useEffect, useMemo, useState } from 'react';
import { INK_COLORS, SIG_FONTS, checkPng, textToPng } from '../lib/sigImage.js';

const deriveInitials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);

// Renders the given text in every signature font (debounced while typing).
function useStyledSignatures(text, color) {
  const [styles, setStyles] = useState([]);
  useEffect(() => {
    if (!text.trim()) {
      setStyles([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const out = await Promise.all(
        SIG_FONTS.map(async (f) => ({ ...f, ...(await textToPng(text.trim(), f.family, color)) })),
      );
      if (!cancelled) setStyles(out.filter((s) => s.src));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text, color]);
  return styles;
}

function SigCard({ payload, active, onPick, onDragStart, onDelete, label }) {
  return (
    <div className={`sig-card ${active ? 'active' : ''}`}>
      <button
        className="sig-card-btn"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData('text/plain', payload.kind);
          onDragStart(payload);
        }}
        onClick={() => onPick(payload)}
        title="Click, then click on the page — or drag onto the page"
      >
        {payload.src ? <img src={payload.src} alt={label || payload.kind} draggable={false} /> : <span>{label}</span>}
      </button>
      {label && payload.src && <span className="sig-label">{label}</span>}
      {onDelete && (
        <button className="sig-remove" title="Delete" onClick={onDelete}>
          ×
        </button>
      )}
    </div>
  );
}

export default function Sidebar({ disabled, profile, setProfile, custom, placing, onCreate, onDeleteCustom, onPick, onDragStart }) {
  const initials = profile.initials || deriveInitials(profile.name);
  const sigStyles = useStyledSignatures(profile.name, profile.color);
  const initialStyles = useStyledSignatures(initials, profile.color);
  const check = useMemo(() => checkPng(), []);
  const today = new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

  const card = (payload, extra = {}) => (
    <SigCard
      key={payload.key}
      payload={payload}
      active={placing?.key === payload.key}
      onPick={onPick}
      onDragStart={onDragStart}
      {...extra}
    />
  );

  const section = (kind, title, styles) => (
    <section>
      <div className="section-head">
        <h3>{title}</h3>
        <button className="link" onClick={() => onCreate(kind)}>
          + Draw / upload
        </button>
      </div>
      {custom
        .filter((s) => s.kind === kind)
        .map((s) => card({ key: s.id, type: 'image', kind, src: s.src, aspect: s.aspect }, { onDelete: () => onDeleteCustom(s.id) }))}
      {styles.length ? (
        <div className={kind === 'initials' ? 'sig-grid two' : 'sig-grid'}>
          {styles.map((s) =>
            card({ key: `${kind}-${s.family}`, type: 'image', kind, src: s.src, aspect: s.aspect }, { label: s.label }),
          )}
        </div>
      ) : (
        <p className="muted small">Type your name above to get ready-made styles.</p>
      )}
    </section>
  );

  return (
    <aside className={`sidebar ${disabled ? 'disabled' : ''}`}>
      <section>
        <h3>Your details</h3>
        <label className="input-label">
          Full name
          <input value={profile.name} placeholder="e.g. Arjun Mehta" onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        </label>
        <label className="input-label">
          Initials
          <input
            value={profile.initials}
            placeholder={deriveInitials(profile.name) || 'AM'}
            maxLength={4}
            onChange={(e) => setProfile({ ...profile, initials: e.target.value.toUpperCase() })}
          />
        </label>
        <div className="ink">
          <span>Ink</span>
          {INK_COLORS.map((c) => (
            <button
              key={c.value}
              title={c.label}
              className={`swatch ${profile.color === c.value ? 'on' : ''}`}
              style={{ background: c.value }}
              onClick={() => setProfile({ ...profile, color: c.value })}
            />
          ))}
        </div>
      </section>

      {disabled && <p className="notice">Open a document, then click or drag any signature onto it.</p>}

      {section('signature', 'Signature', sigStyles)}
      {section('initials', 'Initials', initialStyles)}

      <section>
        <h3>Fields</h3>
        <div className="field-tools">
          {profile.name.trim() && card({ key: 'tool-name', type: 'text', kind: 'name', text: profile.name.trim() }, { label: 'Name' })}
          {card({ key: 'tool-date', type: 'text', kind: 'date', text: today }, { label: 'Date' })}
          {card({ key: 'tool-text', type: 'text', kind: 'text', text: '' }, { label: 'Text' })}
          {card({ key: 'tool-check', type: 'image', kind: 'check', src: check.src, aspect: 1 }, { label: '' })}
        </div>
      </section>
    </aside>
  );
}

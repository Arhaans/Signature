import { useEffect, useRef } from 'react';
import FieldBox from './FieldBox.jsx';

export default function PdfPage({ page, index, zoom, fields, selectedId, placing, onSelect, onChange, onDelete, onPlace, takeDragPayload }) {
  const canvasRef = useRef(null);
  const { width, height } = page.viewport;

  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const viewport = page.proxy.getViewport({ scale: zoom * dpr });
    const canvas = canvasRef.current;
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const task = page.proxy.render({ canvasContext: canvas.getContext('2d'), viewport });
    task.promise.catch(() => {}); // cancelled on zoom change
    return () => task.cancel();
  }, [page, zoom]);

  // Converts a mouse event to page coordinates (PDF points, top-left origin).
  const toPage = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom];
  };

  return (
    <div className="page-wrap">
      <div
        className={`page ${placing ? 'placing' : ''}`}
        style={{ width: width * zoom, height: height * zoom }}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget && e.target !== canvasRef.current) return;
          if (placing) onPlace(...toPage(e));
          else onSelect(null);
        }}
        onDragOver={(e) => {
          if (!Array.from(e.dataTransfer.types).includes('Files')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }
        }}
        onDrop={(e) => {
          const payload = takeDragPayload();
          if (!payload) return;
          e.preventDefault();
          e.stopPropagation();
          onPlace(...toPage(e), payload);
        }}
      >
        <canvas ref={canvasRef} style={{ width: width * zoom, height: height * zoom }} />
        {fields.map((f) => (
          <FieldBox
            key={f.id}
            field={f}
            zoom={zoom}
            pageW={width}
            pageH={height}
            selected={f.id === selectedId}
            onSelect={onSelect}
            onChange={onChange}
            onDelete={onDelete}
          />
        ))}
      </div>
      <div className="page-num">Page {index + 1}</div>
    </div>
  );
}

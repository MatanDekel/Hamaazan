import { TRACKS } from './constants';
import { ils, dateFmt } from './calc';

export function AllocationBar({ allocation = [], showLegend = false }) {
  return (
    <div className="alloc">
      <div className="alloc-bar" role="img" aria-label={allocation.map((a) => `${TRACKS[a.track]?.label} ${a.pct}%`).join(', ')}>
        {allocation.map((a, i) => (
          <span key={i} style={{ flexBasis: `${a.pct}%`, background: TRACKS[a.track]?.color }} />
        ))}
      </div>
      {showLegend && (
        <div className="alloc-legend">
          {allocation.map((a, i) => (
            <span key={i}><i style={{ background: TRACKS[a.track]?.color }} />{TRACKS[a.track]?.label} {Math.round(a.pct)}%</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="סגירה">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// גרף יתרה מול סכום שהופקד
export function GrowthChart({ rows }) {
  if (rows.length < 2) return <p className="muted">הגרף יופיע אחרי שני עדכוני יתרה.</p>;
  const W = 640, H = 220, P = { t: 16, r: 12, b: 26, l: 12 };
  const t0 = +new Date(rows[0].date), t1 = +new Date(rows[rows.length - 1].date);
  const ys = rows.flatMap((r) => [r.balance, r.principal]);
  const yMin = Math.min(...ys) * 0.97, yMax = Math.max(...ys) * 1.02;
  const x = (d) => P.l + ((+new Date(d) - t0) / (t1 - t0 || 1)) * (W - P.l - P.r);
  const y = (v) => H - P.b - ((v - yMin) / (yMax - yMin || 1)) * (H - P.t - P.b);
  const line = (k) => rows.map((r, i) => `${i ? 'L' : 'M'}${x(r.date).toFixed(1)},${y(r[k]).toFixed(1)}`).join('');
  const area = `${line('balance')}L${x(rows[rows.length - 1].date)},${H - P.b}L${x(rows[0].date)},${H - P.b}Z`;
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="גרף יתרה מול הפקדות">
        <path d={area} fill="var(--accent-soft)" />
        <path d={line('principal')} fill="none" stroke="var(--ink-3)" strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
        <path d={line('balance')} fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption>
        <span><i className="sw sw-bal" />יתרה</span>
        <span><i className="sw sw-pr" />סך ההפקדות</span>
        <span className="muted">{dateFmt(rows[0].date)} – {dateFmt(rows[rows.length - 1].date)}</span>
        <span className="muted">שיא {ils(Math.max(...rows.map((r) => r.balance)))}</span>
      </figcaption>
    </figure>
  );
}

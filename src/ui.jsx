import { useEffect, useRef, useState } from 'react';
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

/*
  שדה תאריך שמציג תמיד dd/mm/yyyy (שדה תאריך רגיל של הדפדפן מוצג לפי שפת המכשיר, ולפעמים באמריקאית).
  הערך נשאר בפורמט ISO (yyyy-mm-dd), ו-onChange מקבל אירוע עם target.value כמו קודם.
*/
const toDisplay = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
function parseDisplay(txt) {
  const m = txt.trim().match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = '20' + y;
  const dt = new Date(+y, +mo - 1, +d);
  if (dt.getFullYear() !== +y || dt.getMonth() !== +mo - 1 || dt.getDate() !== +d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function DateInput({ value, onChange, ...rest }) {
  const [txt, setTxt] = useState(toDisplay(value));
  const native = useRef(null);
  useEffect(() => { setTxt(toDisplay(value)); }, [value]);
  const emit = (iso) => onChange({ target: { value: iso } });

  const onType = (e) => {
    let v = e.target.value.replace(/[^\d/.\-]/g, '');
    // הוספת לוכסנים אוטומטית בזמן הקלדה: 0311 → 03/11/
    if (/^[\d/]*$/.test(v)) {
      const d = v.replace(/\D/g, '').slice(0, 8);
      v = d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
    }
    setTxt(v);
    const iso = parseDisplay(v);
    if (iso && v.length >= 8) emit(iso);
  };
  const onBlur = () => {
    const iso = parseDisplay(txt);
    if (iso) { emit(iso); setTxt(toDisplay(iso)); } else setTxt(toDisplay(value));
  };
  const openPicker = () => {
    const el = native.current;
    if (!el) return;
    try { el.showPicker(); } catch { el.focus(); el.click(); }
  };

  return (
    <span className="date-input">
      <input {...rest} type="text" inputMode="numeric" placeholder="dd/mm/yyyy" value={txt} onChange={onType} onBlur={onBlur} dir="ltr" />
      <button type="button" className="date-btn" onClick={openPicker} aria-label="בחירה מלוח שנה">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
      </button>
      <input ref={native} type="date" className="date-native" tabIndex={-1} aria-hidden="true" value={value || ''} onChange={(e) => e.target.value && emit(e.target.value)} />
    </span>
  );
}

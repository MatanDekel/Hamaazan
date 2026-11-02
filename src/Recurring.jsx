import { useState } from 'react';
import { Modal } from './ui';
import { ils, dateFmt, toDate } from './calc';
import { monthShort, monthLong } from './expenseCalc';
import { todayISO, uid } from './constants';

const INTERVALS = [
  [2, 'כל חודשיים'], [3, 'כל 3 חודשים'], [4, 'כל 4 חודשים'], [6, 'כל חצי שנה'], [12, 'פעם בשנה'], [24, 'פעם בשנתיים'],
];
const intervalLabel = (n) => INTERVALS.find(([k]) => k === n)?.[1] ?? `כל ${n} חודשים`;

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
function addMonthsISO(s, n) {
  const d = toDate(s);
  const day = d.getDate();
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  r.setDate(Math.min(day, new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()));
  return iso(r);
}
// התשלום הבא: מתקדמים מהתאריך שהוזן בקפיצות של התדירות עד שמגיעים להיום או אחריו
export function nextDue(item, today = todayISO()) {
  let d = item.date, k = 0;
  while (d < today && k < 600) { k++; d = addMonthsISO(item.date, item.every * k); }
  return d;
}
const daysUntil = (s) => Math.round((toDate(s) - toDate(todayISO())) / 86400000);
function whenText(s) {
  const n = daysUntil(s);
  if (n === 0) return 'היום';
  if (n === 1) return 'מחר';
  if (n < 45) return `בעוד ${n} ימים`;
  return `בעוד ${Math.round(n / 30.4)} חודשים`;
}

export default function Recurring({ items = [], onSave }) {
  const [editing, setEditing] = useState(null); // null | 'new' | item
  const today = todayISO();
  const rows = items.map((it) => ({ ...it, next: nextDue(it, today), monthly: it.amount / it.every }))
    .sort((a, b) => a.next.localeCompare(b.next));
  const monthlyTotal = rows.reduce((s, r) => s + r.monthly, 0);
  const yearlyTotal = monthlyTotal * 12;

  // 12 החודשים הקרובים: כמה יוצא בכל חודש
  const start = new Date(); start.setDate(1);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const byMonth = Object.fromEntries(months.map((m) => [m, []]));
  rows.forEach((r) => {
    for (let k = 0; k < 40; k++) {
      const d = addMonthsISO(r.next, r.every * k);
      const m = d.slice(0, 7);
      if (m > months[11]) break;
      if (byMonth[m]) byMonth[m].push(r);
    }
  });
  const sums = months.map((m) => byMonth[m].reduce((s, r) => s + r.amount, 0));
  const max = Math.max(...sums, 1);

  const save = (it) => onSave(it.id && items.some((x) => x.id === it.id)
    ? items.map((x) => (x.id === it.id ? it : x))
    : [...items, { ...it, id: uid() }]);
  const remove = (it) => confirm(`למחוק את "${it.name}"?`) && onSave(items.filter((x) => x.id !== it.id));

  return (
    <section className="recurring">
      <div className="rec-head">
        <div>
          <h2 className="sec">הוצאות תקופתיות</h2>
          <p className="muted">הוצאות שלא מגיעות כל חודש — ביטוח רכב, טסט, רופא שיניים — כדי לדעת מראש מתי הן נופלות וכמה לשים בצד.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing('new')}>הוספת הוצאה תקופתית</button>
      </div>

      {!rows.length ? (
        <div className="empty small"><p>עוד אין הוצאות תקופתיות. הוסיפו את הראשונה ותראו כמה כדאי להפריש כל חודש.</p></div>
      ) : (
        <>
          <dl className="month-summary">
            <div><dt>להפריש כל חודש</dt><dd>{ils(monthlyTotal)}</dd></div>
            <div><dt>סה״כ בשנה</dt><dd>{ils(yearlyTotal)}</dd></div>
            <div><dt>הבאה בתור</dt><dd className="small-dd">{rows[0].name}<small>{dateFmt(rows[0].next)} · {whenText(rows[0].next)}</small></dd></div>
          </dl>

          <h3>מה יוצא ב-12 החודשים הקרובים</h3>
          <div className="rec-bars" dir="ltr">
            {months.map((m, i) => (
              <div key={m} className="rec-col" title={`${monthLong(m)}: ${byMonth[m].map((r) => r.name).join(', ') || 'אין'}`}>
                <span className="rec-amt">{sums[i] ? `${Math.round(sums[i] / 100) / 10}K` : ''}</span>
                <div className="rec-bar"><i style={{ height: `${(sums[i] / max) * 100}%` }} /></div>
                <span className="sbar-label">{monthShort(m)}{(i === 0 || m.endsWith('-01')) && <small>{m.slice(0, 4)}</small>}</span>
              </div>
            ))}
          </div>

          <ul className="rec-list">
            {rows.map((r) => {
              const soon = daysUntil(r.next) <= 30;
              return (
                <li key={r.id} className={soon ? 'soon' : ''}>
                  <div className="rec-main">
                    <span className="rec-name">{r.name}</span>
                    <span className="rec-meta">{intervalLabel(r.every)}{r.note ? ` · ${r.note}` : ''}</span>
                  </div>
                  <div className="rec-when">
                    <span>{dateFmt(r.next)}</span>
                    <small className={soon ? 'down' : 'muted'}>{whenText(r.next)}</small>
                  </div>
                  <div className="rec-money">
                    <span className="num">{ils(r.amount)}</span>
                    <small className="muted">{ils(r.monthly)} לחודש</small>
                  </div>
                  <div className="rec-actions">
                    <button className="link" onClick={() => setEditing(r)}>עריכה</button>
                    <button className="icon-btn" onClick={() => remove(r)} aria-label={`מחיקת ${r.name}`}>✕</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {editing && <RecurringForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={save} />}
    </section>
  );
}

function RecurringForm({ initial, onClose, onSave }) {
  const [f, setF] = useState(() => initial
    ? { ...initial, date: nextDue(initial), custom: !INTERVALS.some(([k]) => k === initial.every) }
    : { name: '', amount: '', every: 12, date: todayISO(), note: '', custom: false });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const every = Math.round(+f.every);
    if (!f.name.trim()) return setErr('צריך לתת להוצאה שם.');
    if (!(+f.amount > 0)) return setErr('הזינו סכום גדול מאפס.');
    if (!(every >= 1 && every <= 120)) return setErr('התדירות צריכה להיות בין חודש ל-120 חודשים.');
    if (!f.date) return setErr('בחרו את תאריך התשלום הבא.');
    try {
      await onSave({ ...(initial?.id ? { id: initial.id } : {}), name: f.name.trim(), amount: +f.amount, every, date: f.date, note: f.note.trim() });
      onClose();
    } catch (ex) { setErr('השמירה נכשלה: ' + ex.message); }
  };

  return (
    <Modal title={initial ? 'עריכת הוצאה תקופתית' : 'הוצאה תקופתית חדשה'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="full">שם<input value={f.name} onChange={set('name')} placeholder="למשל: ביטוח רכב" autoFocus /></label>
        <label>סכום (₪)<input type="number" min="0" value={f.amount} onChange={set('amount')} /></label>
        <label>כל כמה זמן
          <select value={f.custom ? 'custom' : f.every} onChange={(e) => e.target.value === 'custom'
            ? setF((s) => ({ ...s, custom: true }))
            : setF((s) => ({ ...s, custom: false, every: +e.target.value }))}>
            {INTERVALS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            <option value="custom">אחר…</option>
          </select>
        </label>
        {f.custom && <label>כל כמה חודשים<input type="number" min="1" max="120" value={f.every} onChange={set('every')} /></label>}
        <label>התשלום הבא<input type="date" value={f.date} onChange={set('date')} /></label>
        <label className="full">הערה<input value={f.note} onChange={set('note')} placeholder="לא חובה" /></label>
        {err && <p className="err full">{err}</p>}
        <div className="form-actions full">
          <button type="button" className="btn ghost" onClick={onClose}>ביטול</button>
          <button className="btn primary">{initial ? 'שמירת שינויים' : 'הוספה'}</button>
        </div>
      </form>
    </Modal>
  );
}

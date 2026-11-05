import { useState } from 'react';
import { Modal, DateInput } from './ui';
import { ils, dateFmt, toDate } from './calc';
import { monthLong } from './expenseCalc';
import { todayISO, uid } from './constants';

const INTERVALS = [
  [2, 'כל חודשיים'], [3, 'כל 3 חודשים'], [4, 'כל 4 חודשים'], [6, 'כל חצי שנה'], [12, 'פעם בשנה'], [24, 'פעם בשנתיים'],
];
const intervalLabel = (n) => INTERVALS.find(([k]) => k === n)?.[1] ?? `כל ${n} חודשים`;

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export function addMonthsISO(s, n) {
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
// כל המופעים של הוצאות עתידיות בחודש מסוים (yyyy-mm)
export function dueInMonth(items, month) {
  const today = todayISO();
  const out = [];
  items.forEach((it) => {
    const first = nextDue(it, today);
    for (let k = 0; k < 200; k++) {
      const d = addMonthsISO(first, it.every * k);
      const m = d.slice(0, 7);
      if (m > month) break;
      if (m === month) out.push({ ...it, due: d });
    }
  });
  return out.sort((a, b) => a.due.localeCompare(b.due));
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

  // מה נופל ב-3 החודשים הקרובים
  const horizon = addMonthsISO(today, 3);
  const upcoming = [];
  rows.forEach((r) => {
    for (let k = 0; k < 40; k++) {
      const d = addMonthsISO(r.next, r.every * k);
      if (d >= horizon) break;
      upcoming.push({ ...r, due: d });
    }
  });
  upcoming.sort((a, b) => a.due.localeCompare(b.due));
  const upcomingTotal = upcoming.reduce((t, u) => t + u.amount, 0);
  const byMonth = [];
  upcoming.forEach((u) => {
    const m = u.due.slice(0, 7);
    let g = byMonth.find((x) => x.m === m);
    if (!g) byMonth.push(g = { m, items: [], total: 0 });
    g.items.push(u); g.total += u.amount;
  });
  const [showAll, setShowAll] = useState(false);

  const save = (it) => onSave(it.id && items.some((x) => x.id === it.id)
    ? items.map((x) => (x.id === it.id ? it : x))
    : [...items, { ...it, id: uid() }]);
  const remove = (it) => confirm(`למחוק את "${it.name}"?`) && onSave(items.filter((x) => x.id !== it.id));

  return (
    <section className="recurring">
      <div className="rec-head">
        <div>
          <h2 className="sec">הוצאות עתידיות</h2>
          <p className="muted">הוצאות שלא מגיעות כל חודש — ביטוח רכב, טסט, רופא שיניים — כדי לדעת מה מגיע ב-3 החודשים הקרובים ולהתכונן.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing('new')}>הוספת הוצאה עתידית</button>
      </div>

      {!rows.length ? (
        <div className="empty small"><p>עוד אין הוצאות עתידיות. הוסיפו את הראשונה ותראו מתי היא מגיעה.</p></div>
      ) : (
        <>
          <div className="upcoming">
            <div className="up-total">
              <span>צפוי ב-3 החודשים הקרובים</span>
              <strong>{ils(upcomingTotal)}</strong>
              <small className="muted">עד {dateFmt(horizon)}</small>
            </div>
            {!byMonth.length && <p className="muted">אין הוצאות עתידיות ב-3 החודשים הקרובים.</p>}
            {byMonth.map((g) => (
              <div key={g.m} className="up-month">
                <div className="up-month-head"><h3>{monthLong(g.m)}</h3><span className="num">{ils(g.total)}</span></div>
                <ul>
                  {g.items.map((u) => (
                    <li key={u.id + u.due}>
                      <span className="rec-main"><span className="rec-name">{u.name}</span>
                        <span className="rec-meta">{dateFmt(u.due)} · {whenText(u.due)}{u.note ? ` · ${u.note}` : ''}</span></span>
                      <span className="num rec-amt-lg">{ils(u.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <button className="link all-toggle" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
            {showAll ? 'הסתרת הרשימה המלאה' : `כל ההוצאות העתידיות (${rows.length}) — עריכה ומחיקה`}
          </button>
          {showAll && (
            <ul className="rec-list">
              {rows.map((r) => (
                <li key={r.id}>
                  <div className="rec-main">
                    <span className="rec-name">{r.name}</span>
                    <span className="rec-meta">{intervalLabel(r.every)}{r.note ? ` · ${r.note}` : ''}</span>
                  </div>
                  <div className="rec-when"><span>{dateFmt(r.next)}</span><small className="muted">{whenText(r.next)}</small></div>
                  <div className="rec-money"><span className="num">{ils(r.amount)}</span></div>
                  <div className="rec-actions">
                    {r.source === 'insurance' ? (
                      <span className="tag" title="נוסף מלשונית ביטוחים — עורכים שם">מביטוחים</span>
                    ) : (
                      <>
                        <button className="link" onClick={() => setEditing(r)}>עריכה</button>
                        <button className="icon-btn" onClick={() => remove(r)} aria-label={`מחיקת ${r.name}`}>✕</button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
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
    <Modal title={initial ? 'עריכת הוצאה עתידית' : 'הוצאה עתידית חדשה'} onClose={onClose}>
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
        <label>התשלום הבא<DateInput value={f.date} onChange={set('date')} /></label>
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

import { useState } from 'react';
import { Modal, DateInput } from './ui';
import { ils, dateFmt, toDate } from './calc';
import { todayISO, uid } from './constants';

export const INS_TYPES = ['ביטוח חיים', 'ביטוח בריאות', 'מחלות קשות', 'סיעודי', 'תאונות אישיות', 'רכב', 'דירה', 'אחר'];
export const INS_COMPANIES = ['הראל', 'מנורה', 'מגדל', 'כלל', 'הפניקס', 'אחר'];

const monthlyOf = (p) => (p.period === 'year' ? (+p.premium || 0) / 12 : +p.premium || 0);
const daysTo = (s) => Math.round((toDate(s) - toDate(todayISO())) / 86400000);

function statusOf(p) {
  if (p.to && p.to < todayISO()) return { key: 'ended', text: 'הסתיים' };
  if (p.to && daysTo(p.to) <= 60) return { key: 'soon', text: `מסתיים בעוד ${daysTo(p.to)} ימים` };
  if (p.from && p.from > todayISO()) return { key: 'future', text: 'עוד לא התחיל' };
  return { key: 'active', text: 'פעיל' };
}

export default function Insurance({ items = [], owners = [], onSave }) {
  const [editing, setEditing] = useState(null);
  const [who, setWho] = useState('all');
  const [copied, setCopied] = useState('');

  const shown = items.filter((p) => who === 'all' || p.insured === who || p.insured === 'כולנו');
  const active = shown.filter((p) => statusOf(p).key !== 'ended');
  const monthly = active.reduce((t, p) => t + monthlyOf(p), 0);
  const byType = [...new Set([...INS_TYPES, ...shown.map((p) => p.type)])]
    .map((t) => ({ t, list: shown.filter((p) => p.type === t).sort((a, b) => statusOf(a).key.localeCompare(statusOf(b).key)) }))
    .filter((g) => g.list.length);

  const save = (p) => onSave(p.id && items.some((x) => x.id === p.id) ? items.map((x) => (x.id === p.id ? p : x)) : [...items, { ...p, id: uid() }]);
  const remove = (p) => confirm(`למחוק את "${p.type} — ${p.company}"?`) && onSave(items.filter((x) => x.id !== p.id));
  const copy = async (num) => {
    try { await navigator.clipboard.writeText(num); setCopied(num); setTimeout(() => setCopied(''), 1500); } catch { /* ignore */ }
  };

  return (
    <section>
      <div className="toolbar">
        <h1 className="page-title">ביטוחים</h1>
        <button className="btn primary" onClick={() => setEditing('new')}>הוספת ביטוח</button>
      </div>

      {!items.length ? (
        <div className="empty"><h2>עוד אין כאן ביטוחים</h2><p>הוסיפו את הפוליסות שלכם — סוג, חברה, כיסוי, תשלום ותקופה — ותראו כמה עולים כל הביטוחים יחד.</p>
          <button className="btn primary" onClick={() => setEditing('new')}>הוספת ביטוח</button></div>
      ) : (
        <>
          {owners.length > 1 && (
            <div className="seg ins-filter" aria-label="סינון לפי מבוטח">
              <button className={who === 'all' ? 'on' : ''} onClick={() => setWho('all')}>כולם</button>
              {owners.map((o) => <button key={o} className={who === o ? 'on' : ''} onClick={() => setWho(o)}>{o}</button>)}
            </div>
          )}
          <dl className="month-summary">
            <div><dt>עלות חודשית</dt><dd>{ils(monthly)}</dd></div>
            <div><dt>עלות שנתית</dt><dd>{ils(monthly * 12)}</dd></div>
            <div><dt>פוליסות פעילות</dt><dd>{active.length}</dd></div>
          </dl>

          {byType.map((g) => (
            <div key={g.t} className="ins-group">
              <h2 className="sec">{g.t}</h2>
              <ul className="ins-list">
                {g.list.map((p) => {
                  const st = statusOf(p);
                  return (
                    <li key={p.id} className={`ins-card st-${st.key}`}>
                      <div className="ins-top">
                        <div>
                          <span className="ins-company">{p.company}</span>
                          <span className="ins-cover">{p.coverage || '—'}</span>
                        </div>
                        <div className="ins-price">
                          <strong>{ils(+p.premium || 0)}</strong>
                          <small>{p.period === 'year' ? 'לשנה' : 'לחודש'}</small>
                        </div>
                      </div>
                      <dl className="ins-meta">
                        <div><dt>מבוטח</dt><dd>{p.insured || '—'}</dd></div>
                        <div><dt>תקופה</dt><dd><bdi>{p.from ? dateFmt(p.from) : '—'}</bdi> עד <bdi>{p.to ? dateFmt(p.to) : 'ללא תאריך סיום'}</bdi></dd></div>
                        <div><dt>מספר פוליסה</dt><dd>
                          {p.policy ? (
                            <button className="policy" onClick={() => copy(p.policy)} title="העתקה">
                              <span dir="ltr">{p.policy}</span><small>{copied === p.policy ? 'הועתק' : 'העתקה'}</small>
                            </button>
                          ) : '—'}
                        </dd></div>
                      </dl>
                      {p.note && <p className="ins-note">{p.note}</p>}
                      <div className="ins-foot">
                        <span className={`ins-status ${st.key}`}>{st.text}</span>
                        <span>
                          <button className="link" onClick={() => setEditing(p)}>עריכה</button>
                          <button className="icon-btn" onClick={() => remove(p)} aria-label="מחיקה">✕</button>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </>
      )}

      {editing && <InsuranceForm initial={editing === 'new' ? null : editing} owners={owners} onClose={() => setEditing(null)} onSave={save} />}
    </section>
  );
}

function InsuranceForm({ initial, owners, onClose, onSave }) {
  const [f, setF] = useState(() => initial ? { ...initial } : {
    type: INS_TYPES[0], company: INS_COMPANIES[0], coverage: '', insured: owners[0] || '',
    premium: '', period: 'month', from: todayISO(), to: '', policy: '', note: '',
  });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const customType = !INS_TYPES.slice(0, -1).includes(f.type);
  const customCompany = !INS_COMPANIES.slice(0, -1).includes(f.company);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.type.trim() || f.type === 'אחר') return setErr('בחרו סוג ביטוח או כתבו אותו.');
    if (!f.company.trim() || f.company === 'אחר') return setErr('בחרו חברת ביטוח או כתבו את שמה.');
    if (!(+f.premium >= 0) || f.premium === '') return setErr('הזינו את סכום התשלום.');
    if (f.from && f.to && f.to < f.from) return setErr('תאריך הסיום לפני תאריך ההתחלה.');
    try {
      await onSave({ ...(initial?.id ? { id: initial.id } : {}), ...f, type: f.type.trim(), company: f.company.trim(), premium: +f.premium, coverage: f.coverage.trim(), policy: f.policy.trim(), note: f.note.trim() });
      onClose();
    } catch (ex) { setErr('השמירה נכשלה: ' + ex.message); }
  };

  return (
    <Modal title={initial ? 'עריכת ביטוח' : 'ביטוח חדש'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>סוג ביטוח
          <select value={customType ? 'אחר' : f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value === 'אחר' ? '' : e.target.value }))}>
            {INS_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        {customType && <label>איזה ביטוח<input value={f.type} onChange={set('type')} placeholder="למשל: ביטוח נסיעות" /></label>}
        <label>חברה
          <select value={customCompany ? 'אחר' : f.company} onChange={(e) => setF((s) => ({ ...s, company: e.target.value === 'אחר' ? '' : e.target.value }))}>
            {INS_COMPANIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        {customCompany && <label>שם החברה<input value={f.company} onChange={set('company')} /></label>}
        <label className="full">סוג הכיסוי<input value={f.coverage} onChange={set('coverage')} placeholder="למשל: ריסק — 1,000,000 ₪ / ניתוחים בחו״ל ותרופות" /></label>
        <label>מבוטח
          <select value={f.insured} onChange={set('insured')}>
            {owners.map((o) => <option key={o}>{o}</option>)}
            <option>כולנו</option>
          </select>
        </label>
        <label>מספר פוליסה<input value={f.policy} onChange={set('policy')} dir="ltr" inputMode="text" /></label>
        <label>תשלום (₪)<input type="number" min="0" step="0.01" value={f.premium} onChange={set('premium')} /></label>
        <label>כל
          <div className="seg">
            <button type="button" className={f.period === 'month' ? 'on' : ''} onClick={() => setF((s) => ({ ...s, period: 'month' }))}>חודש</button>
            <button type="button" className={f.period === 'year' ? 'on' : ''} onClick={() => setF((s) => ({ ...s, period: 'year' }))}>שנה</button>
          </div>
        </label>
        <label>מתאריך<DateInput value={f.from} onChange={set('from')} /></label>
        <label>עד תאריך<DateInput value={f.to} onChange={set('to')} /></label>
        <label className="full">הערה<input value={f.note} onChange={set('note')} placeholder="לא חובה — למשל: סוכן, טלפון, מתי לבדוק חידוש" /></label>
        {err && <p className="err full">{err}</p>}
        <div className="form-actions full">
          <button type="button" className="btn ghost" onClick={onClose}>ביטול</button>
          <button className="btn primary">{initial ? 'שמירה' : 'הוספה'}</button>
        </div>
      </form>
    </Modal>
  );
}

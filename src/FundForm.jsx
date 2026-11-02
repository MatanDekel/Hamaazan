import { useState } from 'react';
import { COMPANIES, KINDS, TRACKS, todayISO, uid } from './constants';
import { Modal } from './ui';

export default function FundForm({ initial, owners, onSave, onClose }) {
  const isNew = !initial;
  const [f, setF] = useState(() => initial ? { kind: 'gemel', ...initial } : {
    name: '', kind: 'gemel', company: COMPANIES[0], owner: owners[0] || '',
    investedSoFar: '', startDate: todayISO(), monthlyDeposit: '',
    feeDeposit: '', feeBalance: '', allocation: [{ track: 'sp500', pct: 100 }],
    currentBalance: '',
  });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const alloc = f.allocation;
  const sum = alloc.reduce((s, a) => s + (+a.pct || 0), 0);
  const setAlloc = (i, k, v) => setF((s) => ({ ...s, allocation: s.allocation.map((a, j) => (j === i ? { ...a, [k]: k === 'pct' ? v : v } : a)) }));
  const unusedTrack = Object.keys(TRACKS).find((t) => !alloc.some((a) => a.track === t));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setErr('צריך לתת לחיסכון שם.');
    if (Math.round(sum) !== 100) return setErr(`חלוקת המסלולים צריכה להסתכם ב-100%. כרגע: ${sum}%.`);
    const data = {
      name: f.name.trim(), kind: f.kind, company: f.company, owner: f.owner,
      investedSoFar: +f.investedSoFar || 0, startDate: f.startDate || todayISO(),
      monthlyDeposit: +f.monthlyDeposit || 0,
      feeDeposit: +f.feeDeposit || 0, feeBalance: +f.feeBalance || 0,
      allocation: alloc.map((a) => ({ track: a.track, pct: +a.pct })),
    };
    if (isNew) {
      data.snapshots = f.currentBalance !== ''
        ? [{ id: uid(), date: data.startDate, balance: +f.currentBalance, deposits: null }]
        : [];
    }
    setSaving(true);
    try { await onSave(data); onClose(); }
    catch (ex) { setErr('השמירה נכשלה: ' + ex.message); setSaving(false); }
  };

  return (
    <Modal title={isNew ? 'חיסכון חדש' : 'עריכת חיסכון'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="full">שם<input value={f.name} onChange={set('name')} placeholder="למשל: פנסיה של עדן" autoFocus /></label>
        <label>סוג החיסכון
          <select value={f.kind} onChange={set('kind')}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        <label>חברה
          <select value={f.company} onChange={set('company')}>{COMPANIES.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label>אצל מי
          <select value={f.owner} onChange={set('owner')}>{owners.map((o) => <option key={o}>{o}</option>)}</select>
        </label>
        <label>כמה הופקד עד היום (₪)<input type="number" min="0" value={f.investedSoFar} onChange={set('investedSoFar')} /></label>
        <label>נכון לתאריך<input type="date" value={f.startDate} onChange={set('startDate')} /></label>
        <label>הפקדה חודשית (₪)<input type="number" min="0" value={f.monthlyDeposit} onChange={set('monthlyDeposit')} /></label>
        {isNew && (
          <label>יתרה נוכחית בקופה (₪)
            <input type="number" min="0" value={f.currentBalance} onChange={set('currentBalance')} placeholder="לא חובה" />
          </label>
        )}
        <label>דמי ניהול מהפקדה (%)<input type="number" min="0" step="0.01" value={f.feeDeposit} onChange={set('feeDeposit')} /></label>
        <label>דמי ניהול מצבירה (% בשנה)<input type="number" min="0" step="0.01" value={f.feeBalance} onChange={set('feeBalance')} /></label>

        <fieldset className="full">
          <legend>מסלול <span className={Math.round(sum) === 100 ? 'ok' : 'warn'}>{sum}%</span></legend>
          {alloc.map((a, i) => (
            <div className="alloc-row" key={i}>
              <select value={a.track} onChange={(e) => setAlloc(i, 'track', e.target.value)} aria-label="מסלול">
                {Object.entries(TRACKS).map(([k, t]) => (
                  <option key={k} value={k} disabled={k !== a.track && alloc.some((x) => x.track === k)}>{t.label}</option>
                ))}
              </select>
              <input type="number" min="0" max="100" value={a.pct} onChange={(e) => setAlloc(i, 'pct', e.target.value)} aria-label="אחוז" />
              <span>%</span>
              {alloc.length > 1 && (
                <button type="button" className="icon-btn" aria-label="הסרת מסלול"
                  onClick={() => setF((s) => ({ ...s, allocation: s.allocation.filter((_, j) => j !== i) }))}>✕</button>
              )}
            </div>
          ))}
          {unusedTrack && (
            <button type="button" className="link" onClick={() => setF((s) => ({ ...s, allocation: [...s.allocation, { track: unusedTrack, pct: Math.max(0, 100 - sum) }] }))}>
              הוספת מסלול
            </button>
          )}
        </fieldset>

        {err && <p className="err full">{err}</p>}
        <div className="form-actions full">
          <button type="button" className="btn ghost" onClick={onClose}>ביטול</button>
          <button className="btn primary" disabled={saving}>{isNew ? 'הוספת חיסכון' : 'שמירת שינויים'}</button>
        </div>
      </form>
    </Modal>
  );
}

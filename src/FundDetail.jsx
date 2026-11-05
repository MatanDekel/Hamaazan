import { useMemo, useState } from 'react';
import { analyzeFund, ils, pct, tone, dateFmt, monthsBetween } from './calc';
import { todayISO, uid, kindOf } from './constants';
import { AllocationBar, GrowthChart, DateInput } from './ui';
import FundForm from './FundForm';

export default function FundDetail({ fund, family, api, onBack }) {
  const a = useMemo(() => analyzeFund(fund), [fund]);
  const [editing, setEditing] = useState(false);
  const [snap, setSnap] = useState({ date: todayISO(), balance: '', deposits: '' });
  const [err, setErr] = useState('');
  const [lump, setLump] = useState({ date: todayISO(), amount: '' });
  const lumps = [...(fund.lumpSums || [])].sort((a, b) => b.date.localeCompare(a.date));
  const addLump = async (e) => {
    e.preventDefault();
    if (!(+lump.amount > 0)) return;
    await api.updateFund(fund.id, { lumpSums: [...(fund.lumpSums || []), { id: uid(), date: lump.date, amount: +lump.amount }] });
    setLump({ date: todayISO(), amount: '' });
  };
  const removeLump = (id) => confirm('למחוק את ההפקדה הזו?') && api.updateFund(fund.id, { lumpSums: fund.lumpSums.filter((l) => l.id !== id) });

  const last = a.rows[a.rows.length - 1];
  const autoDeposits = last && snap.date > last.date
    ? monthsBetween(last.date, snap.date) * (+fund.monthlyDeposit || 0)
      + (fund.lumpSums || []).filter((l) => l.date > last.date && l.date <= snap.date).reduce((t, l) => t + +l.amount, 0)
    : 0;

  const addSnap = async (e) => {
    e.preventDefault();
    if (snap.balance === '') return setErr('הזינו את היתרה הכוללת בקופה.');
    if ((fund.snapshots || []).some((s) => s.date === snap.date)) return setErr('כבר יש עדכון בתאריך הזה. מחקו אותו או בחרו תאריך אחר.');
    const next = [...(fund.snapshots || []), {
      id: uid(), date: snap.date, balance: +snap.balance,
      deposits: snap.deposits === '' ? null : +snap.deposits,
    }];
    try {
      await api.updateFund(fund.id, { snapshots: next });
      setSnap({ date: todayISO(), balance: '', deposits: '' });
      setErr('');
    } catch (ex) { setErr('השמירה נכשלה: ' + ex.message); }
  };

  const removeSnap = (id) => {
    if (!confirm('למחוק את העדכון הזה?')) return;
    api.updateFund(fund.id, { snapshots: fund.snapshots.filter((s) => s.id !== id) });
  };

  const removeFund = async () => {
    if (!confirm(`למחוק את "${fund.name}" וכל ההיסטוריה שלה?`)) return;
    await api.deleteFund(fund.id);
    onBack();
  };

  return (
    <section className="detail">
      <button className="link back" onClick={onBack}>חזרה לכל החסכונות</button>

      <header className="detail-head">
        <div>
          <h1>{fund.name}</h1>
          <p className="meta">{kindOf(fund)} · {fund.company} · {fund.shared ? `משותף, רשום על שם ${fund.owner}` : `אצל ${fund.owner}`} · דמי ניהול {fund.feeDeposit || 0}% מהפקדה, {fund.feeBalance || 0}% מצבירה</p>
          <AllocationBar allocation={fund.allocation} showLegend />
        </div>
        <div className="detail-actions">
          <button className="btn ghost" onClick={() => setEditing(true)}>עריכה</button>
          <button className="btn ghost danger" onClick={removeFund}>מחיקה</button>
        </div>
      </header>

      <dl className="stats">
        <div><dt>יתרה</dt><dd>{ils(a.balance)}</dd></div>
        <div><dt>סך ההפקדות</dt><dd>{ils(a.principal)}</dd></div>
        <div><dt>רווח</dt><dd className={tone(a.profit)}>{ils(a.profit)}</dd></div>
        <div><dt>רווח ביחס להפקדות</dt><dd className={tone(a.profit)}>{a.profit != null && a.principal > 0 ? pct(a.profit / a.principal) : '—'}</dd></div>
        <div><dt>תשואת המסלול מאז העדכון הראשון</dt><dd className={tone(a.cumR)}>{pct(a.cumR, 2)}</dd></div>
        <div><dt>בממוצע לשנה</dt><dd className={tone(a.cumAnn)}>{pct(a.cumAnn)}</dd></div>
        <div><dt>דמי ניהול ששולמו (הערכה)</dt><dd>{ils(a.fees)}</dd></div>
      </dl>

      <GrowthChart rows={a.rows} />

      <form className="snap-form" onSubmit={addSnap}>
        <h2>עדכון יתרה</h2>
        <label>תאריך<DateInput value={snap.date} onChange={(e) => setSnap({ ...snap, date: e.target.value })} /></label>
        <label>יתרה כוללת (₪)<input type="number" min="0" value={snap.balance} onChange={(e) => setSnap({ ...snap, balance: e.target.value })} /></label>
        <label>הפקדות מאז העדכון הקודם (₪)
          <input type="number" min="0" value={snap.deposits} onChange={(e) => setSnap({ ...snap, deposits: e.target.value })}
            placeholder={last ? `${autoDeposits.toLocaleString('he-IL')} לפי הפקדה חודשית` : 'לא רלוונטי לעדכון ראשון'} />
        </label>
        <button className="btn primary">שמירת עדכון</button>
        {err && <p className="err">{err}</p>}
      </form>

      <form className="snap-form lump-form" onSubmit={addLump}>
        <h2>הפקדה חד-פעמית</h2>
        <label>תאריך<DateInput value={lump.date} onChange={(e) => setLump({ ...lump, date: e.target.value })} /></label>
        <label>סכום (₪)<input type="number" min="0" value={lump.amount} onChange={(e) => setLump({ ...lump, amount: e.target.value })} /></label>
        <button className="btn ghost">הוספת הפקדה</button>
        {lumps.length > 0 && (
          <ul className="lump-list">
            {lumps.map((l) => (
              <li key={l.id}><span>{dateFmt(l.date)}</span><span className="num">{ils(l.amount)}</span>
                <button type="button" className="icon-btn" onClick={() => removeLump(l.id)} aria-label="מחיקת הפקדה">✕</button></li>
            ))}
          </ul>
        )}
        <p className="footnote">נכנסת לחישוב התשואה ולתקרת ההפקדה השנתית. אם כבר הזנת הפקדות בפועל בעדכון יתרה, אל תוסיפי אותן גם כאן.</p>
      </form>

      {a.rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>תאריך</th><th>יתרה</th><th>הפקדות</th><th>דמי ניהול</th>
                <th>תשואת מסלול</th><th>בחישוב שנתי</th><th>נטו אחרי דמי ניהול</th><th aria-label="פעולות" />
              </tr>
            </thead>
            <tbody>
              {[...a.rows].reverse().map((r) => (
                <tr key={r.id}>
                  <td>{dateFmt(r.date)}</td>
                  <td className="num">{ils(r.balance)}</td>
                  {r.opening ? (
                    <td colSpan="5" className="muted">{r.implicit ? 'פתיחת הקופה — לפי מה שהופקד עד אז' : 'נקודת פתיחה'}</td>
                  ) : (
                    <>
                      <td className="num">{ils(r.deposits)}{!r.manual && <span className="muted" title="מחושב לפי ההפקדה החודשית"> *</span>}</td>
                      <td className="num">{ils(r.depFee + r.balFee)}</td>
                      <td className={`num strong ${tone(r.r)}`}>{pct(r.r, 2)}</td>
                      <td className={`num ${tone(r.ann)}`}>{pct(r.ann)}</td>
                      <td className={`num muted ${tone(r.netR)}`}>{pct(r.netR, 2)}</td>
                    </>
                  )}
                  <td>{!r.implicit && <button className="icon-btn" aria-label="מחיקת עדכון" onClick={() => removeSnap(r.id)}>✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="footnote">
            תשואת המסלול לא כוללת את ההפקדות השוטפות ומחזירה את דמי הניהול (מהפקדה ומצבירה), כך שהיא משקפת את ביצועי המסלול עצמו.
            * הפקדות מחושבות לפי ההפקדה החודשית אם לא הוזנו ידנית.
          </p>
        </div>
      )}

      {editing && (
        <FundForm initial={fund} owners={family.owners || []} onClose={() => setEditing(false)}
          onSave={(d) => api.updateFund(fund.id, d)} />
      )}
    </section>
  );
}

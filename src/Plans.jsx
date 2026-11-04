import { createContext, useContext, useMemo, useState } from 'react';
import { Modal } from './ui';
import { ils, dateFmt } from './calc';
import { PALETTE } from './expenseCalc';

export const DEFAULT_SUBS = ['טיסות', 'לינה', 'אוכל', 'אטרקציות', 'תחבורה', 'שונות'];

/* ---------- context: מאפשר לכל שורת עסקה לשייך לתוכנית ---------- */
const PlansCtx = createContext({ byTx: {}, openAssign: null });
export const usePlans = () => useContext(PlansCtx);

export function PlansProvider({ plans, api, children }) {
  const [assigning, setAssigning] = useState(null);
  const byTx = useMemo(() => {
    const m = {};
    plans.forEach((p) => (p.items || []).forEach((it) => { m[it.txId] = { plan: p, sub: it.sub }; }));
    return m;
  }, [plans]);
  return (
    <PlansCtx.Provider value={{ byTx, openAssign: setAssigning }}>
      {children}
      {assigning && <AssignModal tx={assigning} plans={plans} byTx={byTx} api={api} onClose={() => setAssigning(null)} />}
    </PlansCtx.Provider>
  );
}

export const planSpent = (p) => (p.items || []).reduce((s, it) => s + (it.income ? -it.amount : it.amount), 0);

function snapshotOf(tx, sub) {
  return { txId: tx.id, date: tx.date, amount: tx.amount, business: tx.business || '', category: tx.category || '', income: !!tx.income, manual: !!tx.manual, sub };
}

function AssignModal({ tx, plans, byTx, api, onClose }) {
  const current = byTx[tx.id];
  const [planId, setPlanId] = useState(current?.plan.id || plans[0]?.id || '__new');
  const [newName, setNewName] = useState('');
  const plan = plans.find((p) => p.id === planId);
  const subs = plan?.subs || DEFAULT_SUBS;
  const [sub, setSub] = useState(current?.sub || '');
  const [err, setErr] = useState('');

  const save = async () => {
    const chosenSub = sub || subs[0];
    try {
      let target = planId;
      if (planId === '__new') {
        if (!newName.trim()) return setErr('תנו שם לתוכנית.');
        target = await api.addPlan({ name: newName.trim(), budget: null, from: '', to: '', subs: DEFAULT_SUBS, items: [] });
      }
      // מסירים מתוכנית קודמת, אם הייתה
      if (current && current.plan.id !== target) {
        await api.updatePlan(current.plan.id, { items: current.plan.items.filter((it) => it.txId !== tx.id) });
      }
      const base = planId === '__new' ? [] : (plans.find((p) => p.id === target)?.items || []);
      await api.updatePlan(target, { items: [...base.filter((it) => it.txId !== tx.id), snapshotOf(tx, chosenSub)] });
      onClose();
    } catch (e) { setErr('השמירה נכשלה: ' + e.message); }
  };
  const remove = async () => {
    await api.updatePlan(current.plan.id, { items: current.plan.items.filter((it) => it.txId !== tx.id) });
    onClose();
  };

  return (
    <Modal title="שיוך לתוכנית" onClose={onClose}>
      <div className="form">
        <div className="assign-tx full">
          <strong>{tx.business || tx.category}</strong>
          <span className="muted">{dateFmt(tx.date)} · {ils(tx.amount)}</span>
        </div>
        <label className="full">תוכנית
          <select value={planId} onChange={(e) => { setPlanId(e.target.value); setSub(''); }}>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__new">תוכנית חדשה…</option>
          </select>
        </label>
        {planId === '__new' && <label className="full">שם התוכנית<input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="למשל: טיסה לאוסטריה" autoFocus /></label>}
        <fieldset className="full">
          <legend>על מה ההוצאה</legend>
          <div className="chips sub-chips">
            {subs.map((s) => (
              <button type="button" key={s} className={(sub || subs[0]) === s ? 'on' : ''} onClick={() => setSub(s)}>{s}</button>
            ))}
          </div>
        </fieldset>
        {err && <p className="err full">{err}</p>}
        <div className="form-actions full">
          {current && <button type="button" className="btn ghost danger" style={{ marginInlineEnd: 'auto' }} onClick={remove}>הסרה מהתוכנית</button>}
          <button type="button" className="btn ghost" onClick={onClose}>ביטול</button>
          <button type="button" className="btn primary" onClick={save}>שמירה</button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- tab ---------- */

export default function Plans({ plans, api }) {
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);
  const open = plans.find((p) => p.id === openId);

  return (
    <section>
      {open ? (
        <PlanDetail plan={open} api={api} onBack={() => setOpenId(null)} onEdit={() => setEditing(open)} />
      ) : (
        <>
          <div className="toolbar">
            <h1 className="page-title">תוכניות</h1>
            <button className="btn primary" onClick={() => setEditing('new')}>תוכנית חדשה</button>
          </div>
          <p className="muted plans-intro">טיסה, שיפוץ, חתונה — מרכזים כאן את כל ההוצאות של התוכנית, גם כאלה שהוצאת מהתזרים ב-RiseUp, ורואים על מה הלך הכסף. משייכים עסקה מהלשונית הוצאות, בלחיצה על "לתוכנית" ליד העסקה.</p>
          {!plans.length && <div className="empty"><h2>עוד אין תוכניות</h2><p>פתחו תוכנית ראשונה, ואז שייכו אליה עסקאות.</p></div>}
          <ul className="plan-list">
            {plans.map((p) => {
              const spent = planSpent(p);
              return (
                <li key={p.id}>
                  <button className="plan-card" onClick={() => setOpenId(p.id)}>
                    <span className="pc-name">{p.name}</span>
                    <span className="pc-meta">{p.from ? `${dateFmt(p.from)}${p.to ? ` – ${dateFmt(p.to)}` : ''} · ` : ''}{(p.items || []).length} עסקאות</span>
                    <strong className="pc-sum">{ils(spent)}</strong>
                    {p.budget > 0 && (
                      <>
                        <span className="cap-bar"><i className={spent > p.budget ? 'over' : ''} style={{ width: `${Math.min(100, (spent / p.budget) * 100)}%` }} /></span>
                        <span className={`pc-left ${spent > p.budget ? 'down' : 'muted'}`}>{spent > p.budget ? `${ils(spent - p.budget)} מעל התקציב` : `נשארו ${ils(p.budget - spent)} מתוך ${ils(p.budget)}`}</span>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {editing && (
        <PlanForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
          onSave={async (d) => { if (editing === 'new') { const id = await api.addPlan({ ...d, items: [] }); setOpenId(id); } else await api.updatePlan(editing.id, d); }}
          onDelete={editing !== 'new' ? async () => { await api.deletePlan(editing.id); setOpenId(null); } : null} />
      )}
    </section>
  );
}

function PlanDetail({ plan, api, onBack, onEdit }) {
  const [openSub, setOpenSub] = useState(null);
  const items = plan.items || [];
  const spent = planSpent(plan);
  const subs = [...new Set([...(plan.subs || []), ...items.map((i) => i.sub)])];
  const rows = subs.map((s, i) => {
    const its = items.filter((it) => it.sub === s).sort((a, b) => b.date.localeCompare(a.date));
    return { name: s, items: its, total: planSpent({ items: its }), color: PALETTE[i % PALETTE.length] };
  }).filter((r) => r.items.length).sort((a, b) => b.total - a.total);
  const max = Math.max(...rows.map((r) => r.total), 1);

  const move = (txId, sub) => api.updatePlan(plan.id, { items: items.map((it) => (it.txId === txId ? { ...it, sub } : it)) });
  const remove = (txId) => confirm('להסיר את העסקה מהתוכנית?') && api.updatePlan(plan.id, { items: items.filter((it) => it.txId !== txId) });

  return (
    <div className="detail">
      <button className="link back" onClick={onBack}>חזרה לכל התוכניות</button>
      <header className="detail-head">
        <div>
          <h1>{plan.name}</h1>
          {plan.from && <p className="meta">{dateFmt(plan.from)}{plan.to ? ` – ${dateFmt(plan.to)}` : ''}</p>}
        </div>
        <div className="detail-actions"><button className="btn ghost" onClick={onEdit}>עריכה</button></div>
      </header>

      <dl className="stats">
        <div><dt>הוצאתם עד עכשיו</dt><dd>{ils(spent)}</dd></div>
        {plan.budget > 0 && <div><dt>תקציב</dt><dd>{ils(plan.budget)}</dd></div>}
        {plan.budget > 0 && <div><dt>{spent > plan.budget ? 'חריגה' : 'נשאר'}</dt><dd className={spent > plan.budget ? 'down' : 'up'}>{ils(Math.abs(plan.budget - spent))}</dd></div>}
        <div><dt>עסקאות</dt><dd>{items.length}</dd></div>
      </dl>

      {!rows.length && <p className="muted">עוד לא שויכו עסקאות. בלשונית הוצאות, לחצו על "לתוכנית" ליד עסקה.</p>}
      <ul className="plan-subs">
        {rows.map((r) => (
          <li key={r.name} className={openSub === r.name ? 'open' : ''}>
            <button className="mc-row" onClick={() => setOpenSub(openSub === r.name ? null : r.name)} aria-expanded={openSub === r.name}>
              <span className="unit-name"><i style={{ background: r.color }} />{r.name}</span>
              <span className="mc-bar"><i style={{ width: `${(r.total / max) * 100}%`, background: r.color }} /></span>
              <span className="num mc-amt">{ils(r.total)}</span>
              <span className="num mc-chg muted">{spent ? `${Math.round((r.total / spent) * 100)}%` : ''}</span>
            </button>
            {openSub === r.name && (
              <ul className="tx-list plan-tx">
                {r.items.map((it) => (
                  <li key={it.txId}>
                    <span className="tx-biz">{it.business || it.category}<small>{dateFmt(it.date)} · {it.category}{it.income ? ' · זיכוי' : ''}</small></span>
                    <select value={it.sub} onChange={(e) => move(it.txId, e.target.value)} aria-label="העברה לתת-קטגוריה">
                      {subs.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <span className={`num${it.income ? ' up' : ''}`}>{it.income ? '−' : ''}{ils(it.amount)}</span>
                    <button className="icon-btn" onClick={() => remove(it.txId)} aria-label="הסרה מהתוכנית">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanForm({ initial, onClose, onSave, onDelete }) {
  const [f, setF] = useState(() => ({
    name: initial?.name || '', budget: initial?.budget || '', from: initial?.from || '', to: initial?.to || '',
    subs: initial?.subs || DEFAULT_SUBS,
  }));
  const [sub, setSub] = useState('');
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setErr('תנו לתוכנית שם.');
    if (!f.subs.length) return setErr('צריך לפחות תת-קטגוריה אחת.');
    try {
      await onSave({ name: f.name.trim(), budget: +f.budget || null, from: f.from, to: f.to, subs: f.subs });
      onClose();
    } catch (ex) { setErr('השמירה נכשלה: ' + ex.message); }
  };
  const addSub = () => { const v = sub.trim(); if (v && !f.subs.includes(v)) setF((s) => ({ ...s, subs: [...s.subs, v] })); setSub(''); };

  return (
    <Modal title={initial ? 'עריכת תוכנית' : 'תוכנית חדשה'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="full">שם<input value={f.name} onChange={set('name')} placeholder="למשל: טיסה לאוסטריה" autoFocus /></label>
        <label>תקציב (₪)<input type="number" min="0" value={f.budget} onChange={set('budget')} placeholder="לא חובה" /></label>
        <span />
        <label>מתאריך<input type="date" value={f.from} onChange={set('from')} /></label>
        <label>עד תאריך<input type="date" value={f.to} onChange={set('to')} /></label>
        <fieldset className="full">
          <legend>תתי-קטגוריות</legend>
          <ul className="chips">
            {f.subs.map((s) => (
              <li key={s}>{s}<button type="button" className="icon-btn" aria-label={`הסרת ${s}`} onClick={() => setF((x) => ({ ...x, subs: x.subs.filter((y) => y !== s) }))}>✕</button></li>
            ))}
          </ul>
          <div className="row">
            <input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="למשל: ביטוח נסיעות"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} />
            <button type="button" className="btn ghost" onClick={addSub}>הוספה</button>
          </div>
        </fieldset>
        {err && <p className="err full">{err}</p>}
        <div className="form-actions full">
          {onDelete && <button type="button" className="btn ghost danger" style={{ marginInlineEnd: 'auto' }}
            onClick={async () => { if (confirm('למחוק את התוכנית? העסקאות עצמן לא יימחקו.')) { await onDelete(); onClose(); } }}>מחיקה</button>}
          <button type="button" className="btn ghost" onClick={onClose}>ביטול</button>
          <button className="btn primary">{initial ? 'שמירה' : 'יצירה'}</button>
        </div>
      </form>
    </Modal>
  );
}

import { useState } from 'react';
import { monthLong, PALETTE, fullAvg } from './expenseCalc';
import { ils, pct } from './calc';
import { uid } from './constants';
import Recurring from './Recurring';

export default function Expenses({ exp, model, groups, onSaveGroups, recurring, onSaveRecurring }) {
  const [mode, setMode] = useState('month');
  const [sel, setSel] = useState(null);

  return (
    <section>
      <div className="toolbar">
        <h1 className="page-title">{mode === 'manage' ? 'קטגוריות עיליות' : 'הוצאות'}</h1>
        <div className="row">
          <button className="btn ghost" onClick={exp.reload} disabled={exp.loading}>{exp.loading ? 'טוען…' : 'רענון מ-RiseUp'}</button>
          {mode === 'manage'
            ? <button className="btn primary" onClick={() => setMode('month')}>חזרה להוצאות</button>
            : <button className="btn primary" onClick={() => setMode('manage')}>קטגוריות עיליות</button>}
        </div>
      </div>

      <LoadState exp={exp} model={model} />
      {model && mode === 'month' && <MonthView model={model} sel={sel} setSel={setSel} onManage={() => setMode('manage')} />}
      {model && mode === 'manage' && <ManageGroups model={model} groups={groups} onSave={onSaveGroups} />}
      {mode === 'month' && <Recurring items={recurring} onSave={onSaveRecurring} />}
    </section>
  );
}

export function LoadState({ exp, model }) {
  if (exp.error) return <div className="panel err-panel"><strong>לא הצלחנו לטעון את הנתונים מ-RiseUp.</strong><p>{exp.error}</p></div>;
  if (!model) return <p className="muted">טוען נתונים מ-RiseUp…</p>;
  return null;
}

/* ---------- month view ---------- */

function MonthPicker({ months, month, onChange }) {
  const i = months.indexOf(month);
  const last = months.length - 1;
  const today = new Date();
  return (
    <div className="month-picker">
      <button className="btn ghost" disabled={i <= 0} onClick={() => onChange(months[i - 1])} aria-label="חודש קודם">→</button>
      <div className="mp-label">
        <select value={month} onChange={(e) => onChange(e.target.value)} aria-label="בחירת חודש">
          {[...months].reverse().map((m) => <option key={m} value={m}>{monthLong(m)}</option>)}
        </select>
        <span className="mp-sub">{i === last ? `החודש הנוכחי — נכון ל-${today.getDate()}.${today.getMonth() + 1}` : 'חודש מלא'}</span>
      </div>
      <button className="btn ghost" disabled={i >= last} onClick={() => onChange(months[i + 1])} aria-label="חודש הבא">←</button>
    </div>
  );
}

function MonthView({ model, sel, setSel, onManage }) {
  const { months, list, total, income } = model;
  const month = sel && months.includes(sel) ? sel : months[months.length - 2];
  const i = months.indexOf(month);
  const [open, setOpen] = useState(null);

  const spent = total[i];
  const earned = income[i];
  const avgSpent = fullAvg(total);
  const rows = list.filter((u) => u.values[i] > 0).sort((a, b) => b.values[i] - a.values[i]);
  const ungrouped = list.filter((u) => !u.group).length;
  const isCurrent = i === months.length - 1;

  return (
    <>
      <MonthPicker months={months} month={month} onChange={(m) => { setSel(m); setOpen(null); }} />

      <dl className="month-summary">
        <div><dt>הוצאות ב{monthLong(month)}</dt><dd>{ils(spent)}</dd></div>
        <div><dt>הכנסות ב{monthLong(month)}</dt><dd>{ils(earned)}</dd></div>
        <div><dt>{earned - spent >= 0 ? 'נשאר' : 'גירעון'}</dt><dd className={earned - spent >= 0 ? 'up' : 'down'}>{ils(Math.abs(earned - spent))}</dd></div>
        <div>
          <dt>מול הממוצע החודשי</dt>
          <dd className={isCurrent ? 'muted' : spent > avgSpent ? 'down' : 'up'}>{isCurrent ? 'חודש לא שלם' : pct(avgSpent ? spent / avgSpent - 1 : null, 0)}</dd>
        </div>
      </dl>

      {ungrouped > 0 && (
        <p className="hint">{ungrouped} קטגוריות עוד לא משויכות לקטגוריה עילית. <button className="link" onClick={onManage}>לשיוך</button></p>
      )}

      <h2 className="sec">לאן הלך הכסף ב{monthLong(month)}</h2>
      {!rows.length && <p className="muted">אין הוצאות בחודש הזה.</p>}
      <ul className="month-cats">
        {rows.map((u) => {
          const v = u.values[i];
          const change = u.avg ? v / u.avg - 1 : null;
          const isOpen = open === u.key;
          return (
            <li key={u.key} className={isOpen ? 'open' : ''}>
              <button className="mc-row" onClick={() => setOpen(isOpen ? null : u.key)} aria-expanded={isOpen}>
                <span className="unit-name"><i style={{ background: u.color }} />{u.name}</span>
                <span className="mc-bar"><i style={{ width: `${(v / spent) * 100}%`, background: u.color }} /></span>
                <span className="num mc-amt">{ils(v)}</span>
                <span className={`num mc-chg ${isCurrent || change == null || Math.abs(change) <= 0.1 ? 'muted' : change > 0 ? 'down' : 'up'}`}>
                  {isCurrent ? `${Math.round((v / spent) * 100)}%` : `${pct(change, 0)} מהממוצע`}
                </span>
              </button>
              {isOpen && <MonthUnit model={model} unit={u} i={i} month={month} />}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function MonthUnit({ model, unit, i, month }) {
  const tx = model.tx.filter((t) => t.unit === unit.key && t.month === month).sort((a, b) => b.amount - a.amount);
  const subs = unit.cats.filter((c) => c.values[i] > 0).sort((a, b) => b.values[i] - a.values[i]);
  return (
    <div className="mc-detail">
      {unit.cats.length > 1 && (
        <ul className="mc-subs">
          {subs.map((c) => <li key={c.name}><span>{c.name}</span><span className="num">{ils(c.values[i])}</span><span className="num muted">ממוצע {ils(c.avg)}</span></li>)}
        </ul>
      )}
      <ul className="tx-list">
        {tx.map((t) => (
          <li key={t.id}>
            <span className="tx-biz">{t.business}<small>{t.date.split('-').reverse().join('/')}{unit.cats.length > 1 ? ` · ${t.category}` : ''}{t.fixed ? ' · קבועה' : ''}</small></span>
            <span className="num">{ils(t.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- manage groups ---------- */

function ManageGroups({ model, groups, onSave }) {
  const [name, setName] = useState('');
  const groupOf = {};
  groups.forEach((g) => g.categories.forEach((c) => { groupOf[c] = g.id; }));
  const stats = Object.fromEntries(model.categories.map((c) => [c.name, c]));
  const allCats = [...new Set([...model.categories.map((c) => c.name), ...groups.flatMap((g) => g.categories)])];
  allCats.sort((a, b) => (groupOf[a] ? 1 : 0) - (groupOf[b] ? 1 : 0) || (stats[b]?.total || 0) - (stats[a]?.total || 0));

  const addGroup = (e) => {
    e.preventDefault();
    const v = name.trim();
    if (!v || groups.some((g) => g.name === v)) return;
    onSave([...groups, { id: uid(), name: v, categories: [] }]);
    setName('');
  };
  const assign = (cat, gid) => onSave(groups.map((g) => ({
    ...g, categories: g.id === gid ? [...g.categories.filter((c) => c !== cat), cat] : g.categories.filter((c) => c !== cat),
  })));
  const rename = (gid, v) => v.trim() && onSave(groups.map((g) => (g.id === gid ? { ...g, name: v.trim() } : g)));
  const remove = (g) => confirm(`למחוק את "${g.name}"? הקטגוריות שבה יחזרו להיות בלי קבוצה.`) && onSave(groups.filter((x) => x.id !== g.id));

  return (
    <div className="manage">
      <div className="panel">
        <h2>הקטגוריות העיליות שלך</h2>
        <p className="muted">קטגוריה עילית מאגדת כמה קטגוריות מ-RiseUp, למשל "אוכל" שכוללת סופר, מסעדות ומשלוחים.</p>
        <ul className="group-list">
          {groups.map((g, i) => (
            <li key={g.id}>
              <i style={{ background: PALETTE[i % PALETTE.length] }} />
              <input defaultValue={g.name} onBlur={(e) => rename(g.id, e.target.value)} aria-label="שם הקטגוריה העילית" />
              <span className="muted">{g.categories.length} קטגוריות</span>
              <button className="icon-btn" onClick={() => remove(g)} aria-label={`מחיקת ${g.name}`}>✕</button>
            </li>
          ))}
        </ul>
        <form className="row" onSubmit={addGroup}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם, למשל: אוכל" />
          <button className="btn primary">הוספה</button>
        </form>
      </div>

      <div className="panel">
        <h2>שיוך הקטגוריות מ-RiseUp</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>קטגוריה ב-RiseUp</th><th>סה״כ בטווח</th><th>קטגוריה עילית</th></tr></thead>
            <tbody>
              {allCats.map((c) => (
                <tr key={c}>
                  <td>{c}</td>
                  <td className="num muted">{stats[c] ? ils(stats[c].total) : '—'}</td>
                  <td>
                    <select value={groupOf[c] || ''} onChange={(e) => assign(c, e.target.value)} aria-label={`קטגוריה עילית עבור ${c}`}>
                      <option value="">בלי קבוצה</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

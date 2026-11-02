import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildModel, monthsBack, monthShort, monthLong, PALETTE, REST_COLOR } from './expenseCalc';
import { ils, pct } from './calc';
import { uid } from './constants';

const RANGES = [6, 12, 24];
const TOP = 6;

export default function Expenses({ family, api, loadTransactions }) {
  const [range, setRange] = useState(12);
  const [txs, setTxs] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState({ name: 'dash' });
  const months = useMemo(() => monthsBack(range), [range]);
  const groups = family.expenseGroups || [];

  const load = useCallback(async (force) => {
    setLoading(true); setError('');
    try { setTxs(await loadTransactions(months, force)); }
    catch (e) { setError(e.message); }
    setLoading(false);
  }, [months, loadTransactions]);
  useEffect(() => { load(false); }, [load]);

  const model = useMemo(() => (txs ? buildModel(txs, groups, months) : null), [txs, groups, months]);
  const saveGroups = (g) => api.updateFamily({ expenseGroups: g });

  return (
    <section>
      <div className="toolbar">
        <div className="seg" aria-label="טווח זמן">
          {RANGES.map((r) => (
            <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r} חודשים</button>
          ))}
        </div>
        <div className="row">
          <button className="btn ghost" onClick={() => load(true)} disabled={loading}>{loading ? 'טוען…' : 'רענון מ-RiseUp'}</button>
          {view.name === 'manage'
            ? <button className="btn primary" onClick={() => setView({ name: 'dash' })}>חזרה לדשבורד</button>
            : <button className="btn primary" onClick={() => setView({ name: 'manage' })}>קטגוריות עיליות</button>}
        </div>
      </div>

      {error && <div className="panel err-panel"><strong>לא הצלחנו לטעון את ההוצאות.</strong><p>{error}</p></div>}
      {!model && !error && <p className="muted">טוען הוצאות מ-RiseUp…</p>}

      {model && view.name === 'dash' && <Dashboard model={model} onOpen={(key) => setView({ name: 'unit', key })} onManage={() => setView({ name: 'manage' })} />}
      {model && view.name === 'unit' && (
        <UnitDetail model={model} unit={model.list.find((u) => u.key === view.key)} onBack={() => setView({ name: 'dash' })} />
      )}
      {model && view.name === 'manage' && <ManageGroups model={model} groups={groups} onSave={saveGroups} />}
    </section>
  );
}

/* ---------- dashboard ---------- */

function Dashboard({ model, onOpen, onManage }) {
  const { months, list, total, income, totalTrend } = model;
  const n = months.length;
  if (!list.length) {
    return <div className="empty"><h2>אין הוצאות בטווח הזה</h2><p>נסו טווח ארוך יותר, או רעננו את הנתונים מ-RiseUp.</p></div>;
  }
  const lastFull = months[n - 2];
  const balance = income[n - 2] - total[n - 2];
  const top = list.slice(0, TOP);
  const rest = list.slice(TOP);
  const series = [
    ...top.map((u) => ({ key: u.key, name: u.name, color: u.color, values: u.values })),
    ...(rest.length ? [{ key: 'rest', name: 'שאר', color: REST_COLOR, values: months.map((_, i) => rest.reduce((s, u) => s + u.values[i], 0)) }] : []),
  ];
  const ungrouped = list.filter((u) => !u.group).length;

  return (
    <>
      <div className="headline">
        <div className="big">
          <span className="label">הוצאות ב{monthLong(lastFull)}</span>
          <strong>{ils(total[n - 2])}</strong>
          <span className={`delta ${totalTrend.change > 0 ? 'down' : 'up'}`}>
            {totalTrend.change == null ? '' : `${pct(totalTrend.change)} מהממוצע החודשי (${ils(totalTrend.avg)})`}
          </span>
        </div>
        <dl className="facts">
          <div><dt>הכנסות באותו חודש</dt><dd>{ils(income[n - 2])}</dd></div>
          <div><dt>{balance >= 0 ? 'נשאר' : 'גירעון'}</dt><dd className={balance >= 0 ? 'up' : 'down'}>{ils(Math.abs(balance))}</dd></div>
          <div><dt>החודש עד כה</dt><dd>{ils(total[n - 1])}</dd></div>
        </dl>
      </div>

      <div className="chart-block">
        <h3>הוצאות לפי חודש</h3>
        <StackedBars months={months} series={series} income={income} />
      </div>

      {ungrouped > 0 && (
        <p className="hint">
          {ungrouped} קטגוריות עוד לא משויכות לקטגוריה עילית. <button className="link" onClick={onManage}>לשיוך</button>
        </p>
      )}

      <UnitTable rows={list} onOpen={onOpen} lastLabel={monthShort(lastFull)} />
    </>
  );
}

function UnitTable({ rows, onOpen, lastLabel }) {
  return (
    <div className="table-wrap">
      <table className="units">
        <thead>
          <tr><th>קטגוריה</th><th>מגמה</th><th>{lastLabel}</th><th>ממוצע לחודש</th><th>מול הממוצע</th></tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.key || u.name} className={onOpen ? 'clickable' : ''} onClick={onOpen ? () => onOpen(u.key) : undefined}
              tabIndex={onOpen ? 0 : undefined} onKeyDown={onOpen ? (e) => e.key === 'Enter' && onOpen(u.key) : undefined}>
              <td>
                <span className="unit-name"><i style={{ background: u.color }} />{u.name}</span>
                {u.group && <span className="unit-sub">{u.cats.length} קטגוריות</span>}
              </td>
              <td><Sparkline values={u.values} color={u.color} /></td>
              <td className="num">{ils(u.last)}</td>
              <td className="num muted">{ils(u.avg)}</td>
              <td className={`num ${u.change > 0.1 ? 'down' : u.change < -0.1 ? 'up' : 'muted'}`}>{pct(u.change, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- unit detail ---------- */

function UnitDetail({ model, unit, onBack }) {
  const { months } = model;
  const withData = months.filter((m, i) => unit && unit.values[i] > 0);
  const [month, setMonth] = useState(withData[withData.length - 1]);
  if (!unit) return <button className="link back" onClick={onBack}>חזרה לדשבורד</button>;

  const series = unit.cats.length > 1
    ? unit.cats.map((c, i) => ({ key: c.name, name: c.name, color: PALETTE[i % PALETTE.length], values: c.values }))
    : [{ key: unit.key, name: unit.name, color: unit.color, values: unit.values }];
  const cats = unit.cats.map((c, i) => ({ ...c, color: series[i]?.color || unit.color }));
  const list = model.tx.filter((t) => t.unit === unit.key && t.month === month).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="detail">
      <button className="link back" onClick={onBack}>חזרה לדשבורד</button>
      <header className="detail-head">
        <div>
          <h1>{unit.name}</h1>
          {unit.group && <p className="meta">{unit.cats.map((c) => c.name).join(', ')}</p>}
        </div>
      </header>
      <dl className="stats">
        <div><dt>חודש שעבר</dt><dd>{ils(unit.last)}</dd></div>
        <div><dt>ממוצע לחודש</dt><dd>{ils(unit.avg)}</dd></div>
        <div><dt>מול הממוצע</dt><dd className={unit.change > 0 ? 'down' : 'up'}>{pct(unit.change, 0)}</dd></div>
        <div><dt>סה״כ בטווח</dt><dd>{ils(unit.sum)}</dd></div>
      </dl>

      <div className="chart-block">
        <StackedBars months={months} series={series} avg={unit.avg} />
      </div>

      {unit.cats.length > 1 && (
        <>
          <h2 className="sec">קטגוריות בתוך {unit.name}</h2>
          <UnitTable rows={cats} lastLabel={monthShort(months[months.length - 2])} />
        </>
      )}

      <h2 className="sec">עסקאות</h2>
      <div className="chips month-chips">
        {withData.map((m) => (
          <button key={m} className={m === month ? 'on' : ''} onClick={() => setMonth(m)}>{monthShort(m)} {m.slice(2, 4)}</button>
        ))}
      </div>
      <ul className="tx-list">
        {list.map((t) => (
          <li key={t.id}>
            <span className="tx-biz">{t.business}<small>{t.date.split('-').reverse().join('/')}{unit.cats.length > 1 ? ` · ${t.category}` : ''}{t.fixed ? ' · קבועה' : ''}</small></span>
            <span className="num">{ils(t.amount)}</span>
          </li>
        ))}
        {!list.length && <li className="muted">אין עסקאות בחודש הזה.</li>}
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
        <h2>קטגוריות עיליות</h2>
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
        <h2>שיוך הקטגוריות שלך מ-RiseUp</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>קטגוריה ב-RiseUp</th><th>בטווח</th><th>קטגוריה עילית</th></tr></thead>
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

/* ---------- charts ---------- */

function StackedBars({ months, series, income, avg }) {
  const totals = months.map((_, i) => series.reduce((s, x) => s + x.values[i], 0));
  const max = Math.max(...totals, ...(income || [0]), avg || 0, 1);
  const last = months.length - 1;
  return (
    <div className="sbars-wrap">
      <div className="sbars" dir="ltr">
        {avg > 0 && <div className="sbar-avg" style={{ '--p': avg / max }}><span>ממוצע {ils(avg)}</span></div>}
        {months.map((m, i) => (
          <div key={m} className={`sbar-col${i === last ? ' partial' : ''}`}>
            <div className="sbar-stack" title={`${monthLong(m)}: ${ils(totals[i])}${i === last ? ' (עד כה)' : ''}`}>
              {series.map((s) => s.values[i] > 0 && (
                <span key={s.key} style={{ height: `${(s.values[i] / max) * 100}%`, background: s.color }} title={`${s.name}: ${ils(s.values[i])}`} />
              ))}
              {income && income[i] > 0 && <i className="sbar-income" style={{ bottom: `${(income[i] / max) * 100}%` }} title={`הכנסות: ${ils(income[i])}`} />}
            </div>
            <span className="sbar-label">{monthShort(m)}</span>
          </div>
        ))}
      </div>
      <div className="alloc-legend">
        {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.name}</span>)}
        {income && <span><i className="lg-income" />הכנסות</span>}
        <span className="muted">החודש הנוכחי חלקי</span>
      </div>
    </div>
  );
}

function Sparkline({ values, color }) {
  const W = 96, H = 26;
  const v = values.slice(0, -1); // בלי החודש החלקי
  if (v.length < 2) return null;
  const max = Math.max(...v, 1);
  const pts = v.map((x, i) => [(i / (v.length - 1)) * (W - 4) + 2, H - 3 - (x / max) * (H - 6)]);
  return (
    <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} dir="ltr" aria-hidden="true">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
    </svg>
  );
}

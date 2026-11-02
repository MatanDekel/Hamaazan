import { useState } from 'react';
import { monthLong, PALETTE, REST_COLOR, fullAvg } from './expenseCalc';
import { ils, pct } from './calc';
import { StackedBars, PairBars, TrendTable } from './charts';
import { LoadState } from './Expenses';

const RANGES = [6, 12, 24];
const TOP = 6;

export default function Dashboards({ exp, model }) {
  const [top, setTop] = useState('');
  const [sub, setSub] = useState('');
  const unit = model && top ? model.list.find((u) => u.key === top) : null;
  const pickTop = (key) => { setTop(key); setSub(''); };
  const pickSub = (name) => {
    setSub(name);
    if (name && (!unit || !unit.cats.some((c) => c.name === name))) {
      const owner = model.list.find((u) => u.cats.some((c) => c.name === name));
      if (owner) setTop(owner.key);
    }
  };

  return (
    <section>
      <div className="toolbar">
        <h1 className="page-title">דשבורדים</h1>
        <div className="row">
          <div className="seg" aria-label="טווח זמן">
            {RANGES.map((r) => <button key={r} className={exp.range === r ? 'on' : ''} onClick={() => exp.setRange(r)}>{r} חודשים</button>)}
          </div>
          <button className="btn ghost" onClick={exp.reload} disabled={exp.loading}>{exp.loading ? 'טוען…' : 'רענון'}</button>
        </div>
      </div>
      <LoadState exp={exp} model={model} />
      {model && (
        <>
          <FilterBar model={model} unit={unit} top={top} sub={sub} onTop={pickTop} onSub={pickSub} onClear={() => pickTop('')} />
          {unit
            ? <Filtered model={model} unit={unit} sub={sub} onSub={pickSub} />
            : <Overview model={model} onOpen={pickTop} />}
        </>
      )}
    </section>
  );
}

function FilterBar({ model, unit, top, sub, onTop, onSub, onClear }) {
  const subs = unit ? unit.cats.map((c) => c.name) : model.categories.map((c) => c.name);
  return (
    <div className="filter-bar">
      <label>קטגוריה עילית
        <select value={top} onChange={(e) => onTop(e.target.value)}>
          <option value="">כל ההוצאות וההכנסות</option>
          {model.list.map((u) => <option key={u.key} value={u.key}>{u.name}{u.group ? '' : ' (בלי קבוצה)'}</option>)}
        </select>
      </label>
      <label>קטגוריה משנית
        <select value={sub} onChange={(e) => onSub(e.target.value)} disabled={unit && unit.cats.length < 2}>
          <option value="">{unit ? `כל ${unit.name}` : 'הכול'}</option>
          {subs.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      {top && <button className="link" onClick={onClear}>ניקוי סינון</button>}
    </div>
  );
}

function Overview({ model, onOpen }) {
  const { months, list, incomeList, total, income } = model;
  const lastFull = months[months.length - 2];
  const avgIn = fullAvg(income), avgOut = fullAvg(total);
  const rate = avgIn ? (avgIn - avgOut) / avgIn : null;
  const from = monthLong(months[0]), to = monthLong(lastFull);

  const top = list.slice(0, TOP), rest = list.slice(TOP);
  const series = [
    ...top.map((u) => ({ key: u.key, name: u.name, color: u.color, values: u.values })),
    ...(rest.length ? [{ key: 'rest', name: 'שאר', color: REST_COLOR, values: months.map((_, i) => rest.reduce((s, u) => s + u.values[i], 0)) }] : []),
  ];

  return (
    <>
      <p className="range-note">ממוצעים לפי החודשים המלאים: {from} עד {to}</p>
      <dl className="month-summary">
        <div><dt>הכנסה ממוצעת לחודש</dt><dd>{ils(avgIn)}</dd></div>
        <div><dt>הוצאה ממוצעת לחודש</dt><dd>{ils(avgOut)}</dd></div>
        <div><dt>נשאר בממוצע</dt><dd className={avgIn - avgOut >= 0 ? 'up' : 'down'}>{ils(avgIn - avgOut)}</dd></div>
        <div><dt>שיעור חיסכון</dt><dd>{rate == null ? '—' : `${Math.round(rate * 100)}%`}</dd></div>
      </dl>

      <div className="dash-block">
        <h2 className="sec">הכנסות מול הוצאות</h2>
        <PairBars months={months} income={income} expense={total} />
      </div>

      <div className="dash-block">
        <h2 className="sec">הוצאות לפי קטגוריה</h2>
        <StackedBars months={months} series={series} />
        <TrendTable rows={list} lastMonth={lastFull} onOpen={onOpen} />
      </div>

      <div className="dash-block">
        <h2 className="sec">הכנסות לפי מקור</h2>
        {incomeList.length ? (
          <>
            <StackedBars months={months} series={incomeList.map((u) => ({ key: u.key, name: u.name, color: u.color, values: u.values }))} />
            <TrendTable rows={incomeList} lastMonth={lastFull} higherIsGood title="מקור" />
          </>
        ) : <p className="muted">אין הכנסות בטווח הזה.</p>}
      </div>
    </>
  );
}

function Filtered({ model, unit, sub, onSub }) {
  const { months } = model;
  const lastFull = months[months.length - 2];
  const cat = sub ? unit.cats.find((c) => c.name === sub) : null;
  const target = cat || unit;
  const series = cat
    ? [{ key: cat.name, name: cat.name, color: unit.color, values: cat.values }]
    : unit.cats.length > 1
      ? unit.cats.map((c, i) => ({ key: c.name, name: c.name, color: PALETTE[i % PALETTE.length], values: c.values }))
      : [{ key: unit.key, name: unit.name, color: unit.color, values: unit.values }];
  const subRows = cat ? [] : unit.cats.map((c, i) => ({ ...c, key: c.name, color: series[i]?.color || unit.color }));
  const allSpent = model.total.reduce((a, b) => a + b, 0);

  // בתי העסק שבהם הוצא הכי הרבה בסינון הזה
  const [openM, setOpenM] = useState(null);
  const merchants = {};
  model.tx.filter((t) => t.unit === unit.key && (!cat || t.category === cat.name)).forEach((t) => {
    const m = merchants[t.business] || (merchants[t.business] = { name: t.business, total: 0, count: 0, tx: [] });
    m.total += t.amount; m.count++; m.tx.push(t);
  });
  const topMerchants = Object.values(merchants).sort((a, b) => b.total - a.total).slice(0, 8);

  return (
    <div className="detail">
      <h2 className="filter-title">{unit.name}{cat && <span> › {cat.name}</span>}</h2>
      <p className="range-note">{monthLong(months[0])} עד {monthLong(months[months.length - 1])}</p>
      <dl className="stats">
        <div><dt>{monthLong(lastFull)}</dt><dd>{ils(target.last)}</dd></div>
        <div><dt>ממוצע לחודש</dt><dd>{ils(target.avg)}</dd></div>
        <div><dt>מול הממוצע</dt><dd className={target.change > 0.1 ? 'down' : target.change < -0.1 ? 'up' : ''}>{pct(target.change, 0)}</dd></div>
        <div><dt>סה״כ בטווח</dt><dd>{ils(target.sum)}</dd></div>
        <div><dt>חלק מכל ההוצאות</dt><dd>{allSpent ? `${Math.round((target.sum / allSpent) * 100)}%` : '—'}</dd></div>
      </dl>
      <div className="dash-block">
        <StackedBars months={months} series={series} avg={target.avg} />
      </div>
      {subRows.length > 1 && (
        <div className="dash-block">
          <h2 className="sec">הקטגוריות בתוך {unit.name}</h2>
          <TrendTable rows={subRows} lastMonth={lastFull} onOpen={onSub} />
        </div>
      )}
      {topMerchants.length > 0 && (
        <div className="dash-block">
          <h2 className="sec">איפה הוצאת הכי הרבה</h2>
          <ul className="merchants">
            {topMerchants.map((m) => (
              <li key={m.name} className={openM === m.name ? 'open' : ''}>
                <button className="m-row" onClick={() => setOpenM(openM === m.name ? null : m.name)} aria-expanded={openM === m.name}>
                  <span>{m.name}<small>{m.count} עסקאות · לחצו לפירוט</small></span>
                  <span className="mc-bar"><i style={{ width: `${(m.total / topMerchants[0].total) * 100}%`, background: unit.color }} /></span>
                  <span className="num">{ils(m.total)}</span>
                </button>
                {openM === m.name && (
                  <ul className="tx-list m-tx">
                    {[...m.tx].sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
                      <li key={t.id}>
                        <span className="tx-biz">{t.date.split('-').reverse().join('/')}<small>{t.category}{t.fixed ? ' · קבועה' : ''}</small></span>
                        <span className="num">{ils(t.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

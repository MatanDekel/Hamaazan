import { useState } from 'react';
import { monthLong, PALETTE, REST_COLOR, fullAvg } from './expenseCalc';
import { ils, pct } from './calc';
import { StackedBars, PairBars, TrendTable } from './charts';
import { LoadState } from './Expenses';

const RANGES = [6, 12, 24];
const TOP = 6;

export default function Dashboards({ exp, model }) {
  const [unitKey, setUnitKey] = useState(null);
  const unit = model && unitKey && [...model.list, ...model.incomeList].find((u) => u.key === unitKey);

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
      {model && (unit
        ? <UnitDetail model={model} unit={unit} onBack={() => setUnitKey(null)} />
        : <Overview model={model} onOpen={setUnitKey} />)}
    </section>
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
            <TrendTable rows={incomeList} lastMonth={lastFull} onOpen={onOpen} higherIsGood title="מקור" />
          </>
        ) : <p className="muted">אין הכנסות בטווח הזה.</p>}
      </div>
    </>
  );
}

function UnitDetail({ model, unit, onBack }) {
  const { months } = model;
  const cats = unit.cats || [];
  const series = cats.length > 1
    ? cats.map((c, i) => ({ key: c.name, name: c.name, color: PALETTE[i % PALETTE.length], values: c.values }))
    : [{ key: unit.key, name: unit.name, color: unit.color, values: unit.values }];
  const subRows = cats.map((c, i) => ({ ...c, color: series[i]?.color || unit.color }));
  const isIncome = unit.key.startsWith('i:');
  const lastFull = months[months.length - 2];

  return (
    <div className="detail">
      <button className="link back" onClick={onBack}>חזרה לדשבורדים</button>
      <header className="detail-head">
        <div>
          <h1>{unit.name}</h1>
          {unit.group && <p className="meta">{cats.map((c) => c.name).join(', ')}</p>}
        </div>
      </header>
      <dl className="stats">
        <div><dt>{monthLong(lastFull)}</dt><dd>{ils(unit.last)}</dd></div>
        <div><dt>ממוצע לחודש</dt><dd>{ils(unit.avg)}</dd></div>
        <div><dt>מול הממוצע</dt><dd className={(unit.change > 0) === isIncome ? 'up' : 'down'}>{pct(unit.change, 0)}</dd></div>
        <div><dt>סה״כ מ{monthLong(months[0])}</dt><dd>{ils(unit.sum)}</dd></div>
      </dl>
      <div className="dash-block">
        <StackedBars months={months} series={series} avg={unit.avg} />
      </div>
      {cats.length > 1 && (
        <>
          <h2 className="sec">הקטגוריות בתוך {unit.name}</h2>
          <TrendTable rows={subRows} lastMonth={lastFull} />
        </>
      )}
    </div>
  );
}

import { ils, pct } from './calc';
import { monthShort, monthLong } from './expenseCalc';

function MonthLabel({ m, i }) {
  return (
    <span className="sbar-label">
      {monthShort(m)}
      {(i === 0 || m.endsWith('-01')) && <small>{m.slice(0, 4)}</small>}
    </span>
  );
}

export function StackedBars({ months, series, income, avg, selected, onSelect }) {
  const totals = months.map((_, i) => series.reduce((s, x) => s + x.values[i], 0));
  const max = Math.max(...totals, ...(income || [0]), avg || 0, 1);
  const last = months.length - 1;
  return (
    <div className="sbars-wrap">
      <div className="sbars" dir="ltr">
        {avg > 0 && <div className="sbar-avg" style={{ '--p': avg / max }}><span dir="rtl">ממוצע {ils(avg)}</span></div>}
        {months.map((m, i) => (
          <button type="button" key={m}
            className={`sbar-col${i === last ? ' partial' : ''}${selected === m ? ' sel' : ''}${onSelect ? ' pick' : ''}`}
            onClick={onSelect ? () => onSelect(m) : undefined} tabIndex={onSelect ? 0 : -1}
            aria-label={`${monthLong(m)}: ${ils(totals[i])}`}>
            <div className="sbar-stack" title={`${monthLong(m)}: ${ils(totals[i])}${i === last ? ' (עד היום)' : ''}`}>
              {series.map((s) => s.values[i] > 0 && (
                <span key={s.key} style={{ height: `${(s.values[i] / max) * 100}%`, background: s.color }} title={`${s.name}: ${ils(s.values[i])}`} />
              ))}
              {income && income[i] > 0 && <i className="sbar-income" style={{ bottom: `${(income[i] / max) * 100}%` }} title={`הכנסות: ${ils(income[i])}`} />}
            </div>
            <MonthLabel m={m} i={i} />
          </button>
        ))}
      </div>
      <div className="alloc-legend">
        {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.name}</span>)}
        {income && <span><i className="lg-income" />הכנסות</span>}
        <span className="muted">העמודה האחרונה היא החודש הנוכחי, עד היום</span>
      </div>
    </div>
  );
}

// הכנסות מול הוצאות — שתי עמודות לכל חודש
export function PairBars({ months, income, expense }) {
  const max = Math.max(...income, ...expense, 1);
  const last = months.length - 1;
  return (
    <div className="sbars-wrap">
      <div className="sbars" dir="ltr">
        {months.map((m, i) => {
          const net = income[i] - expense[i];
          return (
            <div key={m} className={`sbar-col pair${i === last ? ' partial' : ''}`} title={`${monthLong(m)} — הכנסות ${ils(income[i])}, הוצאות ${ils(expense[i])}`}>
              <div className="sbar-pair">
                <span className="b-in" style={{ height: `${(income[i] / max) * 100}%` }} />
                <span className="b-out" style={{ height: `${(expense[i] / max) * 100}%` }} />
              </div>
              <span className={`pair-net ${net >= 0 ? 'up' : 'down'}`}>{i === last ? '' : `${net >= 0 ? '+' : '−'}${Math.round(Math.abs(net) / 1000)}K`}</span>
              <MonthLabel m={m} i={i} />
            </div>
          );
        })}
      </div>
      <div className="alloc-legend">
        <span><i style={{ background: 'var(--up)' }} />הכנסות</span>
        <span><i style={{ background: 'var(--down)' }} />הוצאות</span>
        <span className="muted">המספר מתחת לכל חודש: כמה נשאר, באלפי ₪</span>
      </div>
    </div>
  );
}

export function Sparkline({ values, color }) {
  const W = 96, H = 26;
  const v = values.slice(0, -1);
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

// טבלת מגמות: החודש המלא האחרון מול הממוצע. higherIsGood=true להכנסות
export function TrendTable({ rows, lastMonth, onOpen, higherIsGood = false, title = 'קטגוריה' }) {
  const toneOf = (c) => (c == null || Math.abs(c) <= 0.1 ? 'muted' : (c > 0) === higherIsGood ? 'up' : 'down');
  return (
    <div className="table-wrap">
      <table className="units">
        <thead>
          <tr><th>{title}</th><th>מגמה</th><th>{monthLong(lastMonth)}</th><th>ממוצע לחודש</th><th>מול הממוצע</th></tr>
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
              <td className={`num ${toneOf(u.change)}`}>{pct(u.change, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

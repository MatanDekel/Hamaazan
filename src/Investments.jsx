import { useMemo, useState } from 'react';
import { analyzeFund, ils, pct, tone, dateFmt } from './calc';
import { TRACKS, kindOf } from './constants';
import { AllocationBar } from './ui';

export default function Investments({ funds, family, onOpen, onAdd }) {
  const [owner, setOwner] = useState('all');

  const items = useMemo(
    () => funds
      .map((f) => ({ f, a: analyzeFund(f) }))
      .sort((x, y) => (y.a.balance ?? y.a.principal) - (x.a.balance ?? x.a.principal)),
    [funds],
  );
  const shown = owner === 'all' ? items : items.filter((i) => i.f.owner === owner);

  const totals = shown.reduce(
    (t, { f, a }) => {
      const value = a.balance ?? a.principal;
      t.value += value;
      t.principal += a.principal;
      t.monthly += +f.monthlyDeposit || 0;
      t.byKind[kindOf(f)] = (t.byKind[kindOf(f)] || 0) + value;
      t.byCompany[f.company] = (t.byCompany[f.company] || 0) + value;
      t.byOwner[f.owner] = (t.byOwner[f.owner] || 0) + value;
      (f.allocation || []).forEach((al) => { t.byTrack[al.track] = (t.byTrack[al.track] || 0) + (value * al.pct) / 100; });
      return t;
    },
    { value: 0, principal: 0, monthly: 0, byKind: {}, byCompany: {}, byOwner: {}, byTrack: {} },
  );
  const profit = totals.value - totals.principal;
  const trackAlloc = Object.entries(totals.byTrack).map(([track, v]) => ({ track, pct: totals.value ? (v / totals.value) * 100 : 0 }));
  const owners = family.owners || [];

  return (
    <section>
      <div className="toolbar">
        <div className="seg" role="tablist" aria-label="סינון לפי בעלים">
          <button className={owner === 'all' ? 'on' : ''} onClick={() => setOwner('all')}>כולם</button>
          {owners.map((o) => (
            <button key={o} className={owner === o ? 'on' : ''} onClick={() => setOwner(o)}>{o}</button>
          ))}
        </div>
        <button className="btn primary" onClick={onAdd}>הוספת חיסכון</button>
      </div>

      {funds.length === 0 ? (
        <div className="empty">
          <h2>עוד אין כאן חסכונות</h2>
          <p>הוסיפו את החיסכון הראשון — קופת גמל, פנסיה או קרן השתלמות — ומשם נתחיל לעקוב אחרי התשואה.</p>
          <button className="btn primary" onClick={onAdd}>הוספת חיסכון</button>
        </div>
      ) : (
        <>
          <div className="headline">
            <div className="big">
              <span className="label">שווי כולל</span>
              <strong>{ils(totals.value)}</strong>
              <span className={`delta ${tone(profit)}`}>
                {profit >= 0 ? 'רווח' : 'הפסד'} של {ils(Math.abs(profit))} על {ils(totals.principal)} שהופקדו
              </span>
            </div>
            <dl className="facts">
              <div><dt>הפקדה חודשית</dt><dd>{ils(totals.monthly)}</dd></div>
              <div><dt>חסכונות</dt><dd>{shown.length}</dd></div>
            </dl>
          </div>

          <div className="breakdown">
            <div>
              <h3>חלוקה לפי מסלול</h3>
              <AllocationBar allocation={trackAlloc} showLegend />
            </div>
            <Split title="לפי סוג" data={totals.byKind} total={totals.value} />
            <Split title="לפי חברה" data={totals.byCompany} total={totals.value} />
            {owner === 'all' && <Split title="לפי בעלים" data={totals.byOwner} total={totals.value} />}
          </div>

          <ul className="fund-list">
            {shown.map(({ f, a }) => (
              <li key={f.id}>
                <button className="fund-row" onClick={() => onOpen(f.id)}>
                  <div className="fr-main">
                    <span className="fr-name">{f.name}</span>
                    <span className="fr-meta">{kindOf(f)} · {f.company} · {f.owner}</span>
                    <AllocationBar allocation={f.allocation} />
                  </div>
                  <div className="fr-nums">
                    <span className="fr-bal">{ils(a.balance ?? a.principal)}</span>
                    <span className={`fr-ret ${tone(a.cumR)}`}>
                      {a.cumR != null ? `${pct(a.cumR)} מסלול` : 'אין עדיין היסטוריה'}
                    </span>
                    <span className="fr-date">{a.asOf ? `עודכן ${dateFmt(a.asOf)}` : 'טרם עודכנה יתרה'}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Split({ title, data, total }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <h3>{title}</h3>
      <ul className="split">
        {entries.map(([k, v]) => (
          <li key={k}>
            <span>{TRACKS[k]?.label ?? k}</span>
            <span className="split-bar"><i style={{ width: `${total ? (v / total) * 100 : 0}%` }} /></span>
            <span className="num">{ils(v)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

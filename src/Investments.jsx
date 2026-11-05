import { useMemo, useState } from 'react';
import { analyzeFund, ils, pct, tone, dateFmt, yearDeposits } from './calc';
import { TRACKS, kindOf, DEFAULT_CAP, CAPPED_KINDS, KINDS, uid } from './constants';
import { useState as useStateG } from 'react';
import { AllocationBar, Modal } from './ui';

export default function Investments({ funds, family, api, onOpen, onAdd }) {
  const [owner, setOwner] = useState('all');

  const items = useMemo(
    () => funds
      .map((f) => ({ f, a: analyzeFund(f) }))
      .sort((x, y) => (y.a.balance ?? y.a.principal) - (x.a.balance ?? x.a.principal)),
    [funds],
  );
  const shown = owner === 'all' ? items : owner === 'shared' ? items.filter((i) => i.f.shared) : items.filter((i) => i.f.owner === owner);

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
          {funds.some((f) => f.shared) && <button className={owner === 'shared' ? 'on' : ''} onClick={() => setOwner('shared')}>משותפים</button>}
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

          <GroupTiles items={shown} allFunds={funds} groups={family.fundGroups} onSave={(g) => api.updateFamily({ fundGroups: g })} />

          <DepositCap funds={funds} owners={owners} cap={family.depositCap ?? DEFAULT_CAP} onCap={(v) => api.updateFamily({ depositCap: v })} />

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
                    <span className="fr-meta">
                      {kindOf(f)} · {f.company} · {f.owner}
                      {f.shared && <span className="tag">משותף</span>}
                    </span>
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

function DepositCap({ funds, owners, cap, onCap }) {
  const year = new Date().getFullYear();
  const capped = funds.filter((f) => CAPPED_KINDS.includes(f.kind || 'gemel'));
  if (!capped.length) return null;
  const rows = owners.map((o) => {
    const mine = capped.filter((f) => f.owner === o);
    const parts = mine.map((f) => ({ f, ...yearDeposits(f, year) }));
    const total = parts.reduce((t, p) => t + p.total, 0);
    return { o, parts, total, left: cap - total };
  }).filter((r) => r.parts.length);

  return (
    <div className="cap">
      <div className="cap-head">
        <h3>תקרת הפקדה ל{KINDS.gemel} ב-{year}</h3>
        <label className="cap-input">תקרה לאדם
          <input type="number" min="0" step="100" defaultValue={cap} onBlur={(e) => +e.target.value > 0 && +e.target.value !== cap && onCap(+e.target.value)} />
        </label>
      </div>
      <p className="muted">נספר לפי מי שהחיסכון רשום על שמו, כולל חסכונות משותפים. הפקדה חודשית × 12, ועוד הפקדות חד-פעמיות השנה.</p>
      <ul className="cap-list">
        {rows.map((r) => (
          <li key={r.o}>
            <div className="cap-line">
              <strong>{r.o}</strong>
              <span className="num">{ils(r.total)} מתוך {ils(cap)}</span>
            </div>
            <div className="cap-bar"><i className={r.left < 0 ? 'over' : ''} style={{ width: `${Math.min(100, (r.total / cap) * 100)}%` }} /></div>
            <div className={`cap-left ${r.left < 0 ? 'down' : 'muted'}`}>
              {r.left < 0 ? `חריגה של ${ils(-r.left)} מעל התקרה` : `אפשר להפקיד עוד ${ils(r.left)} השנה`}
            </div>
            <ul className="cap-parts">
              {r.parts.map((p) => (
                <li key={p.f.id}>
                  <span>{p.f.name}{p.f.shared && <span className="tag">משותף</span>}</span>
                  <span className="num muted">{ils(p.monthly)}{p.lumps ? ` + ${ils(p.lumps)} חד-פעמי` : ''}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- רובריקות: קבוצות חסכונות שהצבירה שלהן מוצגת יחד ---------- */

// ברירת מחדל עד שמגדירים לבד: לפי סוג החיסכון
function defaultGroups(funds) {
  const by = (pred) => funds.filter(pred).map((f) => f.id);
  return [
    { id: 'd-pension', name: 'פנסיה', fundIds: by((f) => f.kind === 'pension') },
    { id: 'd-gemel', name: 'קופות גמל', fundIds: by((f) => !f.kind || f.kind === 'gemel') },
    { id: 'd-hish', name: 'קרן השתלמות', fundIds: by((f) => f.kind === 'hishtalmut') },
    { id: 'd-other', name: 'השאר', fundIds: by((f) => f.kind && !['pension', 'gemel', 'hishtalmut'].includes(f.kind)) },
  ];
}

function GroupTiles({ items, allFunds, groups, onSave }) {
  const [editing, setEditing] = useStateG(false);
  const custom = Array.isArray(groups) && groups.length > 0;
  const list = custom ? groups : defaultGroups(allFunds);
  const byId = Object.fromEntries(items.map((i) => [i.f.id, i]));

  const tiles = list.map((g) => {
    const members = g.fundIds.map((id) => byId[id]).filter(Boolean);
    const value = members.reduce((t, { a }) => t + (a.balance ?? a.principal), 0);
    const principal = members.reduce((t, { a }) => t + a.principal, 0);
    const monthly = members.reduce((t, { f }) => t + (+f.monthlyDeposit || 0), 0);
    return { ...g, members, value, principal, monthly, profit: value - principal };
  }).filter((t) => t.members.length);
  const grouped = new Set(list.flatMap((g) => g.fundIds));
  const loose = items.filter((i) => !grouped.has(i.f.id));

  return (
    <div className="group-tiles">
      <div className="gt-head">
        <h3>לפי רובריקות</h3>
        <button className="link" onClick={() => setEditing(true)}>עריכת רובריקות</button>
      </div>
      <div className="gt-grid">
        {tiles.map((t) => (
          <div key={t.id} className="gt-tile">
            <span className="gt-name">{t.name}</span>
            <strong className="gt-value">{ils(t.value)}</strong>
            <span className={`gt-profit ${tone(t.profit)}`}>
              {t.profit >= 0 ? '+' : '−'}{ils(Math.abs(t.profit))}{t.principal > 0 ? ` · ${pct(t.profit / t.principal)}` : ''}
            </span>
            <span className="gt-meta">הופקדו {ils(t.principal)} · {ils(t.monthly)} בחודש</span>
            <span className="gt-members">{t.members.map(({ f }) => f.name).join(' · ')}</span>
          </div>
        ))}
        {custom && loose.length > 0 && (
          <div className="gt-tile loose">
            <span className="gt-name">לא בשום רובריקה</span>
            <strong className="gt-value">{ils(loose.reduce((t, { a }) => t + (a.balance ?? a.principal), 0))}</strong>
            <span className="gt-members">{loose.map(({ f }) => f.name).join(' · ')}</span>
          </div>
        )}
      </div>
      {editing && <GroupsEditor funds={allFunds} groups={list} custom={custom} onClose={() => setEditing(false)} onSave={onSave} />}
    </div>
  );
}

function GroupsEditor({ funds, groups, custom, onClose, onSave }) {
  const [gs, setGs] = useStateG(() => groups.map((g) => ({ ...g, id: g.id.startsWith('d-') ? uid() : g.id, fundIds: [...g.fundIds] })));
  const [err, setErr] = useStateG('');
  const upd = (id, patch) => setGs((x) => x.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const toggle = (g, fid) => upd(g.id, { fundIds: g.fundIds.includes(fid) ? g.fundIds.filter((x) => x !== fid) : [...g.fundIds, fid] });
  const save = async () => {
    const clean = gs.map((g) => ({ ...g, name: g.name.trim() })).filter((g) => g.name);
    if (!clean.length) return setErr('צריך לפחות רובריקה אחת עם שם.');
    try { await onSave(clean); onClose(); } catch (e) { setErr('השמירה נכשלה: ' + e.message); }
  };

  return (
    <Modal title="עריכת רובריקות" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>בחרי אילו חסכונות נספרים יחד בכל רובריקה. חיסכון יכול להיות ביותר מרובריקה אחת.</p>
      <div className="ge-list">
        {gs.map((g) => (
          <fieldset key={g.id} className="ge-group">
            <div className="ge-top">
              <input value={g.name} onChange={(e) => upd(g.id, { name: e.target.value })} placeholder="שם הרובריקה" aria-label="שם הרובריקה" />
              <button type="button" className="icon-btn" onClick={() => setGs((x) => x.filter((y) => y.id !== g.id))} aria-label={`מחיקת ${g.name}`}>✕</button>
            </div>
            <div className="ge-funds">
              {funds.map((f) => (
                <label key={f.id} className={`ge-fund${g.fundIds.includes(f.id) ? ' on' : ''}`}>
                  <input type="checkbox" checked={g.fundIds.includes(f.id)} onChange={() => toggle(g, f.id)} />
                  <span>{f.name}<small>{kindOf(f)} · {f.owner}{f.shared ? ' · משותף' : ''}</small></span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <button type="button" className="btn ghost" onClick={() => setGs((x) => [...x, { id: uid(), name: '', fundIds: [] }])}>הוספת רובריקה</button>
      {err && <p className="err">{err}</p>}
      <div className="form-actions">
        {custom && (
          <button type="button" className="btn ghost" style={{ marginInlineEnd: 'auto' }}
            onClick={async () => { await onSave([]); onClose(); }}>חזרה לחלוקה לפי סוג</button>
        )}
        <button type="button" className="btn ghost" onClick={onClose}>ביטול</button>
        <button type="button" className="btn primary" onClick={save}>שמירה</button>
      </div>
    </Modal>
  );
}

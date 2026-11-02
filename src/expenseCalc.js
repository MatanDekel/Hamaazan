// צבעי בסיס ואחריהם פסטלים — לקטגוריות ולגרפים
export const PALETTE = [
  '#5e7a5b', '#c9714f', '#e39a45', '#9c7a5e', '#a8c09a', '#f0b49a',
  '#f3cd8a', '#cdb39b', '#9fc3b9', '#dba7b5', '#b8b2d8', '#e3d48f',
];
export const REST_COLOR = 'var(--t-solid)';

const pad = (n) => String(n).padStart(2, '0');
export function monthsBack(n, end = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  }
  return out;
}
const mDate = (m) => { const [y, mm] = m.split('-'); return new Date(+y, +mm - 1, 1); };
export const monthShort = (m) => mDate(m).toLocaleDateString('he-IL', { month: 'short' }).replace('׳', '').replace('.', '');
export const monthLong = (m) => mDate(m).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
export const monthName = (m) => mDate(m).toLocaleDateString('he-IL', { month: 'long' });
export const INCOME_COLORS = ['#5e7a5b', '#a8c09a', '#9fc3b9', '#e39a45', '#f3cd8a'];

const sum = (a) => a.reduce((x, y) => x + y, 0);

/*
  "יחידה" = קטגוריה עילית שהוגדרה, או קטגוריה של RiseUp שלא שויכה לשום קבוצה.
  החודש האחרון בטווח הוא החודש הנוכחי (חלקי), ולכן ההשוואה נעשית על החודש המלא האחרון
  מול הממוצע של החודשים המלאים.
*/
// names: שינויי שם לקטגוריות של RiseUp — { שם מקורי: שם תצוגה }
export function buildModel(txs, groups, months, names = {}) {
  const idx = Object.fromEntries(months.map((m, i) => [m, i]));
  const zero = () => months.map(() => 0);
  const catToGroup = {};
  groups.forEach((g) => g.categories.forEach((c) => { catToGroup[c] = g; }));

  const units = new Map();
  groups.forEach((g, gi) => units.set('g:' + g.id, {
    key: 'g:' + g.id, name: g.name, group: g, values: zero(), cats: new Map(), color: PALETTE[gi % PALETTE.length],
  }));
  const income = zero(), total = zero();
  const catStats = new Map();
  const tx = [];
  const incomeCats = new Map();

  const origNames = {};
  for (const raw of txs) {
    const t = names[raw.category] ? { ...raw, category: names[raw.category] } : raw;
    (origNames[t.category] ||= new Set()).add(raw.category);
    const i = idx[t.month];
    if (i == null || t.excluded) continue;
    if (t.income) {
      income[i] += t.amount;
      if (!incomeCats.has(t.category)) incomeCats.set(t.category, zero());
      incomeCats.get(t.category)[i] += t.amount;
      tx.push({ ...t, unit: 'income' });
      continue;
    }
    total[i] += t.amount;
    const cs = catStats.get(t.category) || { name: t.category, total: 0, count: 0 };
    cs.total += t.amount; cs.count++;
    catStats.set(t.category, cs);
    const g = catToGroup[t.category];
    const key = g ? 'g:' + g.id : 'c:' + t.category;
    if (!units.has(key)) units.set(key, { key, name: t.category, group: null, values: zero(), cats: new Map(), color: null });
    const u = units.get(key);
    u.values[i] += t.amount;
    if (!u.cats.has(t.category)) u.cats.set(t.category, zero());
    u.cats.get(t.category)[i] += t.amount;
    tx.push({ ...t, unit: key });
  }

  let k = groups.length;
  const list = [...units.values()]
    .map((u) => ({
      ...u,
      sum: sum(u.values),
      cats: [...u.cats.entries()].map(([name, values]) => ({ name, values, sum: sum(values), ...trend(values) })).sort((a, b) => b.sum - a.sum),
      ...trend(u.values),
    }))
    .filter((u) => u.sum > 0 || u.group)
    .sort((a, b) => b.sum - a.sum);
  list.forEach((u) => { if (!u.color) u.color = PALETTE[k++ % PALETTE.length]; });

  const incomeList = [...incomeCats.entries()]
    .map(([name, values], i) => ({ key: 'i:' + name, name, values, sum: sum(values), ...trend(values) }))
    .sort((a, b) => b.sum - a.sum)
    .map((u, i) => ({ ...u, color: INCOME_COLORS[i % INCOME_COLORS.length] }));

  return {
    months, list, income, total, tx, incomeList,
    origNames: Object.fromEntries(Object.entries(origNames).map(([k, v]) => [k, [...v]])),
    incomeTrend: trend(income),
    totalTrend: trend(total),
    categories: [...catStats.values()].sort((a, b) => b.total - a.total),
  };
}

// last = החודש המלא האחרון, avg = ממוצע החודשים המלאים, change = סטייה מהממוצע
export function trend(values) {
  const full = values.slice(0, -1);
  if (!full.length) return { last: values[0] || 0, avg: values[0] || 0, change: null };
  const last = full[full.length - 1];
  const avg = sum(full) / full.length;
  return { last, avg, change: avg > 0 ? last / avg - 1 : null };
}

// ממוצע של החודשים המלאים (בלי החודש הנוכחי)
export const fullAvg = (values) => { const f = values.slice(0, -1); return f.length ? sum(f) / f.length : 0; };

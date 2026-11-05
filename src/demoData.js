import { uid } from './constants';
import { demoGroups } from './demoExpenses';

const iso = (d) => d.toISOString().slice(0, 10);
const addMonths = (d, m) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m, d.getUTCDate()));

function history({ startDate: start, opening, monthlyDeposit: monthly, feeDeposit, feeBalance, quarters, lumpSums = [] }) {
  let d = new Date(start + 'T00:00:00Z');
  let bal = opening;
  const snaps = [{ id: uid(), date: iso(d), balance: Math.round(bal) }];
  for (const q of quarters) {
    for (let m = 0; m < 3; m++) {
      const a = iso(addMonths(d, m)), b = iso(addMonths(d, m + 1));
      const lump = lumpSums.filter((l) => l.date > a && l.date <= b).reduce((t, l) => t + l.amount, 0);
      bal = bal * (1 + q / 3) - (bal * feeBalance) / 100 / 12 + (monthly + lump) * (1 - feeDeposit / 100);
    }
    d = addMonths(d, 3);
    snaps.push({ id: uid(), date: iso(d), balance: Math.round(bal) });
  }
  return snaps;
}

function fund({ opening, quarters, ...rest }) {
  const base = { ...rest, opening, quarters };
  return { id: uid(), ...rest, snapshots: history(base) };
}

export const demoFamily = {
  id: 'demo',
  name: 'משפחת לוי (הדגמה)',
  memberEmails: ['noa@example.com', 'itay@example.com'],
  owners: ['נועה', 'איתי'],
  expenseGroups: demoGroups,
  insurance: [
    { id: 'i1', type: 'ביטוח חיים', company: 'הראל', coverage: 'ריסק — 1,200,000 ₪', insured: 'נועה', premium: 62, period: 'month', from: '2023-02-01', to: '2043-02-01', policy: '0123456789', note: '' },
    { id: 'i2', type: 'ביטוח חיים', company: 'הראל', coverage: 'ריסק — 1,200,000 ₪', insured: 'איתי', premium: 71, period: 'month', from: '2023-02-01', to: '2043-02-01', policy: '0123456790', note: '' },
    { id: 'i3', type: 'ביטוח בריאות', company: 'מגדל', coverage: 'ניתוחים בחו״ל, השתלות ותרופות מחוץ לסל', insured: 'כולנו', premium: 148, period: 'month', from: '2024-06-01', to: '', policy: 'MG-55821047', note: '' },
    { id: 'i4', type: 'רכב', company: 'כלל', coverage: 'מקיף + חובה', insured: 'כולנו', premium: 3400, period: 'year', renews: true, from: '2026-01-15', to: '2027-01-14', policy: 'CL-7730192', note: 'לבדוק הצעות מחיר בדצמבר' },
    { id: 'i6', type: 'ביטוח לחיית מחמד', company: 'חיותא', coverage: 'וטרינר, ניתוחים ואשפוז', insured: 'לוקי', premium: 89, period: 'month', from: '2025-03-01', to: '', policy: 'HY-104422', note: '' },
    { id: 'i5', type: 'דירה', company: 'מנורה', coverage: 'מבנה ותכולה', insured: 'כולנו', premium: 95, period: 'month', from: '2025-11-20', to: '2026-11-19', policy: 'MN-3318840', note: '' },
  ],
  recurring: (() => {
    const d = (m, day) => { const x = new Date(); x.setMonth(x.getMonth() + m, day); return x.toISOString().slice(0, 10); };
    return [
      { id: 'ins-i4', source: 'insurance', name: 'רכב — כלל', amount: 3400, every: 12, date: '2027-01-14', note: 'חידוש ביטוח' },
      { id: 'r2', name: 'טסט לרכב', amount: 1250, every: 12, date: d(5, 3), note: '' },
      { id: 'r3', name: 'רופא שיניים', amount: 450, every: 6, date: d(0, 28), note: 'בדיקה וניקוי לשנינו' },
      { id: 'r4', name: 'ועד בית', amount: 360, every: 3, date: d(1, 1), note: '' },
      { id: 'r5', name: 'חיסון שנתי לכלב', amount: 380, every: 12, date: d(7, 10), note: '' },
      { id: 'r6', name: 'מנוי ספוטיפיי משפחתי', amount: 330, every: 12, date: d(9, 20), note: 'מנוי שנתי' },
    ];
  })(),
};

export const demoFunds = [
  fund({
    name: 'תיק מניות', kind: 'stocks', company: 'IBI', owner: 'איתי',
    investedSoFar: 54000, opening: 61200, startDate: '2024-11-01', monthlyDeposit: 800,
    feeDeposit: 0.07, feeBalance: 0.1, allocation: [{ track: 'sp500', pct: 60 }, { track: 'stocks', pct: 40 }],
    quarters: [0.028, 0.045, -0.052, 0.081, 0.034, 0.021, 0.049, 0.03],
  }),
  fund({
    name: 'גמל להשקעה', kind: 'gemel', shared: true, company: 'מגדל', owner: 'נועה',
    investedSoFar: 62000, opening: 68400, startDate: '2024-11-01', monthlyDeposit: 1000,
    feeDeposit: 0, feeBalance: 0.6, allocation: [{ track: 'sp500', pct: 100 }],
    quarters: [0.024, 0.041, -0.031, 0.062, 0.035, 0.018, 0.044, 0.027],
  }),
  fund({
    name: 'קרן השתלמות', kind: 'hishtalmut', company: 'הראל', owner: 'איתי',
    investedSoFar: 118000, opening: 131500, startDate: '2024-11-01', monthlyDeposit: 1580,
    feeDeposit: 0, feeBalance: 0.7, allocation: [{ track: 'stocks', pct: 70 }, { track: 'solid', pct: 30 }],
    quarters: [0.019, 0.028, -0.012, 0.041, 0.022, 0.015, 0.031, 0.02],
  }),
  fund({
    name: 'חיסכון לדירה', kind: 'gemel', shared: true, lumpSums: [{ id: 'l1', date: `${new Date().getFullYear()}-03-15`, amount: 20000 }], company: 'כלל', owner: 'איתי',
    investedSoFar: 40000, opening: 41900, startDate: '2024-11-01', monthlyDeposit: 2000,
    feeDeposit: 1, feeBalance: 0.45, allocation: [{ track: 'sp500', pct: 50 }, { track: 'solid', pct: 50 }],
    quarters: [0.011, 0.02, -0.008, 0.029, 0.017, 0.012, 0.021, 0.014],
  }),
  fund({
    name: 'פנסיה', kind: 'pension', company: 'הפניקס', owner: 'נועה',
    investedSoFar: 25000, opening: 27100, startDate: '2024-11-01', monthlyDeposit: 500,
    feeDeposit: 0, feeBalance: 0.55, allocation: [{ track: 'stocks', pct: 100 }],
    quarters: [0.03, 0.035, -0.045, 0.07, 0.028, 0.022, 0.05, 0.031],
  }),
];

export const demoPlans = [{
  id: 'plan-austria', name: 'טיסה לאוסטריה', budget: 18000, from: '2026-07-10', to: '2026-07-20',
  subs: ['טיסות', 'לינה', 'אוכל', 'אטרקציות', 'תחבורה', 'שונות'],
  items: [
    { txId: 'd-a1', date: '2026-03-02', amount: 3480, business: 'אל על', category: 'טיסות', sub: 'טיסות' },
    { txId: 'd-a2', date: '2026-04-18', amount: 2650, business: 'Booking.com — Innsbruck', category: 'חופשה', sub: 'לינה' },
    { txId: 'd-a3', date: '2026-05-06', amount: 1890, business: 'Airbnb — Hallstatt', category: 'חופשה', sub: 'לינה' },
    { txId: 'd-a4', date: '2026-07-11', amount: 410, business: 'Figlmüller Wien', category: 'מסעדות', sub: 'אוכל' },
    { txId: 'd-a5', date: '2026-07-12', amount: 236, business: 'Billa', category: 'סופר', sub: 'אוכל' },
    { txId: 'd-a6', date: '2026-07-14', amount: 520, business: 'Gasthof Post', category: 'מסעדות', sub: 'אוכל' },
    { txId: 'd-a7', date: '2026-07-13', amount: 690, business: 'Swarovski Kristallwelten', category: 'בילויים', sub: 'אטרקציות' },
    { txId: 'd-a8', date: '2026-07-15', amount: 840, business: 'Dachstein Krippenstein', category: 'בילויים', sub: 'אטרקציות' },
    { txId: 'd-a9', date: '2026-07-11', amount: 1320, business: 'Sixt', category: 'תחבורה', sub: 'תחבורה' },
    { txId: 'd-a10', date: '2026-07-16', amount: 180, business: 'ÖBB', category: 'תחבורה', sub: 'תחבורה' },
  ],
}];

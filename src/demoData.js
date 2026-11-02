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
  recurring: (() => {
    const d = (m, day) => { const x = new Date(); x.setMonth(x.getMonth() + m, day); return x.toISOString().slice(0, 10); };
    return [
      { id: 'r1', name: 'ביטוח רכב', amount: 3400, every: 12, date: d(2, 15), note: 'מקיף + חובה' },
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

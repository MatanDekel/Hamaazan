import { uid } from './constants';
import { demoGroups } from './demoExpenses';

const iso = (d) => d.toISOString().slice(0, 10);
const addMonths = (d, m) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m, d.getUTCDate()));

function history({ startDate: start, opening, monthlyDeposit: monthly, feeDeposit, feeBalance, quarters }) {
  let d = new Date(start + 'T00:00:00Z');
  let bal = opening;
  const snaps = [{ id: uid(), date: iso(d), balance: Math.round(bal) }];
  for (const q of quarters) {
    for (let m = 0; m < 3; m++) {
      bal = bal * (1 + q / 3) - (bal * feeBalance) / 100 / 12 + monthly * (1 - feeDeposit / 100);
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
};

export const demoFunds = [
  fund({
    name: 'גמל להשקעה', kind: 'gemel', company: 'מגדל', owner: 'נועה',
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
    name: 'חיסכון לדירה', kind: 'gemel', company: 'כלל', owner: 'איתי',
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

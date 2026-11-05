import { todayISO } from './constants';

const DAY = 86400000;
export const toDate = (s) => new Date(s + 'T00:00:00');

// מספר ההפקדות החודשיות בין שני תאריכים (הפקדה אחת בכל מעבר חודש)
export function monthsBetween(a, b) {
  const d0 = toDate(a), d1 = toDate(b);
  return Math.max(0, (d1.getFullYear() - d0.getFullYear()) * 12 + d1.getMonth() - d0.getMonth());
}

const num = (v) => (v === '' || v == null || isNaN(+v) ? 0 : +v);

/*
  חישוב תשואת המסלול לכל תקופה בין שני עדכוני יתרה:
  - הפקדות בתקופה: מה שהוזן ידנית, אחרת מספר חודשים × הפקדה חודשית
  - דמי ניהול מהפקדה יורדים מכל הפקדה לפני שהיא נכנסת לקופה
  - דמי ניהול מצבירה: שיעור שנתי על היתרה הממוצעת, יחסית לאורך התקופה
  - רווח המסלול = יתרה חדשה − יתרה קודמת − הפקדות נטו + דמי ניהול מצבירה
  - תשואה = רווח המסלול ÷ (יתרה קודמת + חצי מההפקדות נטו)   (Modified Dietz)
  כך התשואה משקפת את המסלול עצמו, בלי ההפקדות ובלי דמי הניהול.
*/
export function analyzeFund(f) {
  const snaps = [...(f.snapshots || [])].sort((a, b) => a.date.localeCompare(b.date));
  // אם העדכון הראשון מאוחר מתאריך הפתיחה, תאריך הפתיחה הוא נקודת ההתחלה:
  // היתרה בו = הסכום שהופקד עד אז (למשל 0 בקופה חדשה). כך כבר מהעדכון הראשון יש תשואה.
  if (snaps.length && f.startDate && snaps[0].date > f.startDate) {
    snaps.unshift({ id: 'opening', date: f.startDate, balance: num(f.openingBalance ?? f.investedSoFar), deposits: null, implicit: true });
  }
  const fd = num(f.feeDeposit) / 100;
  const fb = num(f.feeBalance) / 100;
  const monthly = num(f.monthlyDeposit);
  const invested = num(f.investedSoFar);
  const start = f.startDate || todayISO();

  const rows = [];
  let cum = 1, fees = 0;
  const lumps = f.lumpSums || [];
  const lumpBetween = (a, b) => lumps.filter((l) => l.date > a && l.date <= b).reduce((t, l) => t + num(l.amount), 0);
  let principal = snaps.length
    ? invested + monthsBetween(start, snaps[0].date) * monthly + lumpBetween(start, snaps[0].date)
    : invested + monthsBetween(start, todayISO()) * monthly + lumpBetween(start, todayISO());

  snaps.forEach((s, i) => {
    const bal = num(s.balance);
    if (i === 0) {
      rows.push({ ...s, balance: bal, opening: true, principal });
      return;
    }
    const p = rows[i - 1];
    const days = (toDate(s.date) - toDate(p.date)) / DAY;
    const yf = days / 365;
    const manual = s.deposits !== '' && s.deposits != null;
    const gross = manual ? num(s.deposits) : monthsBetween(p.date, s.date) * monthly + lumpBetween(p.date, s.date);
    const depFee = gross * fd;
    const net = gross - depFee;
    const balFee = ((p.balance + bal) / 2) * fb * yf;
    const gain = bal - p.balance - net + balFee;
    const base = p.balance + net / 2;
    const r = base > 0 ? gain / base : 0;
    const netBase = p.balance + gross / 2;
    const netR = netBase > 0 ? (bal - p.balance - gross) / netBase : 0;
    const ann = yf >= 0.25 ? Math.pow(1 + r, 1 / yf) - 1 : null;
    cum *= 1 + r;
    fees += depFee + balFee;
    principal += gross;
    rows.push({ ...s, balance: bal, days, deposits: gross, manual, depFee, balFee, gain, r, netR, ann, principal });
  });

  const last = rows[rows.length - 1];
  const spanYears = rows.length > 1 ? (toDate(last.date) - toDate(rows[0].date)) / DAY / 365 : 0;
  const cumR = rows.length > 1 ? cum - 1 : null;
  return {
    rows,
    balance: last ? last.balance : null,
    principal,
    profit: last ? last.balance - principal : null,
    cumR,
    cumAnn: cumR != null && spanYears >= 0.5 ? Math.pow(cum, 1 / spanYears) - 1 : null,
    fees,
    asOf: last?.date ?? null,
  };
}

const ilsFmt = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
export const ils = (n) => (n == null || isNaN(n) ? '—' : ilsFmt.format(n));
// \u200E שומר על הסימן בצד שמאל בתוך טקסט עברי
export const pct = (x, d = 1) => (x == null || isNaN(x) ? '—' : '\u200E' + (x > 0 ? '+' : '') + (x * 100).toFixed(d) + '%');
// תמיד dd/mm/yyyy, בלי תלות בשפת המכשיר
export const dateFmt = (s) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '—');
export const tone = (x) => (x == null ? '' : x > 0 ? 'up' : x < 0 ? 'down' : '');

// הפקדות מתוכננות לשנה קלנדרית: הפקדה חודשית × 12 + הפקדות חד-פעמיות באותה שנה
export function yearDeposits(f, year) {
  const lumps = (f.lumpSums || []).filter((l) => l.date.startsWith(String(year))).reduce((t, l) => t + num(l.amount), 0);
  return { monthly: num(f.monthlyDeposit) * 12, lumps, total: num(f.monthlyDeposit) * 12 + lumps };
}

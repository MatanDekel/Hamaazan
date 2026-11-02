import { monthsBack } from './expenseCalc';

// נתוני הוצאות לדוגמה למצב ההדגמה
const CATS = [
  ['סופר', 2400, 0.12, 9], ['מסעדות', 650, 0.35, 4], ['וולט ומשלוחים', 420, 0.4, 6], ['קפה', 180, 0.3, 10],
  ['דלק', 560, 0.15, 3], ['תחבורה ציבורית', 140, 0.2, 5], ['חניה', 90, 0.5, 3],
  ['שכר דירה', 5600, 0, 1, true], ['חשמל', 380, 0.25, 1, true], ['ארנונה', 620, 0, 1, true], ['ביטוחים', 410, 0, 2, true],
  ['בילויים', 380, 0.5, 3], ['מנויים', 160, 0.05, 4, true], ['מתנות', 250, 0.8, 2],
  ['ביגוד', 420, 0.7, 2], ['פארם', 210, 0.4, 3], ['בעלי חיים', 330, 0.3, 3],
];
const BIZ = {
  'סופר': ['שופרסל דיל', 'רמי לוי', 'ויקטורי'], 'מסעדות': ['מסעדת הדייג', 'בורגר סאלון', 'סושי בר'],
  'וולט ומשלוחים': ['Wolt', 'תן ביס'], 'קפה': ['ארומה', 'קפה קפה', 'רולדין'], 'דלק': ['פז', 'דלק', 'סונול'],
  'תחבורה ציבורית': ['רב-קו'], 'חניה': ['פנגו', 'סלופארק'], 'שכר דירה': ['העברה — שכר דירה'], 'חשמל': ['חברת החשמל'],
  'ארנונה': ['עיריית תל אביב'], 'ביטוחים': ['הראל ביטוח', 'ביטוח ישיר'], 'בילויים': ['סינמה סיטי', 'זאפה', 'בר'],
  'מנויים': ['Spotify', 'Netflix', 'iCloud', 'סלקום TV'], 'מתנות': ['סטימצקי', 'ToysRus'], 'ביגוד': ['זארה', 'H&M', 'קסטרו'],
  'פארם': ['סופר-פארם', 'Be'], 'בעלי חיים': ['פט שופ', 'וטרינר'],
};

function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

export function demoTransactions(months) {
  const r = rng(42);
  const all = monthsBack(24);
  const txs = [];
  all.forEach((m, mi) => {
    const season = 1 + 0.08 * Math.sin(mi / 1.9);
    CATS.forEach(([cat, base, vol, n, fixed]) => {
      const drift = cat === 'וולט ומשלוחים' ? 1 + mi * 0.025 : cat === 'מסעדות' ? 1 - mi * 0.01 : 1;
      const monthTotal = base * drift * (fixed ? 1 : season * (1 + (r() - 0.5) * 2 * vol));
      const parts = fixed ? n : Math.max(1, Math.round(n * (0.6 + r() * 0.8)));
      for (let p = 0; p < parts; p++) {
        const day = 1 + Math.floor(r() * 27);
        txs.push({
          id: `${m}-${cat}-${p}`, date: `${m}-${String(day).padStart(2, '0')}`, month: m,
          business: BIZ[cat][Math.floor(r() * BIZ[cat].length)], amount: Math.round(monthTotal / parts),
          income: false, category: cat, fixed: !!fixed, excluded: false,
        });
      }
    });
    txs.push({ id: `${m}-sal1`, date: `${m}-10`, month: m, business: 'משכורת', amount: 14800, income: true, category: 'משכורת', fixed: true, excluded: false });
    if (mi % 3 === 1) txs.push({ id: `${m}-free`, date: `${m}-18`, month: m, business: 'חשבונית — פרויקט', amount: 2500 + Math.round(r() * 3000), income: true, category: 'פרילנס', fixed: false, excluded: false });
    if (mi % 5 === 2) txs.push({ id: `${m}-ref`, date: `${m}-21`, month: m, business: 'החזר מס', amount: 600 + Math.round(r() * 900), income: true, category: 'החזרים', fixed: false, excluded: false });
    txs.push({ id: `${m}-sal2`, date: `${m}-10`, month: m, business: 'משכורת', amount: 12600, income: true, category: 'משכורת', fixed: true, excluded: false });
  });
  // החודש הנוכחי חלקי — עד היום
  const today = new Date().getDate();
  const cur = all[all.length - 1];
  return txs.filter((t) => months.includes(t.month) && !(t.month === cur && +t.date.slice(8) > today));
}

export const demoGroups = [
  { id: 'food', name: 'אוכל', categories: ['סופר', 'מסעדות', 'וולט ומשלוחים', 'קפה'] },
  { id: 'car', name: 'רכב ותחבורה', categories: ['דלק', 'תחבורה ציבורית', 'חניה'] },
  { id: 'home', name: 'בית', categories: ['שכר דירה', 'חשמל', 'ארנונה', 'ביטוחים'] },
  { id: 'fun', name: 'פנאי', categories: ['בילויים', 'מנויים', 'מתנות'] },
];

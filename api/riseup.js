// Vercel Serverless Function — מושך עסקאות מ-RiseUp בצד השרת.
// הטוקן נשמר רק במשתנה הסביבה RISEUP_PAT ב-Vercel ולא מגיע לדפדפן.
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);
const API = 'https://input.riseup.co.il/api/external/transactions';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    const pat = process.env.RISEUP_PAT;
    if (!pat) return res.status(500).json({ error: 'RISEUP_PAT לא מוגדר ב-Vercel.' });

    // רק משתמש מחובר עם מייל מורשה מקבל את הנתונים
    const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
    if (!idToken) return res.status(401).json({ error: 'צריך להתחבר כדי לראות הוצאות.' });
    let payload;
    try {
      ({ payload } = await jwtVerify(idToken, JWKS, {
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
      }));
    } catch {
      return res.status(401).json({ error: 'ההתחברות לא אומתה. התנתקו והתחברו מחדש.' });
    }
    const allowed = (process.env.ALLOWED_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const email = String(payload.email || '').toLowerCase();
    if (!payload.email_verified || !allowed.includes(email)) {
      return res.status(403).json({ error: 'לחשבון הזה אין גישה לנתוני ההוצאות. הוסיפו אותו ל-ALLOWED_EMAILS ב-Vercel.' });
    }

    const months = String(req.query.months || '').split(',').filter((m) => /^\d{4}-\d{2}$/.test(m)).slice(0, 24);
    if (!months.length) return res.status(400).json({ error: 'חסרים חודשים בבקשה.' });

    const fetchMonth = async (m) => {
      const r = await fetch(`${API}?cashflowMonth=${m}`, {
        headers: { Authorization: `Bearer ${pat}`, Accept: 'application/json' },
      });
      if (r.status === 401) throw new Error('RiseUp דחה את הטוקן — ייתכן שבוטל או שפג תוקפו. צרו טוקן חדש ועדכנו את RISEUP_PAT.');
      if (r.status === 403) throw new Error('לטוקן של RiseUp חסרה הרשאת budget:read.');
      if (!r.ok) throw new Error(`RiseUp החזיר שגיאה ${r.status}.`);
      const j = await r.json();
      return (j.transactions || []).map((t) => ({
        id: t.transactionId,
        date: String(t.transactionDate || '').slice(0, 10),
        month: t.cashflowDate || m,
        business: t.businessName || '',
        amount: Math.abs(Number(t.amount) || 0),
        income: !!t.isIncome,
        category: t.categoryLabel || t.expenseType || 'אחר',
        fixed: t.actualType === 'fixed',
        excluded: !!t.isExcluded,
      }));
    };

    const out = [];
    for (let i = 0; i < months.length; i += 4) {
      const batch = await Promise.all(months.slice(i, i + 4).map(fetchMonth));
      batch.forEach((b) => out.push(...b));
    }
    return res.status(200).json({ transactions: out, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}

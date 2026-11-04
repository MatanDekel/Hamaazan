// Vercel Serverless Function — מושך עסקאות מ-RiseUp בצד השרת.
// הטוקן נשמר רק במשתנה הסביבה RISEUP_PAT ב-Vercel ולא מגיע לדפדפן.
// חודשים סגורים (לפני החודש הקודם) נשמרים מוצפנים ב-Firestore, עם מפתח שקיים רק ב-Vercel (TX_ENC_KEY).
import { createRemoteJWKSet, jwtVerify } from 'jose';
import crypto from 'node:crypto';

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);
const API = 'https://input.riseup.co.il/api/external/transactions';

// ---- הצפנה: AES-256-GCM ----
function getKey() {
  const raw = process.env.TX_ENC_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  return key.length === 32 ? key : null;
}
function encrypt(key, obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return { iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
}
function decrypt(key, { iv, tag, data }) {
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8'));
}

// ---- Firestore דרך REST, עם הטוקן של המשתמש — כך כללי האבטחה של Firestore חלים גם כאן ----
const docUrl = (projectId, familyId, month) =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/families/${encodeURIComponent(familyId)}/cache/${month}`;

async function readCache(projectId, familyId, month, idToken, key) {
  const r = await fetch(docUrl(projectId, familyId, month), { headers: { Authorization: `Bearer ${idToken}` } });
  if (!r.ok) return null;
  const f = (await r.json()).fields || {};
  try {
    return decrypt(key, { iv: f.iv?.stringValue, tag: f.tag?.stringValue, data: f.data?.stringValue });
  } catch { return null; }
}
async function writeCache(projectId, familyId, month, idToken, key, txs) {
  const enc = encrypt(key, txs);
  await fetch(docUrl(projectId, familyId, month), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        iv: { stringValue: enc.iv }, tag: { stringValue: enc.tag }, data: { stringValue: enc.data },
        count: { integerValue: String(txs.length) }, savedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  }).catch(() => {});
}

// חודש "סגור" = לפני החודש הקודם. החודש הנוכחי והקודם תמיד נמשכים מ-RiseUp.
function isClosed(month) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prev = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return month < prev;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    const pat = process.env.RISEUP_PAT;
    if (!pat) return res.status(500).json({ error: 'RISEUP_PAT לא מוגדר ב-Vercel.' });

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
    const familyId = String(req.query.family || '');
    const force = req.query.force === '1';
    const key = getKey();
    const canCache = !!(key && familyId);

    const fetchMonth = async (m) => {
      if (canCache && isClosed(m) && !force) {
        const cached = await readCache(projectId, familyId, m, idToken, key);
        if (cached) return { m, txs: cached, from: 'cache' };
      }
      const r = await fetch(`${API}?cashflowMonth=${m}`, {
        headers: { Authorization: `Bearer ${pat}`, Accept: 'application/json' },
      });
      if (r.status === 401) throw new Error('RiseUp דחה את הטוקן — ייתכן שבוטל או שפג תוקפו. צרו טוקן חדש ועדכנו את RISEUP_PAT.');
      if (r.status === 403) throw new Error('לטוקן של RiseUp חסרה הרשאת budget:read.');
      if (!r.ok) throw new Error(`RiseUp החזיר שגיאה ${r.status}.`);
      const j = await r.json();
      const txs = (j.transactions || []).map((t) => ({
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
      if (canCache && isClosed(m)) await writeCache(projectId, familyId, m, idToken, key, txs);
      return { m, txs, from: 'riseup' };
    };

    const out = [];
    const sources = {};
    for (let i = 0; i < months.length; i += 4) {
      const batch = await Promise.all(months.slice(i, i + 4).map(fetchMonth));
      batch.forEach((b) => { out.push(...b.txs); sources[b.m] = b.from; });
    }
    return res.status(200).json({ transactions: out, sources, cache: canCache, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}

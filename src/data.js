import { useEffect, useState } from 'react';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, where, getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import { demoFamily, demoFunds } from './demoData';
import { uid } from './constants';

// מוצא את המשפחה של המשתמש לפי המייל, ואם אין — פותח משפחה חדשה
export async function loadOrCreateFamily(user) {
  const email = user.email.toLowerCase();
  const snap = await getDocs(query(collection(db, 'families'), where('memberEmails', 'array-contains', email)));
  if (!snap.empty) {
    const fams = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    fams.sort((a, b) => b.memberEmails.length - a.memberEmails.length);
    return fams[0].id;
  }
  const first = (user.displayName || '').split(' ')[0];
  const ref = await addDoc(collection(db, 'families'), {
    name: 'המשפחה שלי',
    memberEmails: [email],
    owners: first ? [first] : ['עדן', 'מתן'],
    createdBy: email,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function useLiveData(familyId) {
  const [family, setFamily] = useState(null);
  const [funds, setFunds] = useState(null);
  const [manual, setManual] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const onErr = (e) => setError(e.message);
    const u1 = onSnapshot(doc(db, 'families', familyId), (s) => setFamily({ id: s.id, ...s.data() }), onErr);
    const u2 = onSnapshot(
      collection(db, 'families', familyId, 'funds'),
      (s) => setFunds(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onErr,
    );
    const u3 = onSnapshot(
      collection(db, 'families', familyId, 'expenses'),
      (s) => setManual(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onErr,
    );
    return () => { u1(); u2(); u3(); };
  }, [familyId]);

  const fundRef = (id) => doc(db, 'families', familyId, 'funds', id);
  const api = {
    addFund: (data) => addDoc(collection(db, 'families', familyId, 'funds'), { ...data, createdAt: serverTimestamp() }),
    updateFund: (id, patch) => updateDoc(fundRef(id), patch),
    deleteFund: (id) => deleteDoc(fundRef(id)),
    addExpense: (d) => addDoc(collection(db, 'families', familyId, 'expenses'), { ...d, createdAt: serverTimestamp() }),
    updateExpense: (id, d) => updateDoc(doc(db, 'families', familyId, 'expenses', id), d),
    deleteExpense: (id) => deleteDoc(doc(db, 'families', familyId, 'expenses', id)),
    updateFamily: (patch) => updateDoc(doc(db, 'families', familyId), patch),
  };
  return { family, funds, manual, api, error };
}

export function useDemoData() {
  const [family, setFamily] = useState(demoFamily);
  const [funds, setFunds] = useState(demoFunds);
  const [manual, setManual] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1, 12);
    const m = d.toISOString().slice(0, 7);
    return [
      { id: 'dm1', date: `${m}-12`, amount: 120, business: 'שוק הכרמל — מזומן', category: 'סופר', income: false },
      { id: 'dm2', date: `${m}-20`, amount: 300, business: 'מתנה לחתונה — מזומן', category: 'מתנות', income: false },
    ];
  });
  const api = {
    addFund: async (d) => setFunds((fs) => [...fs, { ...d, id: uid() }]),
    updateFund: async (id, p) => setFunds((fs) => fs.map((f) => (f.id === id ? { ...f, ...p } : f))),
    deleteFund: async (id) => setFunds((fs) => fs.filter((f) => f.id !== id)),
    addExpense: async (d) => setManual((xs) => [...xs, { ...d, id: uid() }]),
    updateExpense: async (id, d) => setManual((xs) => xs.map((x) => (x.id === id ? { ...x, ...d } : x))),
    deleteExpense: async (id) => setManual((xs) => xs.filter((x) => x.id !== id)),
    updateFamily: async (p) => setFamily((f) => ({ ...f, ...p })),
  };
  return { family, funds, manual, api, error: '' };
}

// ---- RiseUp ----
// מטמון לפי חודש, כדי ששינוי טווח לא ימשוך שוב חודשים שכבר נטענו
const monthCache = new Map();
export async function loadRiseup(months, force = false) {
  const { auth } = await import('./firebase');
  const current = months[months.length - 1];
  const missing = months.filter((m) => force || m === current || !monthCache.has(m));
  if (missing.length) {
    const token = await auth.currentUser.getIdToken();
    const r = await fetch(`/api/riseup?months=${missing.join(',')}`, { headers: { Authorization: `Bearer ${token}` } });
    let j;
    try { j = await r.json(); } catch { throw new Error('השרת לא החזיר תשובה תקינה. בהרצה מקומית צריך להשתמש ב-vercel dev.'); }
    if (!r.ok) throw new Error(j.error || `שגיאה ${r.status}`);
    missing.forEach((m) => monthCache.set(m, []));
    j.transactions.forEach((t) => { if (monthCache.has(t.month)) monthCache.get(t.month).push(t); });
  }
  return months.flatMap((m) => monthCache.get(m) || []);
}

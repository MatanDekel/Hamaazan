import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, firebaseReady } from './firebase';
import { loadOrCreateFamily, useLiveData, useDemoData, loadRiseup } from './data';
import { demoTransactions } from './demoExpenses';
import Expenses from './Expenses';
import Dashboards from './Dashboards';
import { useExpenseData } from './expenseData';
import { buildModel } from './expenseCalc';
import Login from './Login';
import Investments from './Investments';
import FundDetail from './FundDetail';
import FundForm from './FundForm';
import Family from './Family';

export default function App() {
  const [user, setUser] = useState(undefined);
  const [familyId, setFamilyId] = useState(null);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!firebaseReady) { setUser(null); return; }
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setFamilyId(null);
      if (u) {
        try { setFamilyId(await loadOrCreateFamily(u)); }
        catch (e) { setError('לא הצלחנו לטעון את המשפחה: ' + e.message); }
      }
    });
  }, []);

  const google = async () => {
    setBusy(true); setError('');
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) { if (e.code !== 'auth/popup-closed-by-user') setError('הכניסה עם Google נכשלה: ' + e.message); }
    setBusy(false);
  };

  if (demo) return <DemoShell onLogout={() => setDemo(false)} />;
  if (user === undefined) return <Loading />;
  if (!user) return <Login onGoogle={google} onDemo={() => setDemo(true)} error={error} busy={busy} firebaseReady={firebaseReady} />;
  if (!familyId) return error ? <Login onGoogle={google} onDemo={() => setDemo(true)} error={error} firebaseReady /> : <Loading />;
  return <LiveShell familyId={familyId} user={user} onLogout={() => signOut(auth)} />;
}

function Loading() {
  return <main className="loading"><span className="wordmark small">המאזן</span></main>;
}

function LiveShell({ familyId, user, onLogout }) {
  const data = useLiveData(familyId);
  if (data.error) return <main className="loading"><p className="err">{data.error}</p></main>;
  if (!data.family || !data.funds) return <Loading />;
  return <Shell {...data} user={user} onLogout={onLogout} />;
}

function DemoShell({ onLogout }) {
  const data = useDemoData();
  return <Shell {...data} demo user={{ displayName: 'אורח', email: 'noa@example.com' }} onLogout={onLogout} />;
}

function Shell({ family, funds, api, user, demo, onLogout }) {
  const [tab, setTab] = useState('invest');
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const open = funds.find((f) => f.id === openId);
  const exp = useExpenseData(demo ? demoLoader : loadRiseup, tab === 'expenses' || tab === 'dash');
  const groups = family.expenseGroups;
  const model = useMemo(() => (exp.txs ? buildModel(exp.txs, groups || [], exp.months) : null), [exp.txs, groups, exp.months]);

  const go = (t) => { setTab(t); setOpenId(null); };

  return (
    <div className="app">
      {demo && <div className="demo-banner">אתר הדגמה עם נתונים לדוגמה — שינויים לא נשמרים</div>}
      <header className="top">
        <span className="wordmark small">המאזן</span>
        <nav className="tabs">
          <button className={tab === 'invest' ? 'on' : ''} onClick={() => go('invest')}>חסכונות</button>
          <button className={tab === 'expenses' ? 'on' : ''} onClick={() => go('expenses')}>הוצאות</button>
          <button className={tab === 'dash' ? 'on' : ''} onClick={() => go('dash')}>דשבורדים</button>
          <button className={tab === 'family' ? 'on' : ''} onClick={() => go('family')}>משפחה</button>
        </nav>
        <div className="me">
          <span className="fam-name">{family.name}</span>
          <button className="link" onClick={onLogout}>{demo ? 'יציאה מההדגמה' : 'התנתקות'}</button>
        </div>
      </header>

      <main className="content">
        {tab === 'invest' && (open
          ? <FundDetail fund={open} family={family} api={api} onBack={() => setOpenId(null)} />
          : <Investments funds={funds} family={family} onOpen={setOpenId} onAdd={() => setAdding(true)} />)}
        {tab === 'expenses' && <Expenses exp={exp} model={model} groups={groups || []} onSaveGroups={(g) => api.updateFamily({ expenseGroups: g })} />}
        {tab === 'dash' && <Dashboards exp={exp} model={model} />}
        {tab === 'family' && <Family family={family} api={api} myEmail={user.email?.toLowerCase()} demo={demo} />}
      </main>

      {adding && <FundForm owners={family.owners || []} onClose={() => setAdding(false)} onSave={api.addFund} />}
    </div>
  );
}

const demoLoader = async (months) => demoTransactions(months);

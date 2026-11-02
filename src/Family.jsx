import { useState } from 'react';

export default function Family({ family, api, myEmail, demo }) {
  const [email, setEmail] = useState('');
  const [owner, setOwner] = useState('');
  const [msg, setMsg] = useState('');
  const emails = family.memberEmails || [];
  const owners = family.owners || [];

  const addEmail = async (e) => {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return setMsg('כתובת המייל לא תקינה.');
    if (emails.includes(v)) return setMsg('החשבון הזה כבר במשפחה.');
    await api.updateFamily({ memberEmails: [...emails, v] });
    setEmail('');
    setMsg(`נוסף. כש-${v} ייכנס עם Google, הוא יראה את אותם נתונים.`);
  };
  const addOwner = async (e) => {
    e.preventDefault();
    const v = owner.trim();
    if (!v || owners.includes(v)) return;
    await api.updateFamily({ owners: [...owners, v] });
    setOwner('');
  };

  return (
    <section className="family">
      <div className="panel">
        <h2>שם המשפחה</h2>
        <input defaultValue={family.name} onBlur={(e) => e.target.value.trim() && api.updateFamily({ name: e.target.value.trim() })} />
      </div>

      <div className="panel">
        <h2>חשבונות Google במשפחה</h2>
        <p className="muted">כל מי שברשימה רואה ועורך את אותן קופות והוצאות.</p>
        <ul className="chips">
          {emails.map((m) => (
            <li key={m}>
              {m}{m === myEmail && ' (את/ה)'}
              {m !== myEmail && (
                <button className="icon-btn" aria-label={`הסרת ${m}`}
                  onClick={() => confirm(`להסיר את ${m} מהמשפחה?`) && api.updateFamily({ memberEmails: emails.filter((x) => x !== m) })}>✕</button>
              )}
            </li>
          ))}
        </ul>
        <form className="row" onSubmit={addEmail}>
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setMsg(''); }} placeholder="name@gmail.com" />
          <button className="btn primary">הוספה למשפחה</button>
        </form>
        {msg && <p className="hint">{msg}</p>}
        {demo && <p className="hint">במצב הדגמה השינויים לא נשמרים.</p>}
      </div>

      <div className="panel">
        <h2>אצל מי הקופות</h2>
        <p className="muted">השמות שמופיעים בבחירת "אצל מי" ובסינון.</p>
        <ul className="chips">
          {owners.map((o) => (
            <li key={o}>{o}
              {owners.length > 1 && (
                <button className="icon-btn" aria-label={`הסרת ${o}`} onClick={() => api.updateFamily({ owners: owners.filter((x) => x !== o) })}>✕</button>
              )}
            </li>
          ))}
        </ul>
        <form className="row" onSubmit={addOwner}>
          <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="שם" />
          <button className="btn ghost">הוספה</button>
        </form>
      </div>
    </section>
  );
}

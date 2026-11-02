export const COMPANIES = ['הראל', 'מגדל', 'מנורה', 'כלל', 'הפניקס'];
export const BROKERS = ['IBI', 'מיטב', 'אקסלנס', 'Interactive Brokers', 'לאומי', 'הפועלים', 'דיסקונט', 'מזרחי טפחות', 'הבינלאומי', 'אחר'];
export const companiesFor = (kind) => (kind === 'stocks' ? BROKERS : COMPANIES);

export const KINDS = {
  gemel: 'קופת גמל',
  pension: 'פנסיה',
  hishtalmut: 'קרן השתלמות',
  stocks: 'תיק מניות',
};
export const kindOf = (f) => KINDS[f.kind] || KINDS.gemel;

export const TRACKS = {
  stocks: { label: 'מניות', color: 'var(--t-stocks)' },
  sp500: { label: 'S&P 500', color: 'var(--t-sp)' },
  solid: { label: 'סולידי', color: 'var(--t-solid)' },
};

export const DEMO_CODE = '123';

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

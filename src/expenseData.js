import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { monthsBack } from './expenseCalc';

// טעינת העסקאות משותפת ללשונית ההוצאות וללשונית הדשבורדים
export function useExpenseData(loadTransactions, enabled) {
  const [range, setRange] = useState(12);
  const [txs, setTxs] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const loadedFor = useRef('');
  const months = useMemo(() => monthsBack(range), [range]);

  const load = useCallback(async (force) => {
    setLoading(true); setError('');
    try {
      setTxs(await loadTransactions(months, force));
      loadedFor.current = months.join();
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [months, loadTransactions]);

  useEffect(() => {
    if (enabled && loadedFor.current !== months.join()) load(false);
  }, [enabled, months, load]);

  return { range, setRange, months, txs, error, loading, reload: () => load(true) };
}

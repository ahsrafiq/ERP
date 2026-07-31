import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

type Selection<T> = {
  /** Current selected value (e.g., id) */
  selected: T | null;
  /** Setter to update the selection */
  setSelected: (value: T | null) => void;
  /** Field name in the fetched data that corresponds to the selection id */
  idField?: keyof any;
};

/**
 * Generic hook to load data when the active company changes, reset state, and restore previous selections if they still exist.
 *
 * @param loadFn   Async function that fetches data for a given companyId. It should return an object `{ success: boolean, data: any[] }`.
 * @param selections Optional array of selection objects that will be cleared before loading and restored after.
 * @returns        The loaded data array, loading flag, and a setter for data (if component wants to modify it).
 */
export function useCompanyDataLoader<T>(
  loadFn: (companyId: string) => Promise<{ success: boolean; data: T[] }>,
  selections?: Selection<any>[]
) {
  const { currentCompany } = useApp();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = (companyId: string) => {
    return loadFn(companyId)
      .then((res) => {
        if (res.success) {
          setData(res.data);
          // Restore selections if they still exist in the new data set
          prevSelections?.forEach(({ selection, prevValue }) => {
            if (prevValue != null) {
              const exists = res.data.some((item: any) => {
                const field = selection.idField || 'id';
                return item[field] === prevValue;
              });
              if (exists) selection.setSelected(prevValue);
            }
          });
        }
      })
      .finally(() => setLoading(false));
  };

  // Preserve previous selection values
  const prevSelections = selections?.map((s) => ({
    selection: s,
    prevValue: s.selected,
  }));

  // Reset and load on company change
  useEffect(() => {
    if (!currentCompany) return;
    setLoading(true);
    setData([]);
    selections?.forEach((s) => s.setSelected(null));
    loadData(currentCompany.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany]);

  // Expose refetch for manual refresh
  const refetch = () => {
    if (!currentCompany) return;
    setLoading(true);
    loadData(currentCompany.id);
  };

  return { data, setData, loading, setLoading, refetch };
}

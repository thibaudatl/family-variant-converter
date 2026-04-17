import { useEffect, useState } from 'react';
import type { FamilyType } from '../types';

interface UseFamiliesResult {
  families: FamilyType[];
  loading: boolean;
  error: string | null;
}

export function useFamilies(): UseFamiliesResult {
  const [families, setFamilies] = useState<FamilyType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const all: FamilyType[] = [];
        let page = 1;
        while (true) {
          const result = await globalThis.PIM.api.family_v1.list({ page, limit: 100 });
          const items: FamilyType[] = result.items ?? [];
          all.push(...items);
          if (items.length < 100) break;
          page += 1;
          if (page > 50) break; // safety
        }
        setFamilies(all);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { families, loading, error };
}

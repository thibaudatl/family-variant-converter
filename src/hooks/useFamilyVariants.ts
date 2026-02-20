import { useEffect, useState } from 'react';

type FamilyVariantType = Awaited<ReturnType<typeof globalThis.PIM.api.family_variant_v1.get>>;

interface UseFamilyVariantsResult {
  variants: FamilyVariantType[];
  loading: boolean;
  error: string | null;
}

export function useFamilyVariants(familyCode: string): UseFamilyVariantsResult {
  const [variants, setVariants] = useState<FamilyVariantType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!familyCode) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await globalThis.PIM.api.family_variant_v1.list({ familyCode });
        setVariants(result.items ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [familyCode]);

  return { variants, loading, error };
}

import { useEffect, useState } from 'react';

type AttributeType = Awaited<ReturnType<typeof globalThis.PIM.api.attribute_v1.get>>;
type AttributeOptionType = Awaited<ReturnType<typeof globalThis.PIM.api.attribute_option_v1.get>>;

interface UseAttributeDetailsResult {
  attributes: Record<string, AttributeType>;
  options: Record<string, AttributeOptionType[]>;
  loading: boolean;
  error: string | null;
}

export function useAttributeDetails(axisCodes: string[]): UseAttributeDetailsResult {
  const [attributes, setAttributes] = useState<Record<string, AttributeType>>({});
  const [options, setOptions] = useState<Record<string, AttributeOptionType[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = axisCodes.join(',');

  useEffect(() => {
    if (axisCodes.length === 0) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const attrResults = await Promise.all(
          axisCodes.map((code) => globalThis.PIM.api.attribute_v1.get({ code }))
        );

        const attrMap: Record<string, AttributeType> = {};
        for (const attr of attrResults) {
          attrMap[attr.code] = attr;
        }
        setAttributes(attrMap);

        // Fetch options for select attributes
        const optMap: Record<string, AttributeOptionType[]> = {};
        const selectAttrs = attrResults.filter(
          (a) =>
            a.type === 'pim_catalog_simpleselect' || a.type === 'pim_catalog_multiselect'
        );

        await Promise.all(
          selectAttrs.map(async (attr) => {
            const result = await globalThis.PIM.api.attribute_option_v1.list({
              attribute_code: attr.code,
              limit: 100,
            });
            optMap[attr.code] = result.items ?? [];
          })
        );
        setOptions(optMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { attributes, options, loading, error };
}

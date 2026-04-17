import { useEffect, useState } from 'react';
import type { ProductType } from '../utils/validation';
import { validateSameFamily, validateSimpleProducts } from '../utils/validation';

interface UseSelectedProductsResult {
  products: ProductType[];
  familyCode: string;
  loading: boolean;
  contextError: string | null;
  validationErrors: string[];
}

export function useSelectedProducts(): UseSelectedProductsResult {
  const [products, setProducts] = useState<ProductType[]>([]);
  const [familyCode, setFamilyCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const context = globalThis.PIM.context;
        if (!('productGrid' in context) || !context.productGrid) {
          setContextError('No product grid context found. Please select products in the product list first.');
          setLoading(false);
          return;
        }
        const { productUuids } = context.productGrid;
        if (!productUuids || productUuids.length === 0) {
          setContextError('No products selected. Please select at least one product in the product list.');
          setLoading(false);
          return;
        }

        const fetched = await Promise.all(
          productUuids.map((uuid) => globalThis.PIM.api.product_uuid_v1.get({ uuid }))
        );

        const errors: string[] = [];

        const sameFamilyError = validateSameFamily(fetched);
        if (sameFamilyError) errors.push(sameFamilyError);

        const parentErrors = validateSimpleProducts(fetched);
        errors.push(...parentErrors);

        setProducts(fetched);
        setFamilyCode(fetched[0]?.family ?? '');
        setValidationErrors(errors);
      } catch (err) {
        setContextError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { products, familyCode, loading, contextError, validationErrors };
}

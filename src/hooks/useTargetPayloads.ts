import { useEffect, useState } from 'react';
import type {
  AxisValuesByUuid,
  FamilyVariantType,
  ModelTree,
} from '../types';
import { computeTargetPayload, type TargetPayload } from '../utils/attributeShift';

interface UseTargetPayloadsResult {
  payloadsByRootCode: Record<string, TargetPayload>;
  sourceFamilyAttrs: Set<string>;
  targetFamilyAttrs: Set<string>;
  removedByFamilyChange: string[]; // source-only attrs (family-level diff)
  loading: boolean;
  error: string | null;
}

async function fetchFamilyAttrs(code: string): Promise<Set<string>> {
  if (!code) return new Set();
  const family = await globalThis.PIM.api.family_v1.get({ code });
  const attrs = family?.attributes;
  if (Array.isArray(attrs)) return new Set(attrs);
  console.warn('[fvc] family_v1.get returned unexpected shape', { code, family });
  return new Set();
}

export function useTargetPayloads(
  trees: ModelTree[],
  targetVariant: FamilyVariantType,
  axisValues: AxisValuesByUuid,
  targetFamilyCode: string,
  sourceFamilyCode: string
): UseTargetPayloadsResult {
  const [sourceFamilyAttrs, setSourceFamilyAttrs] = useState<Set<string>>(new Set());
  const [targetFamilyAttrs, setTargetFamilyAttrs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [src, tgt] = await Promise.all([
          fetchFamilyAttrs(sourceFamilyCode),
          fetchFamilyAttrs(targetFamilyCode),
        ]);
        setSourceFamilyAttrs(src);
        setTargetFamilyAttrs(tgt);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sourceFamilyCode, targetFamilyCode]);

  const payloadsByRootCode: Record<string, TargetPayload> = {};
  const removedByFamilyChange: string[] = [];
  if (!loading && targetFamilyAttrs.size > 0) {
    for (const src of sourceFamilyAttrs) {
      if (!targetFamilyAttrs.has(src)) removedByFamilyChange.push(src);
    }
    for (const tree of trees) {
      payloadsByRootCode[tree.root.code] = computeTargetPayload(
        tree,
        targetVariant,
        targetFamilyAttrs,
        axisValues,
        sourceFamilyAttrs
      );
    }
  }

  return {
    payloadsByRootCode,
    sourceFamilyAttrs,
    targetFamilyAttrs,
    removedByFamilyChange,
    loading,
    error,
  };
}

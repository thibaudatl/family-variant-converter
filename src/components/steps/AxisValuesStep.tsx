import React, { useEffect } from 'react';
import { useAttributeDetails } from '../../hooks/useAttributeDetails';
import type {
  AxisValuesByUuid,
  FamilyVariantType,
  ModelTree,
  ProductType,
} from '../../types';
import {
  getAllTargetAxes,
  getTargetAxesAtLevel,
} from '../../utils/attributeShift';
import {
  effectiveAxisValueForVariant,
  validateTreesAgainstTarget,
} from '../../utils/validation';
import { ValidationError } from '../ValidationError';

interface AxisValuesStepProps {
  trees: ModelTree[];
  targetVariant: FamilyVariantType;
  axisValues: AxisValuesByUuid;
  onAxisValuesChange: (updated: AxisValuesByUuid) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function AxisValuesStep({
  trees,
  targetVariant,
  axisValues,
  onAxisValuesChange,
  onContinue,
  onBack,
}: AxisValuesStepProps) {
  const allAxes = getAllTargetAxes(targetVariant);
  const level1Axes = getTargetAxesAtLevel(targetVariant, 1);
  const level2Axes = getTargetAxesAtLevel(targetVariant, 2);
  const { attributes, options, loading, error } = useAttributeDetails(allAxes);

  // Pre-fill from each variant's effective value (walking up the source tree)
  useEffect(() => {
    const prefilled: AxisValuesByUuid = { ...axisValues };
    for (const tree of trees) {
      for (const variant of tree.variants) {
        prefilled[variant.uuid] = prefilled[variant.uuid] ?? {};
        for (const axis of allAxes) {
          if (prefilled[variant.uuid][axis] === undefined) {
            prefilled[variant.uuid][axis] = effectiveAxisValueForVariant(
              variant,
              tree,
              axis
            );
          }
        }
      }
    }
    onAxisValuesChange(prefilled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trees, targetVariant.code]);

  function handleCellChange(uuid: string, axis: string, value: string) {
    const updated: AxisValuesByUuid = {
      ...axisValues,
      [uuid]: { ...(axisValues[uuid] ?? {}), [axis]: value },
    };
    onAxisValuesChange(updated);
  }

  function handleGroupChange(uuids: string[], axis: string, value: string) {
    const updated: AxisValuesByUuid = { ...axisValues };
    for (const uuid of uuids) {
      updated[uuid] = { ...(axisValues[uuid] ?? {}), [axis]: value };
    }
    onAxisValuesChange(updated);
  }

  function renderAxisCell(
    axis: string,
    value: string,
    onChange: (v: string) => void,
    extraClass: string = ''
  ) {
    const attrType = attributes[axis]?.type ?? '';
    const isSelect =
      attrType === 'pim_catalog_simpleselect' ||
      attrType === 'pim_catalog_multiselect';
    if (isSelect && options[axis]) {
      return (
        <select
          className={`w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white ${extraClass}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {options[axis].map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.labels?.en_US ?? opt.code}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        type="text"
        className={`w-full border border-gray-300 rounded px-2 py-1 text-sm ${extraClass}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={axis}
      />
    );
  }

  const validationErrors = validateTreesAgainstTarget(trees, targetVariant, axisValues);
  const canContinue = validationErrors.length === 0;

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Review the axis attribute values for each variant product. Values must be present and
        yield a unique combination within each product model.
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgb(148, 82, 186)', borderTopColor: 'transparent' }} />
          Loading attribute details...
        </div>
      )}
      {error && (
        <div className="text-sm text-red-600 mb-3">
          Failed to load attribute details: {error}
        </div>
      )}

      <div className="space-y-6">
        {trees.map((tree) => {
          const seen = new Set<string>();
          const uniqueVariants = tree.variants.filter((v) => {
            if (seen.has(v.uuid)) return false;
            seen.add(v.uuid);
            return true;
          });
          const duplicateCount = tree.variants.length - uniqueVariants.length;

          const hasSubModels = tree.subModels.length > 0;
          const groups: { label: string; parentCode: string | null; variants: ProductType[] }[] = [];
          if (hasSubModels) {
            for (const sub of tree.subModels) {
              groups.push({
                label: sub.code,
                parentCode: sub.code,
                variants: uniqueVariants.filter((v) => v.parent === sub.code),
              });
            }
            const orphans = uniqueVariants.filter(
              (v) => !tree.subModels.some((s) => s.code === v.parent)
            );
            if (orphans.length > 0) {
              groups.push({ label: '(no sub-model)', parentCode: null, variants: orphans });
            }
          } else {
            groups.push({ label: tree.root.code, parentCode: tree.root.code, variants: uniqueVariants });
          }

          return (
            <div key={tree.root.code} className="border border-gray-200 rounded-md overflow-hidden">
              <div className="bg-blue-50 px-3 py-2 border-b border-blue-100 flex items-center gap-2">
                <span className="text-blue-600">📦</span>
                <span className="font-mono text-sm font-medium text-blue-800">
                  {tree.root.code}
                </span>
                <span className="text-xs text-blue-500">
                  ({uniqueVariants.length} variant{uniqueVariants.length !== 1 ? 's' : ''}
                  {hasSubModels ? `, ${tree.subModels.length} sub-model${tree.subModels.length !== 1 ? 's' : ''}` : ''})
                </span>
                {duplicateCount > 0 && (
                  <span className="ml-auto text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                    {duplicateCount} duplicate variant{duplicateCount !== 1 ? 's' : ''} skipped
                  </span>
                )}
              </div>

              {groups.map((group) => (
                <div key={group.label} className="border-t border-gray-100 first:border-t-0">
                  {hasSubModels && (
                    <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 flex items-center gap-2">
                      <span className="text-gray-500 text-xs">↳</span>
                      <span className="font-mono text-xs font-medium text-gray-700">
                        {group.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({group.variants.length} variant{group.variants.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-3 py-2 font-medium text-gray-700 border-b border-gray-200">
                            Variant
                          </th>
                          {level1Axes.map((axis) => (
                            <th
                              key={axis}
                              className="text-left px-3 py-2 font-medium text-blue-700 border-b border-gray-200"
                            >
                              {attributes[axis]?.labels?.en_US ?? axis}
                              <span className="ml-1 text-xs text-blue-400">(L1)</span>
                            </th>
                          ))}
                          {level2Axes.map((axis) => (
                            <th
                              key={axis}
                              className="text-left px-3 py-2 font-medium text-purple-700 border-b border-gray-200"
                            >
                              {attributes[axis]?.labels?.en_US ?? axis}
                              <span className="ml-1 text-xs text-purple-400">(L2)</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.variants.length === 0 && (
                          <tr>
                            <td
                              colSpan={1 + allAxes.length}
                              className="px-3 py-3 text-center text-xs text-gray-400 italic"
                            >
                              No variants under this sub-model
                            </td>
                          </tr>
                        )}
                        {(() => {
                          // In a 1-level target FV, L1 axes ARE the per-variant axes and must be
                          // unique per variant — no group sharing. In a 2-level target FV, L1 axes
                          // are the sub-model axes and should be shared (rowspan) across variants
                          // that will end up in the same sub-model.
                          const oneLevelTarget = level2Axes.length === 0;
                          const l1Groups = new Map<string, typeof group.variants>();
                          for (const v of group.variants) {
                            const key = oneLevelTarget
                              ? v.uuid
                              : level1Axes
                                  .map((a) => axisValues[v.uuid]?.[a] ?? '')
                                  .join('\u0000');
                            if (!l1Groups.has(key)) l1Groups.set(key, []);
                            l1Groups.get(key)!.push(v);
                          }
                          const rows: React.ReactNode[] = [];
                          for (const [, groupVariants] of l1Groups) {
                            const uuids = groupVariants.map((v) => v.uuid);
                            const first = groupVariants[0];
                            const firstValues = axisValues[first.uuid] ?? {};
                            groupVariants.forEach((variant, idx) => {
                              const rowValues = axisValues[variant.uuid] ?? {};
                              const isFirst = idx === 0;
                              const isLastInGroup = idx === groupVariants.length - 1;
                              const rowBorder = isLastInGroup
                                ? 'border-b-2 border-gray-200'
                                : 'border-b border-gray-100';
                              rows.push(
                                <tr key={variant.uuid} className="hover:bg-gray-50">
                                  <td className={`px-3 py-2 ${rowBorder} font-mono text-xs text-gray-700`}>
                                    {variant.identifier ?? variant.uuid.slice(0, 8)}
                                  </td>
                                  {isFirst &&
                                    level1Axes.map((axis) => (
                                      <td
                                        key={axis}
                                        rowSpan={groupVariants.length}
                                        className="px-3 py-2 border-b-2 border-gray-200 bg-blue-50/40 align-top"
                                      >
                                        {renderAxisCell(
                                          axis,
                                          firstValues[axis] ?? '',
                                          (v) => handleGroupChange(uuids, axis, v)
                                        )}
                                        {groupVariants.length > 1 && (
                                          <div className="mt-1 text-[10px] text-blue-500">
                                            applies to {groupVariants.length} variants
                                          </div>
                                        )}
                                      </td>
                                    ))}
                                  {level2Axes.map((axis) => (
                                    <td key={axis} className={`px-3 py-2 ${rowBorder}`}>
                                      {renderAxisCell(
                                        axis,
                                        rowValues[axis] ?? '',
                                        (v) => handleCellChange(variant.uuid, axis, v)
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              );
                            });
                          }
                          return rows;
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <ValidationError errors={validationErrors} />

      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onContinue}
          disabled={!canContinue}
          className="flex-1 bg-white border disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed font-medium py-2 px-4 rounded-md transition-colors hover:bg-[rgba(148,82,186,0.06)]"
          style={!canContinue ? undefined : { borderColor: 'rgb(148, 82, 186)', color: 'rgb(148, 82, 186)' }}
        >
          Preview →
        </button>
      </div>
    </div>
  );
}

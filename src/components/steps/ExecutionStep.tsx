import { useEffect, useRef, useState } from 'react';
import type {
  AxisValuesByUuid,
  FamilyVariantType,
  ModelTree,
} from '../../types';
import { useTargetPayloads } from '../../hooks/useTargetPayloads';
import { migrateTree, type LogEntry } from '../../utils/executor';

interface ExecutionStepProps {
  trees: ModelTree[];
  targetVariant: FamilyVariantType;
  axisValues: AxisValuesByUuid;
  familyCode: string;
  sourceFamilyCode: string;
  targetFamilyCode: string;
}

export function ExecutionStep({
  trees,
  targetVariant,
  axisValues,
  familyCode,
  sourceFamilyCode,
  targetFamilyCode,
}: ExecutionStepProps) {
  const { payloadsByRootCode, loading: prepLoading, error: prepError } = useTargetPayloads(
    trees,
    targetVariant,
    axisValues,
    targetFamilyCode,
    sourceFamilyCode
  );

  const [log, setLog] = useState<LogEntry[]>([]);
  const [done, setDone] = useState(false);
  const [successRoots, setSuccessRoots] = useState<string[]>([]);
  const [failedRoots, setFailedRoots] = useState<string[]>([]);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const executed = useRef(false);
  const retryCounts = useRef<Record<string, number>>({});

  function logFn(entry: LogEntry) {
    setLog((prev) => {
      const existing = prev.findIndex((e) => e.id === entry.id);
      if (existing === -1) return [...prev, entry];
      const next = [...prev];
      next[existing] = entry;
      return next;
    });
  }

  async function runTree(treeCode: string, prefix: string, startLabel: string) {
    const tree = trees.find((t) => t.root.code === treeCode);
    const payload = payloadsByRootCode[treeCode];
    if (!tree || !payload) return false;

    const startId = `${prefix}_start`;
    logFn({ id: startId, message: startLabel, status: 'running' });
    const ok = await migrateTree({
      tree,
      payload,
      targetFamilyVariant: targetVariant.code,
      familyCode,
      log: logFn,
      prefix,
    });
    logFn({
      id: startId,
      message: startLabel,
      status: ok ? 'success' : 'error',
      detail: ok ? 'Migration succeeded.' : 'Migration failed — see details above.',
    });
    return ok;
  }

  async function handleRetry(treeCode: string) {
    if (retrying.has(treeCode)) return;
    setRetrying((prev) => new Set(prev).add(treeCode));
    const attempt = (retryCounts.current[treeCode] ?? 0) + 1;
    retryCounts.current[treeCode] = attempt;
    const prefix = `${treeCode}_retry${attempt}`;
    const ok = await runTree(treeCode, prefix, `↻ Retry #${attempt} for ${treeCode}`);
    setRetrying((prev) => {
      const next = new Set(prev);
      next.delete(treeCode);
      return next;
    });
    if (ok) {
      setSuccessRoots((prev) => (prev.includes(treeCode) ? prev : [...prev, treeCode]));
      setFailedRoots((prev) => prev.filter((c) => c !== treeCode));
    }
  }

  useEffect(() => {
    if (executed.current) return;
    if (prepLoading || prepError) return;
    if (Object.keys(payloadsByRootCode).length === 0) return;
    executed.current = true;

    (async () => {
      const successes: string[] = [];
      const failures: string[] = [];
      for (const tree of trees) {
        if (!payloadsByRootCode[tree.root.code]) {
          failures.push(tree.root.code);
          continue;
        }
        const ok = await runTree(
          tree.root.code,
          tree.root.code,
          `▸ Migrating ${tree.root.code}`
        );
        if (ok) successes.push(tree.root.code);
        else failures.push(tree.root.code);
      }
      setSuccessRoots(successes);
      setFailedRoots(failures);
      setDone(true);
    })();
  }, [prepLoading, prepError, payloadsByRootCode]);

  if (prepLoading) {
    return (
      <div className="flex items-center gap-3 py-8 justify-center">
        <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'rgb(148, 82, 186)', borderTopColor: 'transparent' }} />
        <span className="text-gray-600">Preparing target payloads...</span>
      </div>
    );
  }

  if (prepError) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-4">
        <p className="text-sm font-medium text-red-800">Could not prepare target payloads</p>
        <p className="text-sm text-red-700 mt-1">{prepError}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Migration in progress. Do not close this tab.
      </p>

      <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-[32rem] overflow-y-auto">
        {log.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3 px-4 py-2 text-sm">
            <span className="mt-0.5 flex-shrink-0">
              {entry.status === 'pending' && <span className="text-gray-400">○</span>}
              {entry.status === 'running' && (
                <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
              {entry.status === 'success' && <span className="text-green-600">✓</span>}
              {entry.status === 'error' && <span className="text-red-600">✗</span>}
              {entry.status === 'warn' && <span className="text-yellow-600">⚠</span>}
            </span>
            <div className="flex-1 min-w-0">
              <p
                className={
                  entry.status === 'error'
                    ? 'text-red-700'
                    : entry.status === 'warn'
                    ? 'text-yellow-700'
                    : 'text-gray-800'
                }
              >
                {entry.message}
              </p>
              {entry.detail && (
                <p
                  className={`text-xs mt-0.5 ${
                    entry.status === 'error'
                      ? 'text-red-500'
                      : entry.status === 'warn'
                      ? 'text-yellow-600'
                      : 'text-gray-500'
                  }`}
                >
                  {entry.detail}
                </p>
              )}
            </div>
          </div>
        ))}
        {log.length === 0 && (
          <div className="px-4 py-4 text-sm text-gray-500 flex items-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Starting...
          </div>
        )}
      </div>

      {done && (
        <div className="mt-4 space-y-3">
          <div
            className={`rounded-md p-3 text-sm ${
              failedRoots.length === 0
                ? 'bg-green-50 border border-green-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}
          >
            <p
              className={`font-medium ${
                failedRoots.length === 0 ? 'text-green-800' : 'text-yellow-800'
              }`}
            >
              {failedRoots.length === 0
                ? 'Migration completed successfully for all models.'
                : `Completed: ${successRoots.length} succeeded, ${failedRoots.length} failed.`}
            </p>
            {failedRoots.length > 0 && (
              <p className="text-xs mt-1 text-gray-600">
                Failed: <span className="font-mono">{failedRoots.join(', ')}</span>. Check the
                rollback log above, fix the issue in the PIM if needed, then click Retry.
              </p>
            )}
          </div>

          {failedRoots.length > 0 && (
            <div className="space-y-1">
              {failedRoots.map((code) => {
                const isRetrying = retrying.has(code);
                return (
                  <button
                    key={code}
                    onClick={() => handleRetry(code)}
                    disabled={isRetrying}
                    className="w-full bg-white border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium py-2 px-4 rounded-md transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    {isRetrying ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        Retrying {code}...
                      </>
                    ) : (
                      <>↻ Retry {code}</>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {successRoots.length > 0 && (
            <div className="space-y-1">
              {successRoots.map((code) => (
                <button
                  key={code}
                  onClick={() =>
                    globalThis.PIM.navigate.internal(`#/enrich/product-model/${code}/enrich`)
                  }
                  className="w-full bg-white border font-medium py-2 px-4 rounded-md transition-colors text-sm hover:bg-[rgba(148,82,186,0.06)]"
                  style={{ borderColor: 'rgb(148, 82, 186)', color: 'rgb(148, 82, 186)' }}
                >
                  Open {code} →
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

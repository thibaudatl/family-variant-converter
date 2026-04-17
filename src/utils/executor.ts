import type { ModelTree, ProductModelType, ProductType } from '../types';
import type { TargetPayload } from './attributeShift';

export type LogStatus = 'pending' | 'running' | 'success' | 'error' | 'warn';

export interface LogEntry {
  id: string;
  message: string;
  status: LogStatus;
  detail?: string;
}

export type LogFn = (entry: LogEntry) => void;

function describeErr(err: unknown): string {
  if (err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>;
    const resp = anyErr.response as Record<string, unknown> | undefined;
    const status = resp?.status ?? anyErr.status;
    const body = resp?.data ?? anyErr.data;
    const msg = anyErr.message ?? String(err);
    const prefix = status ? `HTTP ${status}: ${msg}` : String(msg);
    if (body) {
      const bodyAny = body as Record<string, unknown>;
      const serverMsg = bodyAny.message;
      const errors = bodyAny.errors;
      // Akeneo 422 shape: { code: 422, message: '...', errors: [{ property, message, ... }] }
      if (Array.isArray(errors) && errors.length > 0) {
        const details = errors
          .map((e: Record<string, unknown>) => {
            const prop = e.property ?? e.attribute ?? '';
            const m = e.message ?? JSON.stringify(e);
            return prop ? `${prop}: ${m}` : String(m);
          })
          .join(' · ');
        return `${prefix}${serverMsg ? ` — ${serverMsg}` : ''} [${details}]`;
      }
      if (serverMsg) return `${prefix} — ${serverMsg}`;
      return `${prefix} — ${JSON.stringify(body).slice(0, 500)}`;
    }
    return prefix;
  }
  return String(err);
}

async function deleteVariant(uuid: string): Promise<void> {
  await globalThis.PIM.api.product_uuid_v1.delete({ uuid });
}

async function deleteProductModel(code: string): Promise<void> {
  await globalThis.PIM.api.product_model_v1.delete({ code });
}

async function createProductModel(data: Record<string, unknown>): Promise<void> {
  await globalThis.PIM.api.product_model_v1.post({ data });
}

async function createVariant(data: Record<string, unknown>): Promise<void> {
  await globalThis.PIM.api.product_uuid_v1.create({ data });
}

function rootModelCreatePayload(
  targetFamilyVariant: string,
  targetFamily: string,
  payload: TargetPayload
): Record<string, unknown> {
  return {
    code: payload.root.code,
    family: targetFamily,
    family_variant: targetFamilyVariant,
    categories: payload.root.categories,
    values: payload.root.values,
    associations: payload.root.associations,
  };
}

function subModelCreatePayload(
  sub: TargetPayload['subModels'][number],
  rootCode: string,
  targetFamilyVariant: string
): Record<string, unknown> {
  return {
    code: sub.code,
    parent: rootCode,
    family_variant: targetFamilyVariant,
    values: sub.values,
  };
}

function variantCreatePayload(
  v: TargetPayload['variants'][number],
  family: string
): Record<string, unknown> {
  return {
    uuid: v.uuid,
    identifier: v.identifier,
    family,
    parent: v.parentCode,
    categories: v.categories,
    enabled: v.enabled,
    values: v.values,
    associations: v.associations,
  };
}

// ---------- Rollback payloads (from original snapshot) ----------

function originalRootPayload(root: ProductModelType): Record<string, unknown> {
  return {
    code: root.code,
    family: root.family,
    family_variant: root.family_variant,
    categories: root.categories ?? [],
    values: root.values ?? {},
    associations: root.associations,
  };
}

function originalSubModelPayload(sub: ProductModelType): Record<string, unknown> {
  return {
    code: sub.code,
    parent: sub.parent,
    family_variant: sub.family_variant,
    values: sub.values ?? {},
    associations: sub.associations,
  };
}

function originalVariantPayload(v: ProductType, family: string): Record<string, unknown> {
  return {
    uuid: v.uuid,
    identifier: v.identifier ?? null,
    family: v.family ?? family,
    parent: v.parent,
    categories: v.categories ?? [],
    enabled: v.enabled ?? true,
    values: v.values ?? {},
    associations: v.associations,
  };
}

// ---------- Orchestration ----------

interface MigrateTreeArgs {
  tree: ModelTree;
  payload: TargetPayload;
  targetFamilyVariant: string;
  familyCode: string;
  log: LogFn;
  prefix: string;
}

/**
 * Migrate one tree. Returns true on success, false if a failure occurred
 * (rollback may or may not have succeeded — see log).
 */
export async function migrateTree(args: MigrateTreeArgs): Promise<boolean> {
  const { tree, payload, targetFamilyVariant, familyCode, log, prefix } = args;

  // 1. Delete bottom-up
  const deletedVariants: string[] = [];
  const deletedSubModels: string[] = [];
  let deletedRoot = false;

  for (const variant of tree.variants) {
    const id = `${prefix}_del_v_${variant.uuid}`;
    log({ id, message: `Deleting variant ${variant.identifier ?? variant.uuid}...`, status: 'running' });
    try {
      await deleteVariant(variant.uuid);
      deletedVariants.push(variant.uuid);
      log({ id, message: `Deleted variant ${variant.identifier ?? variant.uuid}`, status: 'success' });
    } catch (err) {
      log({
        id,
        message: `Failed to delete variant ${variant.identifier ?? variant.uuid}`,
        status: 'error',
        detail: describeErr(err),
      });
      await rollback({ tree, familyCode, deletedVariants, deletedSubModels, deletedRoot, log, prefix });
      return false;
    }
  }

  for (const sub of tree.subModels) {
    const id = `${prefix}_del_s_${sub.code}`;
    log({ id, message: `Deleting sub-model ${sub.code}...`, status: 'running' });
    try {
      await deleteProductModel(sub.code);
      deletedSubModels.push(sub.code);
      log({ id, message: `Deleted sub-model ${sub.code}`, status: 'success' });
    } catch (err) {
      log({
        id,
        message: `Failed to delete sub-model ${sub.code}`,
        status: 'error',
        detail: describeErr(err),
      });
      await rollback({ tree, familyCode, deletedVariants, deletedSubModels, deletedRoot, log, prefix });
      return false;
    }
  }

  const rootDelId = `${prefix}_del_r_${tree.root.code}`;
  log({ id: rootDelId, message: `Deleting root ${tree.root.code}...`, status: 'running' });
  try {
    await deleteProductModel(tree.root.code);
    deletedRoot = true;
    log({ id: rootDelId, message: `Deleted root ${tree.root.code}`, status: 'success' });
  } catch (err) {
    log({
      id: rootDelId,
      message: `Failed to delete root ${tree.root.code}`,
      status: 'error',
      detail: describeErr(err),
    });
    await rollback({ tree, familyCode, deletedVariants, deletedSubModels, deletedRoot, log, prefix });
    return false;
  }

  // 2. Recreate top-down (target family variant)
  const createdRootCode: string | null = null;
  const createdSubModelCodes: string[] = [];
  const createdVariantUuids: string[] = [];

  const rootCreateId = `${prefix}_cr_r_${payload.root.code}`;
  log({ id: rootCreateId, message: `Creating root ${payload.root.code} on ${targetFamilyVariant}...`, status: 'running' });
  try {
    await createProductModel(rootModelCreatePayload(targetFamilyVariant, familyCode, payload));
    log({ id: rootCreateId, message: `Created root ${payload.root.code}`, status: 'success' });
  } catch (err) {
    log({
      id: rootCreateId,
      message: `Failed to create root ${payload.root.code}`,
      status: 'error',
      detail: describeErr(err),
    });
    await rollback({
      tree,
      familyCode,
      deletedVariants,
      deletedSubModels,
      deletedRoot,
      createdRootCode,
      createdSubModelCodes,
      createdVariantUuids,
      log,
      prefix,
    });
    return false;
  }

  for (const sub of payload.subModels) {
    const id = `${prefix}_cr_s_${sub.code}`;
    log({ id, message: `Creating sub-model ${sub.code}...`, status: 'running' });
    try {
      await createProductModel(subModelCreatePayload(sub, payload.root.code, targetFamilyVariant));
      createdSubModelCodes.push(sub.code);
      log({ id, message: `Created sub-model ${sub.code}`, status: 'success' });
    } catch (err) {
      log({
        id,
        message: `Failed to create sub-model ${sub.code}`,
        status: 'error',
        detail: describeErr(err),
      });
      await rollback({
        tree,
        familyCode,
        deletedVariants,
        deletedSubModels,
        deletedRoot,
        createdRootCode: payload.root.code,
        createdSubModelCodes,
        createdVariantUuids,
        log,
        prefix,
      });
      return false;
    }
  }

  for (const v of payload.variants) {
    const id = `${prefix}_cr_v_${v.uuid}`;
    const label = v.identifier ?? v.uuid.slice(0, 8);
    log({ id, message: `Creating variant ${label}...`, status: 'running' });
    try {
      await createVariant(variantCreatePayload(v, familyCode));
      createdVariantUuids.push(v.uuid);
      log({ id, message: `Created variant ${label}`, status: 'success' });
    } catch (err) {
      log({
        id,
        message: `Failed to create variant ${label}`,
        status: 'error',
        detail: describeErr(err),
      });
      await rollback({
        tree,
        familyCode,
        deletedVariants,
        deletedSubModels,
        deletedRoot,
        createdRootCode: payload.root.code,
        createdSubModelCodes,
        createdVariantUuids,
        log,
        prefix,
      });
      return false;
    }
  }

  return true;
}

// ---------- Rollback ----------

interface RollbackArgs {
  tree: ModelTree;
  familyCode: string;
  deletedVariants: string[];
  deletedSubModels: string[];
  deletedRoot: boolean;
  createdRootCode?: string | null;
  createdSubModelCodes?: string[];
  createdVariantUuids?: string[];
  log: LogFn;
  prefix: string;
}

async function rollback(args: RollbackArgs): Promise<void> {
  const {
    tree,
    familyCode,
    deletedVariants,
    deletedSubModels,
    deletedRoot,
    createdRootCode,
    createdSubModelCodes = [],
    createdVariantUuids = [],
    log,
    prefix,
  } = args;

  log({ id: `${prefix}_rb_start`, message: `Rolling back ${tree.root.code}...`, status: 'warn' });

  // First, tear down any partial new structure (variants → sub-models → root).
  for (const uuid of createdVariantUuids) {
    const id = `${prefix}_rb_del_v_${uuid}`;
    log({ id, message: `Rollback: deleting partial new variant ${uuid}...`, status: 'running' });
    try {
      await deleteVariant(uuid);
      log({ id, message: `Rollback: deleted partial new variant ${uuid}`, status: 'success' });
    } catch (err) {
      log({
        id,
        message: `Rollback: failed to delete partial new variant ${uuid}`,
        status: 'error',
        detail: describeErr(err),
      });
    }
  }

  for (const code of createdSubModelCodes) {
    const id = `${prefix}_rb_del_s_${code}`;
    log({ id, message: `Rollback: deleting partial new sub-model ${code}...`, status: 'running' });
    try {
      await deleteProductModel(code);
      log({ id, message: `Rollback: deleted partial new sub-model ${code}`, status: 'success' });
    } catch (err) {
      log({
        id,
        message: `Rollback: failed to delete partial new sub-model ${code}`,
        status: 'error',
        detail: describeErr(err),
      });
    }
  }

  if (createdRootCode) {
    const id = `${prefix}_rb_del_r_${createdRootCode}`;
    log({ id, message: `Rollback: deleting partial new root ${createdRootCode}...`, status: 'running' });
    try {
      await deleteProductModel(createdRootCode);
      log({ id, message: `Rollback: deleted partial new root ${createdRootCode}`, status: 'success' });
    } catch (err) {
      log({
        id,
        message: `Rollback: failed to delete partial new root ${createdRootCode}`,
        status: 'error',
        detail: describeErr(err),
      });
    }
  }

  // Then, restore original snapshot top-down: root → sub-models → variants.
  if (deletedRoot) {
    const id = `${prefix}_rb_cr_r_${tree.root.code}`;
    log({ id, message: `Rollback: restoring root ${tree.root.code}...`, status: 'running' });
    try {
      await createProductModel(originalRootPayload(tree.root));
      log({ id, message: `Rollback: restored root ${tree.root.code}`, status: 'success' });
    } catch (err) {
      log({
        id,
        message: `Rollback: FAILED to restore root ${tree.root.code}. Manual recovery needed.`,
        status: 'error',
        detail: describeErr(err),
      });
      return;
    }
  }

  for (const code of deletedSubModels) {
    const sub = tree.subModels.find((s) => s.code === code);
    if (!sub) continue;
    const id = `${prefix}_rb_cr_s_${code}`;
    log({ id, message: `Rollback: restoring sub-model ${code}...`, status: 'running' });
    try {
      await createProductModel(originalSubModelPayload(sub));
      log({ id, message: `Rollback: restored sub-model ${code}`, status: 'success' });
    } catch (err) {
      log({
        id,
        message: `Rollback: FAILED to restore sub-model ${code}. Manual recovery needed.`,
        status: 'error',
        detail: describeErr(err),
      });
    }
  }

  for (const uuid of deletedVariants) {
    const variant = tree.variants.find((v) => v.uuid === uuid);
    if (!variant) continue;
    const id = `${prefix}_rb_cr_v_${uuid}`;
    const label = variant.identifier ?? uuid.slice(0, 8);
    log({ id, message: `Rollback: restoring variant ${label}...`, status: 'running' });
    try {
      await createVariant(originalVariantPayload(variant, familyCode));
      log({ id, message: `Rollback: restored variant ${label}`, status: 'success' });
    } catch (err) {
      log({
        id,
        message: `Rollback: FAILED to restore variant ${label}. Manual recovery needed.`,
        status: 'error',
        detail: describeErr(err),
      });
    }
  }

  log({ id: `${prefix}_rb_end`, message: `Rollback complete for ${tree.root.code}`, status: 'warn' });
}

import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSettings, updateSettings, DEFAULT_SETTINGS } from '../db';
import type { AppSettings, ModelInstall } from '../lib/types';

export function useSettings(): AppSettings | undefined {
  // Read-only querier: dexie-react-hooks runs live queries in a readonly
  // transaction, so this must never write (ReadOnlyError). Defaults are
  // persisted once at startup by useEnsureSettings().
  // `undefined` means "still loading" — never "no settings".
  const s = useLiveQuery(() => db.settings.get('app'), [], undefined);
  if (!s) return undefined;
  return { ...DEFAULT_SETTINGS, ...s, key: 'app' as const };
}

/** Persist default settings on first run. Call once at app startup. */
export function useEnsureSettings() {
  useEffect(() => {
    void getSettings();
  }, []);
}

export function useModels(): ModelInstall[] | undefined {
  return useLiveQuery(() => db.models.toArray(), [], undefined);
}

export async function setModelStatus(
  modelId: string,
  modelType: 'transcription' | 'reflection',
  patch: Partial<ModelInstall>,
) {
  const existing = await db.models.get(modelId);
  await db.models.put({
    modelId,
    modelType,
    status: 'not-installed',
    ...existing,
    ...patch,
  } as ModelInstall);
}

export { updateSettings };

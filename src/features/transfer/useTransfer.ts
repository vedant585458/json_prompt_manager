/**
 * Export actions (TASK-026).
 *
 * The three exports share one pipeline: take a snapshot of stored records, ask
 * the domain to select and serialize them, hand the text to the browser, and
 * record what happened. Keeping it in one hook means the settings card, the
 * library's bulk bar, and the prompt workspace all export the same shapes with
 * the same filenames and the same messages.
 *
 * The state is read from `getState()` at the moment of the click — not from a
 * render-captured value — so an export always reflects the library as it is now.
 */

import { useCallback, useState } from 'react';

import { formatBytes } from '@/domain/health';
import { LARGE_IMPORT_BYTES } from '@/domain/transfer/import';
import {
  exportLibrary,
  exportPrompt,
  exportSelection,
  type ExportResult,
} from '@/domain/transfer/export';
import { useToast } from '@/components/ui';
import { downloadJson } from '@/features/transfer/download';
import { APP_VERSION } from '@/lib/appVersion';
import { describeDataError } from '@/store/dataStore';
import { useDataStoreApi } from '@/store/dataStoreContext';
import type { LibrarySnapshot } from '@/domain/transfer/bundle';

export type ExportKind = 'prompt' | 'selection' | 'backup';

export interface TransferActions {
  /** True while a file is being prepared, so a button can say so. */
  readonly busy: boolean;
  exportPromptFile: (promptId: string) => Promise<void>;
  exportSelectedPrompts: (promptIds: readonly string[]) => Promise<void>;
  exportFullBackup: () => Promise<void>;
}

/** The library as the domain sees it: records only, no store, no React. */
export function snapshotLibrary(store: {
  prompts: LibrarySnapshot['prompts'];
  folders: LibrarySnapshot['folders'];
  collections: LibrarySnapshot['collections'];
  schemas: LibrarySnapshot['schemas'];
  snippets: LibrarySnapshot['snippets'];
  templates: LibrarySnapshot['templates'];
  testCases: LibrarySnapshot['testCases'];
  revisions: LibrarySnapshot['revisions'];
}): LibrarySnapshot {
  return {
    prompts: store.prompts,
    folders: store.folders,
    collections: store.collections,
    schemas: store.schemas,
    snippets: store.snippets,
    templates: store.templates,
    testCases: store.testCases,
    revisions: store.revisions,
  };
}

/** One line describing the file, reused by the toast and the settings card. */
export function describeExportFile(result: ExportResult): string {
  const prompts = `${result.counts.prompts} ${result.counts.prompts === 1 ? 'prompt' : 'prompts'}`;
  return `${result.fileName} · ${prompts} · ${formatBytes(result.bytes)}`;
}

export function useTransfer(): TransferActions {
  const store = useDataStoreApi();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (kind: ExportKind, produce: (library: LibrarySnapshot) => ExportResult | null) => {
      setBusy(true);

      // One task tick so the button can render its busy label before a large
      // backup is serialized in the main thread.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });

      try {
        const state = store.getState();
        const library = snapshotLibrary(state);
        const result = produce(library);

        if (!result) {
          toast.error({
            title: 'Nothing to export',
            description: 'That prompt is no longer in this library.',
          });
          return;
        }

        downloadJson(result.fileName, result.json);

        const titles: Record<ExportKind, string> = {
          prompt: 'Prompt file downloaded',
          selection: 'Selection downloaded',
          backup: 'Backup downloaded',
        };

        toast.success({
          title: titles[kind],
          description:
            result.bytes > LARGE_IMPORT_BYTES
              ? `${describeExportFile(result)} — a large file, give the browser a moment.`
              : describeExportFile(result),
        });

        // Recording the export is secondary: a failure here leaves the file the
        // user already has, and the store surfaces the problem itself.
        void state.noteExport({
          scope: kind,
          count: result.counts.prompts,
          ...(kind === 'prompt' ? { label: result.bundle.prompts[0]?.title ?? 'a prompt' } : {}),
        });
      } catch (error) {
        toast.error({
          title: 'The export could not be prepared',
          description: describeDataError(error),
        });
      } finally {
        setBusy(false);
      }
    },
    [store, toast],
  );

  const exportedAt = () => new Date().toISOString();

  return {
    busy,
    exportPromptFile: (promptId) =>
      run('prompt', (library) =>
        exportPrompt(library, promptId, { appVersion: APP_VERSION, exportedAt: exportedAt() }),
      ),
    exportSelectedPrompts: (promptIds) =>
      run('selection', (library) =>
        exportSelection(library, promptIds, {
          appVersion: APP_VERSION,
          exportedAt: exportedAt(),
        }),
      ),
    exportFullBackup: () =>
      run('backup', (library) =>
        exportLibrary(library, { appVersion: APP_VERSION, exportedAt: exportedAt() }),
      ),
  };
}

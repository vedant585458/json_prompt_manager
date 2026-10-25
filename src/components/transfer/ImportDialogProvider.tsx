import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ImportDialog } from '@/components/transfer/ImportDialog';
import {
  ImportDialogContext,
  type ImportDialogApi,
} from '@/components/transfer/importDialogContext';
import { registerImportOpener } from '@/lib/commands/transferActions';

/**
 * Hosts the one import dialog (TASK-026).
 *
 * The dialog is mounted once, under the shell, so the settings page, the library,
 * and the command palette all open the same instance. A per-screen dialog would
 * mean three copies of the same staged flow, and three chances for one of them
 * to disagree about what was written.
 *
 * Mounting it also registers the palette's opener, which is why the "Import from
 * a file" command disappears when the shell is not rendered.
 */
export function ImportDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openDialog = useCallback(() => setOpen(true), []);

  useEffect(() => registerImportOpener(openDialog), [openDialog]);

  const api = useMemo<ImportDialogApi>(() => ({ open: openDialog }), [openDialog]);

  return (
    <ImportDialogContext.Provider value={api}>
      {children}
      <ImportDialog open={open} onOpenChange={setOpen} />
    </ImportDialogContext.Provider>
  );
}

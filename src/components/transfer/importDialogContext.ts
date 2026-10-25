import { createContext, useContext } from 'react';

/**
 * The import dialog's handle (TASK-026).
 *
 * The context lives in its own module so the provider file exports only a
 * component (React Fast Refresh requires that), and so a screen can open the
 * dialog without importing the dialog itself.
 */
export interface ImportDialogApi {
  open: () => void;
}

export const ImportDialogContext = createContext<ImportDialogApi | null>(null);

/** Opens the import dialog. Throws outside the provider, which is a bug. */
export function useImportDialog(): ImportDialogApi {
  const api = useContext(ImportDialogContext);
  if (!api) {
    throw new Error('useImportDialog must be used inside an ImportDialogProvider.');
  }
  return api;
}

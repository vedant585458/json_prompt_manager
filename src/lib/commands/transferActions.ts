/**
 * Bridges for the transfer commands (TASK-026).
 *
 * Same pattern as `promptActions.ts`: the command layer must not import the
 * dialog or the prompt workspace, so a command asks a registered handler to do
 * the work. A palette entry therefore cannot appear unless the surface that can
 * honour it is mounted.
 */

type ImportOpener = () => void;
type PromptExport = () => void;

let importOpener: ImportOpener | null = null;
let promptExport: PromptExport | null = null;

/** Registers the import dialog's opener. Returns its cleanup. */
export function registerImportOpener(handler: ImportOpener | null): () => void {
  importOpener = handler;

  return () => {
    if (importOpener === handler) importOpener = null;
  };
}

/** True when something can open the import dialog. */
export function hasImportOpener(): boolean {
  return importOpener !== null;
}

/** Opens the import dialog; false when nothing is mounted to open it. */
export function openImportDialog(): boolean {
  if (!importOpener) return false;
  importOpener();
  return true;
}

/** Registers the open prompt's export action. Returns its cleanup. */
export function registerPromptExport(handler: PromptExport | null): () => void {
  promptExport = handler;

  return () => {
    if (promptExport === handler) promptExport = null;
  };
}

/** True when a prompt screen has registered an export action. */
export function hasPromptExport(): boolean {
  return promptExport !== null;
}

/** Exports the prompt on screen; false when no prompt screen is mounted. */
export function exportOpenPrompt(): boolean {
  if (!promptExport) return false;
  promptExport();
  return true;
}

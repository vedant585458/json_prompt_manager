/**
 * Bridge for prompt-level commands (TASK-013).
 *
 * The command layer must not import the prompt workspace or the data store: a
 * command only knows how to ask. The workspace registers the action while it is
 * mounted (the same pattern as the library's search focus), so a palette command
 * can never act on a prompt that is not on screen.
 */

type FavoriteToggle = () => void;
type ValidationOpen = () => void;
type SnapshotOpen = () => void;

let favoriteToggle: FavoriteToggle | null = null;
let validationOpen: ValidationOpen | null = null;
let snapshotOpen: SnapshotOpen | null = null;

/** Registers the open workspace's favorite toggle. Returns its cleanup. */
export function registerPromptFavoriteToggle(handler: FavoriteToggle | null): () => void {
  favoriteToggle = handler;

  return () => {
    if (favoriteToggle === handler) favoriteToggle = null;
  };
}

/** True when a prompt workspace has registered a toggle. */
export function hasPromptFavoriteToggle(): boolean {
  return favoriteToggle !== null;
}

/** Runs the registered toggle; false when no workspace is mounted. */
export function togglePromptFavorite(): boolean {
  if (!favoriteToggle) return false;
  favoriteToggle();
  return true;
}

/** Registers the open workspace's "validate this prompt" action (TASK-016). */
export function registerPromptValidation(handler: ValidationOpen | null): () => void {
  validationOpen = handler;

  return () => {
    if (validationOpen === handler) validationOpen = null;
  };
}

/** True when a prompt workspace has registered a validation action. */
export function hasPromptValidation(): boolean {
  return validationOpen !== null;
}

/** Opens validation for the mounted prompt; false when none is mounted. */
export function openPromptValidation(): boolean {
  if (!validationOpen) return false;
  validationOpen();
  return true;
}

/** Registers the mounted screen's "save a snapshot" dialog opener (TASK-019). */
export function registerPromptSnapshot(handler: SnapshotOpen | null): () => void {
  snapshotOpen = handler;

  return () => {
    if (snapshotOpen === handler) snapshotOpen = null;
  };
}

/** True when a prompt screen has registered a snapshot opener. */
export function hasPromptSnapshot(): boolean {
  return snapshotOpen !== null;
}

/** Opens the snapshot dialog for the mounted prompt; false when none is. */
export function openPromptSnapshot(): boolean {
  if (!snapshotOpen) return false;
  snapshotOpen();
  return true;
}

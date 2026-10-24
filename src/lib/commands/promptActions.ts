/**
 * Bridge for prompt-level commands (TASK-013).
 *
 * The command layer must not import the prompt workspace or the data store: a
 * command only knows how to ask. The workspace registers the action while it is
 * mounted (the same pattern as the library's search focus), so a palette command
 * can never act on a prompt that is not on screen.
 */

type FavoriteToggle = () => void;

let favoriteToggle: FavoriteToggle | null = null;

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

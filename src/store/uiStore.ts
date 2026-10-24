/**
 * Ephemeral interface state (TASK-007).
 *
 * Which panels are open, which row is selected, and what the command palette is
 * doing. None of it is persisted — reloading the app should return to a clean
 * workspace — and none of it is derived from storage.
 */

import { create } from 'zustand';

export type RightPanel = 'none' | 'inspector' | 'activity';

export interface UiState {
  /** Library sidebar; collapses to a drawer on small screens (TASK-008). */
  readonly sidebarOpen: boolean;
  /** Right-hand panel in the editor workspace. */
  readonly rightPanel: RightPanel;
  readonly paletteOpen: boolean;
  /** Prompt currently open in the editor, or null for the library. */
  readonly selectedPromptId: string | null;
  /** Multi-selection for bulk actions (TASK-013). */
  readonly selectedPromptIds: readonly string[];

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setRightPanel: (panel: RightPanel) => void;
  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;
  selectPrompt: (id: string | null) => void;
  setSelection: (ids: readonly string[]) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
}

export type UiStore = ReturnType<typeof createUiStore>;

export interface InitialUiState {
  readonly sidebarOpen?: boolean;
  readonly rightPanel?: RightPanel;
  readonly paletteOpen?: boolean;
  readonly selectedPromptId?: string | null;
  readonly selectedPromptIds?: readonly string[];
}

/** Wide screens start with the sidebar visible; the shell adapts on resize. */
export function createUiStore(initial: InitialUiState = {}) {
  return create<UiState>()((set) => ({
    sidebarOpen: initial.sidebarOpen ?? true,
    rightPanel: initial.rightPanel ?? 'none',
    paletteOpen: initial.paletteOpen ?? false,
    selectedPromptId: initial.selectedPromptId ?? null,
    selectedPromptIds: [...(initial.selectedPromptIds ?? [])],

    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setRightPanel: (panel) => set({ rightPanel: panel }),
    setPaletteOpen: (open) => set({ paletteOpen: open }),
    togglePalette: () => set((state) => ({ paletteOpen: !state.paletteOpen })),
    selectPrompt: (id) => set({ selectedPromptId: id }),

    setSelection: (ids) => set({ selectedPromptIds: [...ids] }),
    toggleSelection: (id) =>
      set((state) => ({
        selectedPromptIds: state.selectedPromptIds.includes(id)
          ? state.selectedPromptIds.filter((candidate) => candidate !== id)
          : [...state.selectedPromptIds, id],
      })),
    clearSelection: () => set({ selectedPromptIds: [] }),
  }));
}

export const useUiStore = createUiStore();

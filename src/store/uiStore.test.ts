import { describe, expect, it } from 'vitest';

import { createUiStore } from '@/store/uiStore';

describe('uiStore', () => {
  it('starts with the sidebar open and nothing selected', () => {
    const store = createUiStore();
    const state = store.getState();

    expect(state.sidebarOpen).toBe(true);
    expect(state.rightPanel).toBe('none');
    expect(state.paletteOpen).toBe(false);
    expect(state.selectedPromptId).toBeNull();
    expect(state.selectedPromptIds).toEqual([]);
  });

  it('honours injected initial state', () => {
    const store = createUiStore({
      sidebarOpen: false,
      rightPanel: 'activity',
      paletteOpen: true,
      selectedPromptId: 'p1',
      selectedPromptIds: ['p1', 'p2'],
    });

    expect(store.getState()).toMatchObject({
      sidebarOpen: false,
      rightPanel: 'activity',
      paletteOpen: true,
      selectedPromptId: 'p1',
      selectedPromptIds: ['p1', 'p2'],
    });
  });

  it('toggles panels and the palette', () => {
    const store = createUiStore();

    store.getState().toggleSidebar();
    expect(store.getState().sidebarOpen).toBe(false);
    store.getState().setSidebarOpen(true);
    expect(store.getState().sidebarOpen).toBe(true);

    store.getState().setRightPanel('inspector');
    expect(store.getState().rightPanel).toBe('inspector');

    store.getState().togglePalette();
    expect(store.getState().paletteOpen).toBe(true);
    store.getState().setPaletteOpen(false);
    expect(store.getState().paletteOpen).toBe(false);
  });

  it('selects a prompt and manages a multi-selection', () => {
    const store = createUiStore();

    store.getState().selectPrompt('p1');
    expect(store.getState().selectedPromptId).toBe('p1');
    store.getState().selectPrompt(null);
    expect(store.getState().selectedPromptId).toBeNull();

    store.getState().toggleSelection('p1');
    store.getState().toggleSelection('p2');
    expect(store.getState().selectedPromptIds).toEqual(['p1', 'p2']);

    store.getState().toggleSelection('p1');
    expect(store.getState().selectedPromptIds).toEqual(['p2']);

    store.getState().setSelection(['p3', 'p4']);
    expect(store.getState().selectedPromptIds).toEqual(['p3', 'p4']);

    store.getState().clearSelection();
    expect(store.getState().selectedPromptIds).toEqual([]);
  });

  it('does not let a caller mutate the selection array by reference', () => {
    const store = createUiStore();
    const ids = ['p1'];

    store.getState().setSelection(ids);
    ids.push('p2');

    expect(store.getState().selectedPromptIds).toEqual(['p1']);
  });
});

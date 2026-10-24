import { useDataStore } from '@/store/dataStore';

export interface StorageModeLabel {
  readonly label: string;
  readonly detail: string;
  readonly tone: 'success' | 'warning';
}

/**
 * How this session persists writes (TASK-008).
 *
 * The shell states the storage mode instead of showing a save control that
 * cannot save: durable mode means prompts survive a reload, ephemeral mode
 * means they do not and says so.
 */
export function useStorageModeLabel(): StorageModeLabel {
  const mode = useDataStore((state) => state.mode);

  return mode === 'durable'
    ? {
        label: 'Local database',
        detail: 'Prompts are saved in this browser. Nothing is sent anywhere else.',
        tone: 'success',
      }
    : {
        label: 'Session only',
        detail:
          'Storage is unavailable, so edits last until you reload. The banner at the top explains why.',
        tone: 'warning',
      };
}

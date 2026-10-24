/**
 * Cross-tab write announcements (TASK-006).
 *
 * PromptForge does not merge edits between tabs. Instead, a write is announced
 * on `BroadcastChannel('promptforge')` so another tab with a dirty draft can
 * warn "changed in another tab" and offer reload/diff (TASK-015). Version
 * counters remain the enforcement; this is only the notification channel.
 *
 * The channel is injected so tests can run without real browser messaging and
 * environments without `BroadcastChannel` degrade to a no-op.
 */

export type WriteAnnouncement =
  | {
      readonly type: 'prompt-written';
      readonly promptId: string;
      readonly version: number;
      readonly at: string;
    }
  | { readonly type: 'prompt-deleted'; readonly promptId: string; readonly at: string }
  | { readonly type: 'settings-written'; readonly at: string };

/** The subset of `BroadcastChannel` this module needs. */
export interface BroadcastChannelLike {
  postMessage: (message: unknown) => void;
  close: () => void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export interface WriteBroadcasterOptions {
  readonly channelName?: string;
  /** Returns `null` when messaging is unavailable. */
  readonly createChannel?: (name: string) => BroadcastChannelLike | null;
  readonly now?: () => Date;
}

export interface WriteBroadcaster {
  readonly supported: boolean;
  readonly channelName: string;
  announce: (announcement: WriteAnnouncement) => void;
  /** Announces a prompt write at its new version. */
  announcePromptWrite: (prompt: { id: string; version: number }) => void;
  announcePromptDelete: (promptId: string) => void;
  subscribe: (listener: (announcement: WriteAnnouncement) => void) => () => void;
  close: () => void;
}

export const BROADCAST_CHANNEL_NAME = 'promptforge';

const ANNOUNCEMENT_TYPES: readonly WriteAnnouncement['type'][] = [
  'prompt-written',
  'prompt-deleted',
  'settings-written',
];

function defaultCreateChannel(name: string): BroadcastChannelLike | null {
  const Channel = (globalThis as { BroadcastChannel?: new (name: string) => BroadcastChannelLike })
    .BroadcastChannel;
  return typeof Channel === 'function' ? new Channel(name) : null;
}

/** Rejects anything that is not one of our announcements. */
export function isWriteAnnouncement(value: unknown): value is WriteAnnouncement {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.type !== 'string') return false;
  if (!ANNOUNCEMENT_TYPES.includes(candidate.type as WriteAnnouncement['type'])) return false;
  if (candidate.type === 'settings-written') return typeof candidate.at === 'string';

  return typeof candidate.promptId === 'string' && typeof candidate.at === 'string';
}

export function createWriteBroadcaster(options: WriteBroadcasterOptions = {}): WriteBroadcaster {
  const channelName = options.channelName ?? BROADCAST_CHANNEL_NAME;
  const createChannel = options.createChannel ?? defaultCreateChannel;
  const now = options.now ?? (() => new Date());
  const listeners = new Set<(announcement: WriteAnnouncement) => void>();

  let channel: BroadcastChannelLike | null = null;
  try {
    channel = createChannel(channelName);
  } catch {
    channel = null;
  }

  if (channel) {
    channel.onmessage = (event) => {
      if (!isWriteAnnouncement(event.data)) return;
      for (const listener of listeners) listener(event.data);
    };
  }

  const supported = channel !== null;

  const announce = (announcement: WriteAnnouncement): void => {
    channel?.postMessage(announcement);
  };

  return {
    supported,
    channelName,
    announce,
    announcePromptWrite: (prompt) =>
      announce({
        type: 'prompt-written',
        promptId: prompt.id,
        version: prompt.version,
        at: now().toISOString(),
      }),
    announcePromptDelete: (promptId) =>
      announce({ type: 'prompt-deleted', promptId, at: now().toISOString() }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => {
      listeners.clear();
      channel?.close();
      channel = null;
    },
  };
}

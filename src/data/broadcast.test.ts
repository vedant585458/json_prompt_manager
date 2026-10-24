import { describe, expect, it, vi } from 'vitest';

import {
  BROADCAST_CHANNEL_NAME,
  createWriteBroadcaster,
  isWriteAnnouncement,
  type BroadcastChannelLike,
  type WriteAnnouncement,
} from '@/data/broadcast';

/** A stand-in for `BroadcastChannel` that records traffic. */
function createFakeChannel(name: string) {
  const sent: unknown[] = [];
  const channel = {
    name,
    sent,
    closed: false,
    onmessage: null as BroadcastChannelLike['onmessage'],
    postMessage: vi.fn((message: unknown) => {
      sent.push(message);
    }),
    close: vi.fn(() => {
      channel.closed = true;
    }),
    /** Simulates a message arriving from another tab. */
    receive(data: unknown) {
      channel.onmessage?.({ data });
    },
  };
  return channel;
}

const at = new Date('2026-10-24T11:02:03.456Z');

function createBroadcaster(channel: ReturnType<typeof createFakeChannel> | null) {
  return createWriteBroadcaster({
    createChannel: () => channel,
    now: () => at,
  });
}

describe('isWriteAnnouncement', () => {
  it('accepts the three supported announcements', () => {
    expect(
      isWriteAnnouncement({
        type: 'prompt-written',
        promptId: 'p1',
        version: 3,
        at: at.toISOString(),
      }),
    ).toBe(true);
    expect(
      isWriteAnnouncement({ type: 'prompt-deleted', promptId: 'p1', at: at.toISOString() }),
    ).toBe(true);
    expect(isWriteAnnouncement({ type: 'settings-written', at: at.toISOString() })).toBe(true);
  });

  it('rejects anything else, including partial or foreign messages', () => {
    for (const value of [
      null,
      undefined,
      42,
      'prompt-written',
      [],
      {},
      { type: 'prompt-written' },
      { type: 'prompt-written', promptId: 'p1' },
      { type: 'prompt-written', promptId: 7, at: at.toISOString() },
      { type: 'settings-written' },
      { type: 'something-else', at: at.toISOString() },
    ]) {
      expect(isWriteAnnouncement(value), JSON.stringify(value)).toBe(false);
    }
  });
});

describe('createWriteBroadcaster', () => {
  it('subscribes to the shared channel name', () => {
    const channel = createFakeChannel('x');
    const createChannel = vi.fn(() => channel);

    const broadcaster = createWriteBroadcaster({ createChannel });

    expect(createChannel).toHaveBeenCalledWith(BROADCAST_CHANNEL_NAME);
    expect(broadcaster.supported).toBe(true);
    expect(broadcaster.channelName).toBe(BROADCAST_CHANNEL_NAME);
  });

  it('announces prompt writes with their new version and timestamp', () => {
    const channel = createFakeChannel('promptforge');
    const broadcaster = createBroadcaster(channel);

    broadcaster.announcePromptWrite({ id: 'p1', version: 4 });

    expect(channel.sent).toEqual([
      { type: 'prompt-written', promptId: 'p1', version: 4, at: at.toISOString() },
    ]);
  });

  it('announces deletions and settings writes', () => {
    const channel = createFakeChannel('promptforge');
    const broadcaster = createBroadcaster(channel);

    broadcaster.announcePromptDelete('p9');
    broadcaster.announce({ type: 'settings-written', at: at.toISOString() });

    expect(channel.sent).toEqual([
      { type: 'prompt-deleted', promptId: 'p9', at: at.toISOString() },
      { type: 'settings-written', at: at.toISOString() },
    ]);
  });

  it('delivers validated messages to every subscriber', () => {
    const channel = createFakeChannel('promptforge');
    const broadcaster = createBroadcaster(channel);
    const first = vi.fn();
    const second = vi.fn();
    broadcaster.subscribe(first);
    broadcaster.subscribe(second);

    const announcement: WriteAnnouncement = {
      type: 'prompt-written',
      promptId: 'p1',
      version: 2,
      at: at.toISOString(),
    };
    channel.receive(announcement);

    expect(first).toHaveBeenCalledWith(announcement);
    expect(second).toHaveBeenCalledWith(announcement);
  });

  it('ignores malformed messages from other tabs', () => {
    const channel = createFakeChannel('promptforge');
    const broadcaster = createBroadcaster(channel);
    const listener = vi.fn();
    broadcaster.subscribe(listener);

    channel.receive({ type: 'prompt-written', promptId: 'p1' });
    channel.receive('<script>alert(1)</script>');
    channel.receive(null);

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops delivering after unsubscribe and after close', () => {
    const channel = createFakeChannel('promptforge');
    const broadcaster = createBroadcaster(channel);
    const listener = vi.fn();
    const unsubscribe = broadcaster.subscribe(listener);
    const message: WriteAnnouncement = { type: 'settings-written', at: at.toISOString() };

    channel.receive(message);
    unsubscribe();
    channel.receive(message);
    expect(listener).toHaveBeenCalledTimes(1);

    broadcaster.subscribe(listener);
    broadcaster.close();
    channel.receive(message);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(channel.closed).toBe(true);
  });

  it('becomes a no-op when messaging is unavailable', () => {
    const broadcaster = createBroadcaster(null);
    const listener = vi.fn();

    expect(broadcaster.supported).toBe(false);
    expect(() => broadcaster.announcePromptWrite({ id: 'p1', version: 1 })).not.toThrow();

    const unsubscribe = broadcaster.subscribe(listener);
    expect(() => unsubscribe()).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
    expect(() => broadcaster.close()).not.toThrow();
  });

  it('degrades to a no-op when creating the channel throws', () => {
    const broadcaster = createWriteBroadcaster({
      createChannel: () => {
        throw new Error('blocked by policy');
      },
    });

    expect(broadcaster.supported).toBe(false);
    expect(() => broadcaster.announcePromptDelete('p1')).not.toThrow();
  });

  it('uses the real BroadcastChannel when one exists, and tolerates none', () => {
    const instances: Array<{ name: string; onmessage: BroadcastChannelLike['onmessage'] }> = [];
    class FakeBroadcastChannel implements BroadcastChannelLike {
      onmessage: BroadcastChannelLike['onmessage'] = null;
      postMessage = vi.fn();
      close = vi.fn();
      constructor(readonly name: string) {
        instances.push(this);
      }
    }

    const original = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    try {
      (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel;
      const supported = createWriteBroadcaster();
      expect(supported.supported).toBe(true);
      expect(instances[0]?.name).toBe(BROADCAST_CHANNEL_NAME);

      delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
      const unsupported = createWriteBroadcaster();
      expect(unsupported.supported).toBe(false);
    } finally {
      (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = original;
    }
  });
});

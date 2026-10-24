/**
 * Shared write infrastructure for the save pipeline (TASK-015).
 *
 * The queue is what keeps two saves for the same prompt from interleaving: a
 * slow write must never land after a fast later one. The broadcaster tells other
 * tabs that this tab wrote, so a dirty draft elsewhere can warn instead of being
 * overwritten without anyone noticing.
 *
 * Both are lazily created singletons because every editor mount must share them;
 * tests (and the hook) can inject their own instead.
 */

import {
  createWriteBroadcaster,
  createWriteQueue,
  type WriteBroadcaster,
  type WriteQueue,
} from '@/data';

let queue: WriteQueue | null = null;
let broadcaster: WriteBroadcaster | null = null;

/** The process-wide write queue. */
export function getSaveQueue(): WriteQueue {
  queue ??= createWriteQueue();
  return queue;
}

/** The process-wide cross-tab broadcaster. */
export function getWriteBroadcaster(): WriteBroadcaster {
  broadcaster ??= createWriteBroadcaster();
  return broadcaster;
}

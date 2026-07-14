// Pure, chrome.*-free queue logic — unit-tested directly, wired to
// chrome.storage.local by service-worker.ts.
import type { AttemptEvent } from '../shared/types';

export type EventQueue = AttemptEvent[];

export function enqueue(queue: EventQueue, event: AttemptEvent): EventQueue {
  if (queue.some((e) => e.eventId === event.eventId)) return queue;
  return [...queue, event];
}

export function dequeueByEventIds(queue: EventQueue, eventIds: readonly string[]): EventQueue {
  const acked = new Set(eventIds);
  return queue.filter((e) => !acked.has(e.eventId));
}

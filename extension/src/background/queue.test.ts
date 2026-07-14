import { describe, it, expect } from 'vitest';
import { enqueue, dequeueByEventIds } from './queue';
import type { AttemptEvent } from '../shared/types';

function makeEvent(eventId: string): AttemptEvent {
  return {
    eventId,
    problem: { slug: 'two-sum', title: 'Two Sum', difficulty: 'Easy', tags: ['Array'] },
    activeSeconds: 120,
    verdict: 'accepted',
    submissionCount: 1,
    quality: null,
    attemptedAt: new Date().toISOString(),
  };
}

describe('enqueue', () => {
  it('appends a new event', () => {
    const queue = enqueue([], makeEvent('a'));
    expect(queue.map((e) => e.eventId)).toEqual(['a']);
  });

  it('is idempotent on eventId — a duplicate is dropped, not appended', () => {
    const queue = enqueue([makeEvent('a')], makeEvent('a'));
    expect(queue).toHaveLength(1);
  });
});

describe('dequeueByEventIds', () => {
  it('removes only the acknowledged ids, preserving order of the rest', () => {
    const queue = [makeEvent('a'), makeEvent('b'), makeEvent('c')];
    const result = dequeueByEventIds(queue, ['b']);
    expect(result.map((e) => e.eventId)).toEqual(['a', 'c']);
  });

  it('is a no-op when none of the ids are present', () => {
    const queue = [makeEvent('a')];
    const result = dequeueByEventIds(queue, ['z']);
    expect(result).toEqual(queue);
  });
});

import { describe, it, expect } from 'vitest';
import { uuidv5, backfillEventId } from './uuidv5';

const UUID_V5_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidv5', () => {
  it('is deterministic: same namespace + name always produces the same UUID', async () => {
    const a = await uuidv5('a3f1e9d2-6b7c-4e10-9f5a-2d8c4b6e1a3f', 'hello');
    const b = await uuidv5('a3f1e9d2-6b7c-4e10-9f5a-2d8c4b6e1a3f', 'hello');
    expect(a).toBe(b);
  });

  it('produces different UUIDs for different names', async () => {
    const a = await uuidv5('a3f1e9d2-6b7c-4e10-9f5a-2d8c4b6e1a3f', 'hello');
    const b = await uuidv5('a3f1e9d2-6b7c-4e10-9f5a-2d8c4b6e1a3f', 'world');
    expect(a).not.toBe(b);
  });

  it('produces output matching the RFC 4122 v5 format (version and variant nibbles)', async () => {
    const id = await uuidv5('a3f1e9d2-6b7c-4e10-9f5a-2d8c4b6e1a3f', 'hello');
    expect(id).toMatch(UUID_V5_RE);
  });
});

describe('backfillEventId', () => {
  it('is deterministic per submission id, matching UUID v5 format', async () => {
    const a = await backfillEventId(123456);
    const b = await backfillEventId(123456);
    expect(a).toBe(b);
    expect(a).toMatch(UUID_V5_RE);
  });

  it('differs across submission ids', async () => {
    const a = await backfillEventId(1);
    const b = await backfillEventId(2);
    expect(a).not.toBe(b);
  });
});

// RFC 4122 §4.3 UUIDv5 (name-based, SHA-1) — deterministic UUID from a fixed
// namespace + name. Used so re-running the LeetCode-history backfill never
// creates duplicate attempts rows for the same submission: the Postgres
// column is a real UUID type, so a plain string like `backfill-12345` won't
// do, but the id also has to be the same every time for the same submission.

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/-/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
}

export async function uuidv5(namespace: string, name: string): Promise<string> {
  const namespaceBytes = hexToBytes(namespace);
  const nameBytes = new TextEncoder().encode(name);

  const combined = new Uint8Array(namespaceBytes.length + nameBytes.length);
  combined.set(namespaceBytes, 0);
  combined.set(nameBytes, namespaceBytes.length);

  const hashBuffer = await crypto.subtle.digest('SHA-1', combined);
  const hash = new Uint8Array(hashBuffer).slice(0, 16);

  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // variant RFC 4122

  return bytesToUuid(hash);
}

// Fixed, arbitrary namespace — only needs to be constant across runs, not
// meaningful in itself.
const BACKFILL_NAMESPACE = 'a3f1e9d2-6b7c-4e10-9f5a-2d8c4b6e1a3f';

export function backfillEventId(submissionId: number | string): Promise<string> {
  return uuidv5(BACKFILL_NAMESPACE, `codereps-backfill:${submissionId}`);
}

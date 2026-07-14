// Isolated world (see manifest.config.ts) — the orchestrator. Listens for a
// verdict from either the MAIN-world network patch or the DOM fallback,
// whichever fires first for a given attempt, and turns it into a complete
// AttemptEvent for the background service worker to queue and send.
import { getProblemMetadata } from './metadata';
import { trackActiveTime } from './activeTime';
import { watchDomForVerdict } from './domFallback';
import { mapStatusMsgToVerdict } from '../shared/verdict';
import type { AttemptEvent } from '../shared/types';

// Guards against the network patch and the DOM fallback both firing for the
// same real submission — whichever arrives first wins, the other is dropped.
const DEDUPE_WINDOW_MS = 3000;

function extractSlugFromUrl(): string | null {
  const match = window.location.pathname.match(/\/problems\/([^/]+)/);
  return match ? match[1] : null;
}

const slug = extractSlugFromUrl();

if (!slug) {
  console.warn(
    '[CodeReps] on a leetcode.com/problems/* page but could not parse a slug from',
    window.location.pathname
  );
} else {
  const activeTime = trackActiveTime();
  let submissionCount = 0;
  let lastCaptureAt = 0;

  async function handleVerdict(statusMsg: string | null | undefined): Promise<void> {
    if (!statusMsg) return;

    const now = Date.now();
    if (now - lastCaptureAt < DEDUPE_WINDOW_MS) return;
    lastCaptureAt = now;

    submissionCount += 1;
    const activeSeconds = activeTime.reset();

    try {
      const metadata = await getProblemMetadata(slug!);
      const event: AttemptEvent = {
        eventId: crypto.randomUUID(),
        problem: metadata,
        activeSeconds,
        verdict: mapStatusMsgToVerdict(statusMsg),
        submissionCount,
        quality: null,
        attemptedAt: new Date().toISOString(),
      };
      chrome.runtime.sendMessage({ type: 'codereps:attempt', event });
      console.log('[CodeReps] captured attempt:', event);
    } catch (err) {
      console.warn('[CodeReps] failed to build attempt event:', err);
    }
  }

  window.addEventListener('codereps:verdict', (event) => {
    void handleVerdict((event as CustomEvent).detail?.statusMsg);
  });

  watchDomForVerdict((statusMsg) => void handleVerdict(statusMsg));

  console.log('[CodeReps] tracking problem slug:', slug);
}

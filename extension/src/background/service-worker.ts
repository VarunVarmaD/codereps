// Replaces the M1 stub. Owns the chrome.storage.local-backed event queue: content
// scripts hand off captured attempts here, and this worker is responsible for
// getting them to the backend even across the service worker being killed and
// restarted at any time (the reason retries go through chrome.alarms, not
// setTimeout, and the queue lives in storage, not memory).
import { enqueue, dequeueByEventIds, type EventQueue } from './queue';
import { backoffDelayMs } from './backoff';
import { API_BASE_URL } from '../shared/config';
import type { AttemptEvent } from '../shared/types';

const QUEUE_STORAGE_KEY = 'codereps:eventQueue';
const TOKEN_STORAGE_KEY = 'extensionToken';
const PERIODIC_ALARM = 'codereps:flush-periodic';
const RETRY_ALARM = 'codereps:flush-retry';
const MAX_BATCH_SIZE = 100; // matches the backend's eventBatchSchema cap

// Reset on every worker wake — an undercount after a restart just means one
// extra fast retry, which is harmless; losing the queue itself would not be.
let consecutiveFailures = 0;

async function getQueue(): Promise<EventQueue> {
  const stored = await chrome.storage.local.get(QUEUE_STORAGE_KEY);
  return (stored[QUEUE_STORAGE_KEY] as EventQueue | undefined) ?? [];
}

async function setQueue(queue: EventQueue): Promise<void> {
  await chrome.storage.local.set({ [QUEUE_STORAGE_KEY]: queue });
}

async function getToken(): Promise<string | null> {
  const stored = await chrome.storage.local.get(TOKEN_STORAGE_KEY);
  return (stored[TOKEN_STORAGE_KEY] as string | undefined) ?? null;
}

async function flushQueue(): Promise<void> {
  const queue = await getQueue();
  if (queue.length === 0) return;

  const token = await getToken();
  if (!token) {
    console.warn('[CodeReps] no extension token set — open the popup and paste one');
    return;
  }

  const batch = queue.slice(0, MAX_BATCH_SIZE);

  try {
    const response = await fetch(`${API_BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ events: batch }),
    });

    if (!response.ok) {
      throw new Error(`POST /api/events failed: ${response.status}`);
    }

    await setQueue(dequeueByEventIds(queue, batch.map((event) => event.eventId)));
    consecutiveFailures = 0;

    if (queue.length > batch.length) {
      // More was queued than fit in one batch — the rest goes out now too.
      await flushQueue();
    }
  } catch (err) {
    consecutiveFailures += 1;
    console.warn('[CodeReps] flush failed, will retry:', err);
    chrome.alarms.create(RETRY_ALARM, {
      delayInMinutes: backoffDelayMs(consecutiveFailures) / 60_000,
    });
  }
}

function ensurePeriodicAlarm(): void {
  chrome.alarms.create(PERIODIC_ALARM, { periodInMinutes: 1 });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[CodeReps] service worker installed');
  ensurePeriodicAlarm();
});

chrome.runtime.onStartup.addListener(ensurePeriodicAlarm);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === PERIODIC_ALARM || alarm.name === RETRY_ALARM) {
    void flushQueue();
  }
});

// Best-effort, not queued like attempts (see DECISIONS.md): the attempt itself
// is already safely recorded by the time a rating happens, so a failed rating
// only loses that one attempt's scheduling effect, not real data. One POST
// attempt, log on failure, move on.
async function sendRating(eventId: string, quality: number): Promise<void> {
  const token = await getToken();
  if (!token) {
    console.warn('[CodeReps] no extension token set — open the popup and pair first');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/reviews/${eventId}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ quality }),
    });

    if (!response.ok) {
      throw new Error(`POST /api/reviews/${eventId}/rate failed: ${response.status}`);
    }
  } catch (err) {
    console.warn('[CodeReps] rating failed, not retried:', err);
  }
}

// Kicks off the opt-in history backfill: a popup click can't fetch
// leetcode.com's submissionList itself (a chrome-extension:// origin fetch
// wouldn't carry leetcode.com's session cookies), so this finds an open
// leetcode.com tab and asks its content script (content/backfill.ts, matched
// broadly — see manifest.config.ts) to run the fetch loop instead.
async function startBackfill(): Promise<{ ok: true } | { ok: false; error: string }> {
  const tabs = await chrome.tabs.query({ url: 'https://leetcode.com/*' });
  const tab = tabs[0];
  if (!tab?.id) {
    return { ok: false, error: 'Open a leetcode.com tab first, then try again.' };
  }

  await chrome.tabs.sendMessage(tab.id, { type: 'codereps:run-backfill' });
  return { ok: true };
}

// The content script sends the whole backfilled batch back in one message;
// this POSTs it to the backend in chunks of 100 (the eventBatchSchema cap),
// reusing the same endpoint and idempotency as the live-capture queue.
async function submitBackfillEvents(events: AttemptEvent[]): Promise<void> {
  const token = await getToken();
  if (!token) {
    console.warn('[CodeReps] no extension token set — open the popup and pair first');
    return;
  }

  for (let i = 0; i < events.length; i += MAX_BATCH_SIZE) {
    const chunk = events.slice(i, i + MAX_BATCH_SIZE);
    try {
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ events: chunk }),
      });
      if (!response.ok) {
        throw new Error(`POST /api/events (backfill) failed: ${response.status}`);
      }
    } catch (err) {
      console.warn('[CodeReps] backfill submission chunk failed:', err);
    }
  }
}

chrome.runtime.onMessage.addListener(
  (message: {
    type?: string;
    event?: AttemptEvent;
    events?: AttemptEvent[];
    eventId?: string;
    quality?: number;
  }, _sender, sendResponse) => {
    if (message?.type === 'codereps:attempt' && message.event) {
      const event = message.event;
      void (async () => {
        const queue = await getQueue();
        await setQueue(enqueue(queue, event));
        await flushQueue();
      })();
      return false;
    }

    if (message?.type === 'codereps:rate' && message.eventId && message.quality) {
      void sendRating(message.eventId, message.quality);
      return false;
    }

    if (message?.type === 'codereps:start-backfill') {
      void startBackfill().then(sendResponse);
      return true; // keep the message channel open for the async sendResponse
    }

    if (message?.type === 'codereps:backfill-complete' && message.events) {
      void submitBackfillEvents(message.events);
      return false;
    }

    return false;
  }
);

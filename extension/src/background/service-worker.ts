// Replaces the M1 stub. Owns the chrome.storage.local-backed event queue: content
// scripts hand off captured attempts here, and this worker is responsible for
// getting them to the backend even across the service worker being killed and
// restarted at any time (the reason retries go through chrome.alarms, not
// setTimeout, and the queue lives in storage, not memory).
import { enqueue, dequeueByEventIds, type EventQueue } from './queue';
import { backoffDelayMs } from './backoff';
import type { AttemptEvent } from '../shared/types';

const QUEUE_STORAGE_KEY = 'codereps:eventQueue';
const TOKEN_STORAGE_KEY = 'extensionToken';
const PERIODIC_ALARM = 'codereps:flush-periodic';
const RETRY_ALARM = 'codereps:flush-retry';
const API_BASE_URL = 'http://localhost:5001';
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

chrome.runtime.onMessage.addListener((message: { type?: string; event?: AttemptEvent }) => {
  if (message?.type !== 'codereps:attempt' || !message.event) return false;

  const event = message.event;
  void (async () => {
    const queue = await getQueue();
    await setQueue(enqueue(queue, event));
    await flushQueue();
  })();

  return false;
});

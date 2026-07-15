// Isolated world, broad match (any leetcode.com page — see manifest.config.ts,
// this needs to be present wherever an open leetcode.com tab is, not just on a
// problem page). Triggered by the background worker when the user clicks
// "Backfill History" in the popup. Pages through the user's full submission
// history via LeetCode's own submissionList query (same-origin fetch, carries
// the page's session cookies — this can only run here, never from the
// backend) and reports results back to the background.
import { getProblemMetadata } from './metadata';
import { mapStatusMsgToVerdict } from '../shared/verdict';
import { backfillEventId } from '../shared/uuidv5';
import type { AttemptEvent } from '../shared/types';

const PAGE_SIZE = 20; // LeetCode caps submissionList at 20/page regardless of requested limit
const MAX_SUBMISSIONS = 500;
const PAGE_DELAY_MS = 400;

const SUBMISSION_LIST_QUERY = `
  query submissionList($offset: Int!, $limit: Int!) {
    submissionList(offset: $offset, limit: $limit) {
      hasNext
      submissions {
        id
        title
        titleSlug
        statusDisplay
        timestamp
      }
    }
  }
`;

interface RawSubmission {
  id: string;
  title: string;
  titleSlug: string;
  statusDisplay: string;
  timestamp: string;
}

interface SubmissionListResponse {
  data?: {
    submissionList?: {
      hasNext: boolean;
      submissions: RawSubmission[];
    };
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllSubmissions(onProgress: (fetched: number) => void): Promise<RawSubmission[]> {
  const all: RawSubmission[] = [];
  let offset = 0;
  let hasNext = true;

  while (hasNext && all.length < MAX_SUBMISSIONS) {
    const response = await fetch('https://leetcode.com/graphql/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        query: SUBMISSION_LIST_QUERY,
        variables: { offset, limit: PAGE_SIZE },
        operationName: 'submissionList',
      }),
    });

    if (!response.ok) {
      throw new Error(`submissionList fetch failed: ${response.status}`);
    }

    const body = (await response.json()) as SubmissionListResponse;
    const page = body.data?.submissionList;
    if (!page) break;

    all.push(...page.submissions);
    onProgress(all.length);

    hasNext = page.hasNext;
    offset += PAGE_SIZE;

    if (hasNext && all.length < MAX_SUBMISSIONS) {
      await delay(PAGE_DELAY_MS);
    }
  }

  return all.slice(0, MAX_SUBMISSIONS);
}

async function buildAttemptEvents(submissions: RawSubmission[]): Promise<AttemptEvent[]> {
  const events: AttemptEvent[] = [];

  for (const submission of submissions) {
    try {
      const metadata = await getProblemMetadata(submission.titleSlug);
      const eventId = await backfillEventId(submission.id);
      events.push({
        eventId,
        problem: metadata,
        activeSeconds: 0, // unknown for historical submissions — see DECISIONS.md
        verdict: mapStatusMsgToVerdict(submission.statusDisplay),
        submissionCount: 1,
        quality: null,
        attemptedAt: new Date(parseInt(submission.timestamp, 10) * 1000).toISOString(),
        isBackfilled: true,
      });
    } catch (err) {
      console.warn('[CodeReps] skipping backfill submission (metadata fetch failed):', submission.titleSlug, err);
    }
  }

  return events;
}

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message?.type !== 'codereps:run-backfill') return false;

  void (async () => {
    try {
      const submissions = await fetchAllSubmissions((fetched) => {
        chrome.runtime.sendMessage({ type: 'codereps:backfill-progress', fetched });
      });

      const events = await buildAttemptEvents(submissions);
      chrome.runtime.sendMessage({ type: 'codereps:backfill-complete', events });
    } catch (err) {
      chrome.runtime.sendMessage({
        type: 'codereps:backfill-error',
        message: err instanceof Error ? err.message : 'Backfill failed',
      });
    }
  })();

  return false;
});

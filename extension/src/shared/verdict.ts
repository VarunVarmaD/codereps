// Shared by the MAIN-world network patch's DOM-fallback counterpart and the
// isolated-world orchestrator — both need to turn LeetCode's own status text into
// our verdict enum, and the DOM fallback needs to know which strings are terminal
// results (vs. a still-loading state) before it fires.
import type { Verdict } from './types';

const STATUS_MSG_TO_VERDICT: Record<string, Verdict> = {
  Accepted: 'accepted',
  'Wrong Answer': 'wrong_answer',
  'Time Limit Exceeded': 'tle',
  'Runtime Error': 'runtime_error',
  'Compile Error': 'compile_error',
  'Memory Limit Exceeded': 'other',
  'Output Limit Exceeded': 'other',
  'Internal Error': 'other',
};

export const KNOWN_STATUS_MESSAGES = new Set(Object.keys(STATUS_MSG_TO_VERDICT));

export function mapStatusMsgToVerdict(statusMsg: string | null | undefined): Verdict {
  if (!statusMsg) return 'other';
  return STATUS_MSG_TO_VERDICT[statusMsg] ?? 'other';
}

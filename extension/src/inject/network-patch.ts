// MAIN world (see manifest.config.ts) — runs inside the page's own JS context,
// before LeetCode's app code fires its first request. An isolated-world content
// script's fetch/XHR overrides only see requests it makes itself, not the page's;
// isolated worlds share the DOM with the page but not JS objects like `window.fetch`.
//
// Watches GET /submissions/detail/{id}/check/, which LeetCode's client polls until
// the body's `state` is "SUCCESS", and forwards the verdict to the isolated world
// via a window CustomEvent — the one thing the two worlds do share.

const CHECK_URL_RE = /\/submissions\/detail\/(\d+)\/check\/?(?:[?#]|$)/;
const dispatchedSubmissionIds = new Set<string>();

function maybeDispatchVerdict(url: string, body: unknown): void {
  const match = url.match(CHECK_URL_RE);
  if (!match) return;

  const submissionId = match[1];
  if (dispatchedSubmissionIds.has(submissionId)) return;

  const result = body as Record<string, unknown> | null;
  if (!result || result.state !== 'SUCCESS') return;

  dispatchedSubmissionIds.add(submissionId);
  window.dispatchEvent(
    new CustomEvent('codereps:verdict', {
      detail: {
        submissionId,
        statusMsg: (result.status_msg as string | undefined) ?? null,
      },
    })
  );
}

const originalFetch = window.fetch.bind(window);
window.fetch = async (...args: Parameters<typeof fetch>) => {
  const response = await originalFetch(...args);
  const input = args[0];
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  if (CHECK_URL_RE.test(url)) {
    response
      .clone()
      .json()
      .then((body) => maybeDispatchVerdict(url, body))
      .catch(() => {
        // Not JSON, or the body couldn't be read twice — the DOM fallback in the
        // isolated-world content script covers this case.
      });
  }

  return response;
};

const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;
const requestUrls = new WeakMap<XMLHttpRequest, string>();

XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
  requestUrls.set(this, url.toString());
  return (originalOpen as (...a: unknown[]) => unknown).apply(this, [method, url, ...rest]);
};

XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, ...args: unknown[]) {
  const url = requestUrls.get(this);
  if (url && CHECK_URL_RE.test(url)) {
    this.addEventListener('load', () => {
      try {
        maybeDispatchVerdict(url, JSON.parse(this.responseText));
      } catch {
        // Same non-JSON / already-consumed case as the fetch path above.
      }
    });
  }
  return (originalSend as (...a: unknown[]) => unknown).apply(this, args);
};

// Backstop for the rare case where the MAIN-world fetch/XHR patch misses a verdict
// (e.g. an injection timing race). Watches LeetCode's own result panel and reuses
// the same status-message text it renders to the user, rather than re-deriving a
// verdict from styling or icons that are more likely to change.
import { KNOWN_STATUS_MESSAGES } from '../shared/verdict';

const RESULT_SELECTOR = '[data-e2e-locator="submission-result"]';

export function watchDomForVerdict(onStatusMsg: (statusMsg: string) => void): () => void {
  const observer = new MutationObserver(() => {
    const text = document.querySelector(RESULT_SELECTOR)?.textContent?.trim();
    if (text && KNOWN_STATUS_MESSAGES.has(text)) {
      onStatusMsg(text);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}

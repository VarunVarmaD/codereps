// M1 skeleton: minimal service worker so the extension has a background context to
// build on. Event batching, retry-with-backoff, and the chrome.storage.local-backed
// queue (so this survives the worker being killed) are M2.

chrome.runtime.onInstalled.addListener(() => {
  console.log('[CodeReps] service worker installed');
});

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  console.log('[CodeReps] service worker received message:', message);
  return false;
});

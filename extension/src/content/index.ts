// M1 skeleton: prove the content script loads on a LeetCode problem page and can
// identify which problem it's on. Submission detection, DOM fallback, and active-time
// tracking are M2 — see the plan for the full breakdown.

function extractSlugFromUrl(): string | null {
  const match = window.location.pathname.match(/\/problems\/([^/]+)/);
  return match ? match[1] : null;
}

const slug = extractSlugFromUrl();
if (slug) {
  console.log('[CodeReps] problem slug:', slug);
} else {
  console.warn('[CodeReps] on a leetcode.com/problems/* page but could not parse a slug from', window.location.pathname);
}

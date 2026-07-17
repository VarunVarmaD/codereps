// Small shared helper for the Authorization-header pattern that used to be
// copy-pasted at every fetch call site (fetchProblems / handleStartPractice /
// handleSubmitReview, pre-M3). M3 adds enough new endpoints that repeating it
// a 9th time stopped being the smaller diff.
export interface AuthContext {
  session: { access_token: string } | null;
  isBypassed: boolean;
}

// Falls back to same-origin ('') rather than the literal string "undefined" —
// vercel.json's rewrites already proxy /api/* to the backend service on the
// same domain in production, so no env var is required there. Local dev sets
// VITE_API_URL=http://localhost:5001 explicitly (frontend/.env) since the two
// dev servers run on different ports.
const API_URL = import.meta.env.VITE_API_URL ?? '';

export async function apiFetch(path: string, auth: AuthContext, init: RequestInit = {}): Promise<Response> {
  const token = auth.isBypassed ? 'development_bypass_token' : auth.session?.access_token;
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
}

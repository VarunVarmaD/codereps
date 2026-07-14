// Small shared helper for the Authorization-header pattern that used to be
// copy-pasted at every fetch call site (fetchProblems / handleStartPractice /
// handleSubmitReview, pre-M3). M3 adds enough new endpoints that repeating it
// a 9th time stopped being the smaller diff.
export interface AuthContext {
  session: { access_token: string } | null;
  isBypassed: boolean;
}

const API_URL = import.meta.env.VITE_API_URL;

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

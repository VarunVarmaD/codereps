import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../shared/config';

const TOKEN_STORAGE_KEY = 'extensionToken';

// M3: replaces the M2 manual-token-paste stopgap with the real pairing flow —
// the web app mints a short-lived code (POST /api/pairing-codes), the user
// types it here, and this popup redeems it (POST /api/pair, no auth — the code
// itself is the credential) for a real extension token.
export function Popup() {
  const [token, setToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'pairing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    chrome.storage.local.get(TOKEN_STORAGE_KEY).then((stored) => {
      const existing = stored[TOKEN_STORAGE_KEY];
      if (typeof existing === 'string') setToken(existing);
    });
  }, []);

  async function handlePair() {
    setStatus('pairing');
    setErrorMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `Pairing failed (${response.status})`);
      }

      const body = (await response.json()) as { token: string };
      await chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: body.token });
      setToken(body.token);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Pairing failed');
    }
  }

  async function handleUnpair() {
    await chrome.storage.local.remove(TOKEN_STORAGE_KEY);
    setToken(null);
    setCode('');
    setStatus('idle');
  }

  return (
    <div style={{ padding: 16, fontSize: 13, fontFamily: 'system-ui, sans-serif', width: 240 }}>
      <strong>CodeReps</strong>
      {token ? (
        <>
          <p style={{ color: '#2e7d32' }}>Paired — capturing your LeetCode practice.</p>
          <button onClick={handleUnpair} style={{ width: '100%' }}>
            Unpair
          </button>
        </>
      ) : (
        <>
          <p style={{ color: '#555' }}>
            Generate a pairing code in the CodeReps web app, then paste it here.
          </p>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="pairing code"
            maxLength={8}
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, textTransform: 'uppercase' }}
          />
          <button onClick={handlePair} disabled={status === 'pairing' || code.trim().length === 0} style={{ width: '100%' }}>
            {status === 'pairing' ? 'Pairing…' : 'Pair'}
          </button>
          {status === 'error' && <p style={{ color: '#c62828' }}>{errorMessage}</p>}
        </>
      )}
    </div>
  );
}

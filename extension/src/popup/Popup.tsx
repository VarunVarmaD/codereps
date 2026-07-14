import { useEffect, useState } from 'react';

const TOKEN_STORAGE_KEY = 'extensionToken';

// M2 stopgap: a manual token paste-in so the capture pipeline can be exercised
// end-to-end without a psql insert on every test run. Replaced by the real
// pairing-code flow in M3 — this input goes away once that lands.
export function Popup() {
  const [token, setToken] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(TOKEN_STORAGE_KEY).then((stored) => {
      const existing = stored[TOKEN_STORAGE_KEY];
      if (typeof existing === 'string') setToken(existing);
    });
  }, []);

  function handleSave() {
    chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: token.trim() }).then(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div style={{ padding: 16, fontSize: 13, fontFamily: 'system-ui, sans-serif' }}>
      <strong>CodeReps</strong>
      <p style={{ color: '#555' }}>
        Paste an extension token (M2 stopgap — pairing-code UI arrives in M3).
      </p>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="extension token"
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
      />
      <button onClick={handleSave} style={{ width: '100%' }}>
        {saved ? 'Saved' : 'Save token'}
      </button>
    </div>
  );
}

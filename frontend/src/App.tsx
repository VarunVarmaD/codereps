import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  CheckCircle2,
  Calendar,
  ChevronRight,
  ChevronDown,
  LogOut,
  ExternalLink,
  Play,
  Mail,
  Lock,
  RefreshCw,
  Activity,
  Plus,
  Target,
  BarChart3,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from './config/supabase';
import { apiFetch, type AuthContext } from './lib/api';

interface ReviewEntry {
  quality: number;
  attemptedAt: string;
  problemTitle?: string;
}

interface QueueItem {
  id: number;
  title: string;
  category: string;
  difficulty: string;
  leetcodeUrl: string;
  leetcodeSlug: string;
  tags: string[];
  dueAt: string;
  easeFactor: number;
  repetitions: number;
  intervalDays: number;
}

interface Stats {
  dueToday: number;
  inProgress: number;
  tracked: number;
  mastered: number;
  recentActivity: ReviewEntry[];
  byDifficulty: { easy: number; medium: number; hard: number };
  accuracy: { accepted: number; total: number } | null;
}

interface ProblemSet {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  problem_count: number;
}

interface SetProblem {
  id: number;
  title: string;
  category: string;
  difficulty: string;
  leetcode_url: string;
  tracked: boolean;
}

// Mirrors the SM-2 phase transitions already in the backend's spacedRepetition
// service (S_new 1/2/3 -> bootstrap intervals, then EF-driven growth) rather
// than a separately invented status taxonomy.
function deriveStatus(repetitions: number): 'Learning' | 'Review' | 'Mastered' {
  if (repetitions >= 3) return 'Mastered';
  if (repetitions >= 1) return 'Review';
  return 'Learning';
}

// Confidence gauge — a radial readout of ease_factor (SM-2's 1.30-2.80 range),
// not a decorative progress ring. Tone bands mirror difficulty/status tokens.
function ConfidenceGauge({ easeFactor, size = 32 }: { easeFactor: number; size?: number }) {
  const confidence = Math.max(0, Math.min(100, Math.round(((easeFactor - 1.30) / (2.80 - 1.30)) * 100)));
  const tone = confidence < 40 ? 'tone-danger' : confidence >= 70 ? 'tone-success' : '';
  const strokeWidth = size >= 60 ? 6 : 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - confidence / 100);
  const center = size / 2;

  return (
    <div className={`confidence-gauge ${size >= 60 ? 'confidence-gauge-lg' : ''} ${tone}`}>
      <svg width={size} height={size}>
        <circle className="confidence-gauge-track" cx={center} cy={center} r={radius} strokeWidth={strokeWidth} />
        <circle
          className="confidence-gauge-fill"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="confidence-gauge-value readout-value">{confidence}</span>
    </div>
  );
}

// Rep-history timeline — one dot per rated attempt, oldest to newest. quality is
// 1-5 (attempts.quality); data-grade's CSS bands are keyed 0-4, so translate at
// this boundary rather than touching the CSS (same pattern as the backend's
// Q = quality - 1 translation for computeNextReview).
function RepTimeline({ history }: { history: ReviewEntry[] }) {
  if (!history || history.length === 0) {
    return <p className="rep-timeline-empty">No rated attempts yet.</p>;
  }

  return (
    <div className="rep-timeline">
      <span className="readout-label rep-timeline-label">Recent activity</span>
      {history.map((entry, idx) => (
        <span
          key={idx}
          className="rep-dot"
          data-grade={entry.quality - 1}
          title={`${entry.problemTitle ? entry.problemTitle + ' — ' : ''}quality ${entry.quality} — ${new Date(
            entry.attemptedAt
          ).toLocaleDateString()}`}
        ></span>
      ))}
    </div>
  );
}

function App() {
  const [session, setSession] = useState<any>(null);
  const [isBypassed, setIsBypassed] = useState(false);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'tracked' | 'sheet'>('dashboard');

  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  // Today / Tracked data
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [trackedItems, setTrackedItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');

  // Sheet (curated sets) data
  const [sets, setSets] = useState<ProblemSet[]>([]);
  const [selectedSetSlug, setSelectedSetSlug] = useState<string | null>(null);
  const [setProblems, setSetProblems] = useState<SetProblem[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [trackingId, setTrackingId] = useState<number | null>(null);

  // Add-a-problem-by-URL form
  const [addUrl, setAddUrl] = useState('');
  const [addUrlLoading, setAddUrlLoading] = useState(false);
  const [addUrlMessage, setAddUrlMessage] = useState('');
  const [addUrlError, setAddUrlError] = useState('');

  // Connect Extension pairing
  const [pairingCode, setPairingCode] = useState('');
  const [pairingExpiresAt, setPairingExpiresAt] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);

  const auth: AuthContext = { session, isBypassed };

  // Check current session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) setIsBypassed(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchQueue = async () => {
    const response = await apiFetch('/api/queue', auth);
    if (!response.ok) throw new Error('Failed to fetch due queue');
    setQueue((await response.json()).items);
  };

  const fetchTracked = async () => {
    const response = await apiFetch('/api/queue?scope=all', auth);
    if (!response.ok) throw new Error('Failed to fetch tracked problems');
    setTrackedItems((await response.json()).items);
  };

  const fetchStats = async () => {
    const response = await apiFetch('/api/stats', auth);
    if (!response.ok) throw new Error('Failed to fetch stats');
    setStats(await response.json());
  };

  const fetchSets = async () => {
    const response = await apiFetch('/api/sets', auth);
    if (!response.ok) throw new Error('Failed to fetch problem sets');
    const data = await response.json();
    setSets(data.sets);
  };

  const fetchSetProblems = async (slug: string) => {
    const response = await apiFetch(`/api/sets/${slug}/problems`, auth);
    if (!response.ok) throw new Error('Failed to fetch set problems');
    setSetProblems((await response.json()).problems);
  };

  const refreshDashboard = async () => {
    setDataLoading(true);
    setDataError('');
    try {
      await Promise.all([fetchQueue(), fetchStats()]);
    } catch (err: any) {
      setDataError(err.message || 'Failed to load dashboard');
    } finally {
      setDataLoading(false);
    }
  };

  // Fetch whatever the current tab needs — no client-side router, so this
  // fires whenever the active tab (or auth state) changes.
  useEffect(() => {
    if (!session && !isBypassed) return;
    setDataError('');
    setDataLoading(true);

    const load =
      currentTab === 'dashboard'
        ? Promise.all([fetchQueue(), fetchStats()])
        : currentTab === 'tracked'
        ? fetchTracked()
        : fetchSets();

    load
      .catch((err: any) => setDataError(err.message || 'Failed to load data'))
      .finally(() => setDataLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab, session, isBypassed]);

  useEffect(() => {
    if (currentTab === 'sheet' && selectedSetSlug) {
      fetchSetProblems(selectedSetSlug).catch((err: any) => setDataError(err.message || 'Failed to load set'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSetSlug]);

  // Auth execution handler
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Verification email sent! Check your inbox.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleBypassLogin = () => {
    setIsBypassed(true);
    setSession(null);
  };

  const handleLogout = async () => {
    if (isBypassed) {
      setIsBypassed(false);
    } else {
      await supabase.auth.signOut();
    }
    setQueue([]);
    setTrackedItems([]);
    setStats(null);
    setSets([]);
    setSetProblems([]);
  };

  const handleTrackProblem = async (problemId: number) => {
    setTrackingId(problemId);
    try {
      const response = await apiFetch(`/api/problems/${problemId}/track`, auth, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to track problem');
      if (selectedSetSlug) await fetchSetProblems(selectedSetSlug);
    } catch (err: any) {
      alert(err.message || 'Failed to track problem');
    } finally {
      setTrackingId(null);
    }
  };

  const handleAddByUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUrlLoading(true);
    setAddUrlError('');
    setAddUrlMessage('');
    try {
      const response = await apiFetch('/api/problems', auth, {
        method: 'POST',
        body: JSON.stringify({ leetcodeUrl: addUrl.trim() }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to add problem');
      }
      const problem = await response.json();
      setAddUrlMessage(`Added "${problem.title}" — now tracking it. Check the Tracked tab.`);
      setAddUrl('');
    } catch (err: any) {
      setAddUrlError(err.message || 'Failed to add problem');
    } finally {
      setAddUrlLoading(false);
    }
  };

  const handleGeneratePairingCode = async () => {
    setPairingLoading(true);
    try {
      const response = await apiFetch('/api/pairing-codes', auth, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to generate pairing code');
      const data = await response.json();
      setPairingCode(data.code);
      setPairingExpiresAt(data.expiresAt);
    } catch (err: any) {
      alert(err.message || 'Failed to generate pairing code');
    } finally {
      setPairingLoading(false);
    }
  };

  const getSetProblemsByCategory = () => {
    const groups: Record<string, SetProblem[]> = {};
    setProblems.forEach((p) => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return groups;
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const userEmail = isBypassed ? 'developer@codereps.local' : session?.user?.email;

  // Render Login page if not authenticated
  if (!session && !isBypassed) {
    return (
      <div className="auth-layout">
        <div className="auth-brand-panel">
          <h1 className="page-title">Codereps</h1>
          <p>
            A deliberate-practice log for DSA interviews. Solve on real LeetCode — the browser
            extension captures it — and let spaced repetition decide what you practice next.
          </p>
        </div>

        <div className="auth-form-panel">
          <div className="card auth-card">
            <h2 className="auth-heading">Sign in</h2>
            <p className="auth-subheading">Spaced repetition coding interview tracking</p>

            <form onSubmit={handleAuth}>
              <div className="auth-input-group">
                <label className="auth-label" htmlFor="email">Email Address</label>
                <div className="auth-input-wrap">
                  <Mail size={16} className="auth-input-icon" />
                  <input
                    id="email"
                    type="email"
                    className="auth-input"
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="auth-input-group auth-input-group-tight">
                <label className="auth-label" htmlFor="password">Password</label>
                <div className="auth-input-wrap">
                  <Lock size={16} className="auth-input-icon" />
                  <input
                    id="password"
                    type="password"
                    className="auth-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {authError && <div className="auth-error">{authError}</div>}

              <button type="submit" className="btn-primary btn-block" disabled={authLoading}>
                {authLoading ? 'Verifying...' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <div className="auth-toggle">
              <button type="button" className="link-plain" onClick={() => setIsSignUp(!isSignUp)}>
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>

            <div className="auth-divider">
              <hr />
              <span>dev sandbox</span>
              <hr />
            </div>

            <button type="button" className="btn-secondary btn-block btn-icon" onClick={handleBypassLogin}>
              <Play size={16} /> Instant Developer Bypass
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-title">
          <div className="sidebar-title-dot"></div>
          Codereps
        </div>

        <nav className="sidebar-nav">
          <button
            className={`sidebar-link ${currentTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentTab('dashboard')}
          >
            <LayoutDashboard size={18} /> Today
          </button>
          <button
            className={`sidebar-link ${currentTab === 'tracked' ? 'active' : ''}`}
            onClick={() => setCurrentTab('tracked')}
          >
            <Activity size={18} /> Tracked
          </button>
          <button
            className={`sidebar-link ${currentTab === 'sheet' ? 'active' : ''}`}
            onClick={() => setCurrentTab('sheet')}
          >
            <BookOpen size={18} /> Sheet
          </button>
        </nav>

        <div className="sidebar-extension">
          {pairingCode ? (
            <div className="pairing-code-display">
              <span className="readout-label">Pairing code</span>
              <span className="readout-value pairing-code-value">{pairingCode}</span>
              <span className="pairing-code-expiry">
                Expires {pairingExpiresAt ? new Date(pairingExpiresAt).toLocaleTimeString() : ''}
              </span>
            </div>
          ) : (
            <button
              className="btn-secondary btn-block btn-sm"
              onClick={handleGeneratePairingCode}
              disabled={pairingLoading}
            >
              {pairingLoading ? 'Generating…' : 'Connect Extension'}
            </button>
          )}
        </div>

        <div className="sidebar-profile">
          <span className="sidebar-email" title={userEmail || ''}>{userEmail}</span>
          <button className="sidebar-logout" onClick={handleLogout} aria-label="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="content-area">
        {currentTab === 'dashboard' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Today Dashboard</h1>
                <p className="page-subtitle">Your active review items for today</p>
              </div>
              <button className="btn-secondary btn-icon" onClick={refreshDashboard} disabled={dataLoading}>
                <RefreshCw size={16} className={dataLoading ? 'spin-animation' : ''} />
              </button>
            </div>

            <div className="stats-ribbon">
              <div className="card">
                <div className="stat-label-row tone-primary">
                  <Calendar size={18} />
                  <span>due today</span>
                </div>
                <p className="stat-val readout-value tone-primary">{stats?.dueToday ?? 0}</p>
              </div>
              <div className="card">
                <div className="stat-label-row tone-medium">
                  <RefreshCw size={18} />
                  <span>in progress</span>
                </div>
                <p className="stat-val readout-value tone-medium">{stats?.inProgress ?? 0}</p>
              </div>
              <div className="card">
                <div className="stat-label-row">
                  <Activity size={18} />
                  <span>tracked</span>
                </div>
                <p className="stat-val readout-value">{stats?.tracked ?? 0}</p>
              </div>
              <div className="card">
                <div className="stat-label-row tone-success">
                  <CheckCircle2 size={18} />
                  <span>mastered</span>
                </div>
                <p className="stat-val readout-value tone-success">{stats?.mastered ?? 0}</p>
              </div>
              <div className="card">
                <div className="stat-label-row">
                  <Target size={18} />
                  <span>accuracy (30d)</span>
                </div>
                <p className="stat-val readout-value">
                  {stats?.accuracy
                    ? `${Math.round((stats.accuracy.accepted / stats.accuracy.total) * 100)}%`
                    : '—'}
                </p>
              </div>
              <div className="card">
                <div className="stat-label-row">
                  <BarChart3 size={18} />
                  <span>by difficulty</span>
                </div>
                <div className="stat-difficulty-row readout-value">
                  <span className="tone-success" title="Easy">{stats?.byDifficulty.easy ?? 0}</span>
                  <span className="tone-medium" title="Medium">{stats?.byDifficulty.medium ?? 0}</span>
                  <span className="tone-danger" title="Hard">{stats?.byDifficulty.hard ?? 0}</span>
                </div>
              </div>
            </div>

            {dataError && <div className="error-banner">{dataError}</div>}

            <h2 className="section-heading">Spaced Repetition Due Queue</h2>
            {queue.length === 0 ? (
              <div className="card empty-state">
                <CheckCircle2 size={40} className="empty-state-icon tone-success" />
                <h3>All caught up!</h3>
                <p className="page-subtitle">
                  Nothing due right now. Go to the <strong>Sheet</strong> tab to pick something new, or
                  just solve anything on LeetCode — the extension will pick it up.
                </p>
              </div>
            ) : (
              <div className="problems-grid">
                {queue.map(p => (
                  <div key={p.id} className="card problem-card">
                    <div className="problem-card-header">
                      <h3 className="problem-title">{p.title}</h3>
                      <span className="tag-badge badge-difficulty" data-difficulty={p.difficulty}>
                        {p.difficulty}
                      </span>
                    </div>

                    <div className="tag-container">
                      <span className="tag-badge badge-category">{p.category}</span>
                      <span className="tag-badge badge-status" data-status={deriveStatus(p.repetitions)}>
                        {deriveStatus(p.repetitions)}
                      </span>
                    </div>

                    <div className="card-footer">
                      <div className="card-footer-left">
                        <ConfidenceGauge easeFactor={p.easeFactor} />
                        <a href={p.leetcodeUrl} target="_blank" rel="noreferrer" className="btn-leetcode">
                          Open on LeetCode <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {stats && stats.recentActivity.length > 0 && (
              <div style={{ marginTop: 40 }}>
                <RepTimeline history={stats.recentActivity} />
              </div>
            )}
          </div>
        )}

        {currentTab === 'tracked' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Tracked Problems</h1>
                <p className="page-subtitle">Everything currently in your Spaced Repetition loop</p>
              </div>
            </div>

            {dataError && <div className="error-banner">{dataError}</div>}

            {trackedItems.length === 0 ? (
              <div className="card empty-state">
                <Activity size={40} className="empty-state-icon" />
                <h3>No problems tracked yet</h3>
                <p className="page-subtitle">
                  Track a problem from the <strong>Sheet</strong> tab, or just solve something on LeetCode —
                  the extension starts tracking it automatically.
                </p>
              </div>
            ) : (
              <div className="card table-card">
                <table className="problems-table tracked-table">
                  <thead>
                    <tr>
                      <th>Problem Name</th>
                      <th>Category</th>
                      <th>Difficulty</th>
                      <th>Interval</th>
                      <th>Status / Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackedItems.map(p => {
                      const isOverdue = new Date(p.dueAt).getTime() <= Date.now();
                      const status = deriveStatus(p.repetitions);

                      return (
                        <tr key={p.id}>
                          <td>
                            <a href={p.leetcodeUrl} target="_blank" rel="noreferrer" className="problem-name-link">
                              {p.title}
                            </a>
                          </td>
                          <td>{p.category}</td>
                          <td>
                            <span className="tag-badge badge-difficulty" data-difficulty={p.difficulty}>
                              {p.difficulty}
                            </span>
                          </td>
                          <td className="cell-mono">
                            {p.intervalDays} {p.intervalDays === 1 ? 'day' : 'days'} (Reps: {p.repetitions})
                          </td>
                          <td>
                            <span className="tag-badge badge-status" data-status={isOverdue ? 'due' : status}>
                              {isOverdue ? 'Due Now' : `Due ${new Date(p.dueAt).toLocaleDateString()}`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {currentTab === 'sheet' && (
          <div>
            <div className="sheet-header">
              <h1 className="page-title">Curated Sets</h1>
              <p className="page-subtitle">Pick a set to browse, or add any LeetCode problem directly.</p>
            </div>

            <form className="add-problem-form" onSubmit={handleAddByUrl}>
              <input
                type="url"
                value={addUrl}
                onChange={e => setAddUrl(e.target.value)}
                placeholder="https://leetcode.com/problems/..."
                required
                className="auth-input add-problem-input"
              />
              <button type="submit" className="btn-primary btn-icon" disabled={addUrlLoading}>
                {addUrlLoading ? 'Adding…' : <>Add <Plus size={16} /></>}
              </button>
            </form>
            {addUrlMessage && <p className="add-problem-message success">{addUrlMessage}</p>}
            {addUrlError && <div className="error-banner">{addUrlError}</div>}

            {dataError && <div className="error-banner">{dataError}</div>}

            {!selectedSetSlug ? (
              /* SET CARDS — pick a set before browsing its problems */
              <div className="problems-grid">
                {sets.map(s => (
                  <button
                    key={s.id}
                    className="card problem-card set-card"
                    onClick={() => setSelectedSetSlug(s.slug)}
                  >
                    <div className="problem-card-header">
                      <h3 className="problem-title">{s.name}</h3>
                    </div>
                    {s.description && <p className="page-subtitle">{s.description}</p>}
                    <div className="card-footer">
                      <span className="tag-badge badge-category">{s.problem_count} problems</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <button className="link-plain set-back-link" onClick={() => setSelectedSetSlug(null)}>
                  <ArrowLeft size={14} /> Back to Sets
                </button>

                {Object.entries(getSetProblemsByCategory()).map(([category, items]) => {
                  const isExpanded = expandedCategories[category];
                  const trackedCount = items.filter(i => i.tracked).length;

                  return (
                    <div key={category} className="category-section">
                      <button className="category-header" onClick={() => toggleCategory(category)}>
                        <h3 className="category-title">
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          {category}
                        </h3>
                        <span className="category-meta">
                          {trackedCount} / {items.length} Tracked
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="card table-card category-table-wrap">
                          <table className="problems-table sheet-table">
                            <thead>
                              <tr>
                                <th>Problem Name</th>
                                <th>Difficulty</th>
                                <th>Status</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map(p => (
                                <tr key={p.id}>
                                  <td className="cell-strong">{p.title}</td>
                                  <td>
                                    <span className="tag-badge badge-difficulty" data-difficulty={p.difficulty}>
                                      {p.difficulty}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="tag-badge badge-status" data-status={p.tracked ? 'Review' : 'Untracked'}>
                                      {p.tracked ? 'Tracked' : 'Untracked'}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="row-actions">
                                      <a href={p.leetcode_url} target="_blank" rel="noreferrer" className="btn-leetcode">
                                        <ExternalLink size={14} />
                                      </a>
                                      {!p.tracked && (
                                        <button
                                          className="btn-practice btn-practice-sm"
                                          onClick={() => handleTrackProblem(p.id)}
                                          disabled={trackingId === p.id}
                                        >
                                          {trackingId === p.id ? 'Tracking…' : 'Track'}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

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
  Clock,
  Pause,
  HelpCircle,
  Activity,
  ArrowLeft,
  Zap,
  Terminal,
  Check
} from 'lucide-react';
import { supabase } from './config/supabase';
import { cppFoundationsChapters, placementQuestions, type Lesson } from './data/cppFoundations';

interface ReviewEntry {
  grade: number;
  reviewed_at: string;
}

interface Problem {
  id: number;
  title: string;
  category: string;
  difficulty: string;
  leetcode_url: string;
  description?: string;
  interval_days: number | null;
  ease_factor: number | null;
  repetition_count: number | null;
  due_at: string | null;
  enabled: boolean | null;
  status: 'Untracked' | 'Learning' | 'Review' | 'Mastered';
  due: boolean;
  days_left: number | null;
  history?: ReviewEntry[];
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

// Rep-history timeline — one dot per past review, oldest to newest, colored by recall grade.
function RepTimeline({ history }: { history: ReviewEntry[] }) {
  if (!history || history.length === 0) {
    return <p className="rep-timeline-empty">First rep — no review history yet.</p>;
  }

  return (
    <div className="rep-timeline">
      <span className="readout-label rep-timeline-label">Rep history</span>
      {history.map((entry, idx) => (
        <span
          key={idx}
          className="rep-dot"
          data-grade={entry.grade}
          title={`Grade ${entry.grade} — ${new Date(entry.reviewed_at).toLocaleDateString()}`}
        ></span>
      ))}
    </div>
  );
}

function App() {
  const [session, setSession] = useState<any>(null);
  const [isBypassed, setIsBypassed] = useState(false);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'learn' | 'tracked' | 'sheet'>('dashboard');

  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  // App Data State
  const [problems, setProblems] = useState<Problem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [problemsError, setProblemsError] = useState('');

  // Active Practice State
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'leetcode' | 'sandbox'>('leetcode');

  // Stopwatch Timer State
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Collapsible categories state (Sheet tab)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Learn Tab State
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(cppFoundationsChapters[0].lessons[0]);
  const [isPlacementTestActive, setIsPlacementTestActive] = useState(false);
  const [placementAnswers, setPlacementAnswers] = useState<Record<number, number>>({});
  const [placementSubmitted, setPlacementSubmitted] = useState(false);
  const [mcqAnswerSelected, setMcqAnswerSelected] = useState<number | null>(null);
  const [revealedSolutions, setRevealedSolutions] = useState<Record<string, boolean>>({});
  const [completedLessons, setCompletedLessons] = useState<Record<string, boolean>>({});

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

  // Fetch problems list from backend
  const fetchProblems = async () => {
    if (!session && !isBypassed) return;
    setDataLoading(true);
    setProblemsError('');
    try {
      const token = isBypassed ? 'development_bypass_token' : session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/problems`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch problems from database');
      const data = await response.json();
      setProblems(data);
    } catch (err: any) {
      setProblemsError(err.message || 'Failed to load problems');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    fetchProblems();
  }, [session, isBypassed]);

  // Stopwatch Timer Effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

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

  // Development bypass login handler
  const handleBypassLogin = () => {
    setIsBypassed(true);
    setSession(null);
  };

  // Logout handler
  const handleLogout = async () => {
    if (isBypassed) {
      setIsBypassed(false);
    } else {
      await supabase.auth.signOut();
    }
    setProblems([]);
    setActiveProblem(null);
  };

  // Open single problem practice workspace
  const handleStartPractice = async (problem: Problem) => {
    setDataLoading(true);
    try {
      const token = isBypassed ? 'development_bypass_token' : session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/problems/${problem.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to retrieve problem description');
      const detailedProblem = await response.json();

      // Initialize stopwatch and sub-tabs state
      setTimeElapsed(0);
      setIsTimerRunning(false);
      setWorkspaceTab('leetcode');
      setActiveProblem(detailedProblem);
    } catch (err: any) {
      alert(err.message || 'Failed to open problem workspace');
    } finally {
      setDataLoading(false);
    }
  };

  // Click handler for opening LeetCode & starting timer
  const handleOpenLeetCode = () => {
    setIsTimerRunning(true);
    window.open(activeProblem?.leetcode_url, '_blank');
  };

  // Submit SM-2 recall rating
  const handleSubmitReview = async (grade: number) => {
    if (!activeProblem) return;
    setRatingLoading(true);
    try {
      const token = isBypassed ? 'development_bypass_token' : session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/problems/${activeProblem.id}/review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ grade, durationSeconds: timeElapsed })
      });
      if (!response.ok) throw new Error('Failed to save review results');

      // Stop timer
      setIsTimerRunning(false);
      setTimeElapsed(0);

      // Reload problems list to refresh dashboard
      await fetchProblems();
      setActiveProblem(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save review grade');
    } finally {
      setRatingLoading(false);
    }
  };

  // Group problems by category for Sheet tab
  const getProblemsByCategory = () => {
    const groups: Record<string, Problem[]> = {};
    problems.forEach(p => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return groups;
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculations for display queues
  const dueQueue = problems.filter(p => p.due);
  const trackedProblems = problems.filter(p => p.status !== 'Untracked');

  // Statistics computations
  const totalMastered = problems.filter(p => p.status === 'Mastered').length;
  const totalLearning = problems.filter(p => p.status === 'Learning' || p.status === 'Review').length;

  const userEmail = isBypassed ? 'developer@codereps.local' : session?.user?.email;

  // Render Login page if not authenticated
  if (!session && !isBypassed) {
    return (
      <div className="auth-layout">
        <div className="auth-brand-panel">
          <h1 className="page-title">Codereps</h1>
          <p>
            A deliberate-practice log for DSA interviews. Track what's due, grade your
            own recall honestly, and let spaced repetition decide what you practice next.
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
            onClick={() => { setCurrentTab('dashboard'); setActiveProblem(null); }}
          >
            <LayoutDashboard size={18} /> Today
          </button>
          <button
            className={`sidebar-link ${currentTab === 'learn' ? 'active' : ''}`}
            onClick={() => { setCurrentTab('learn'); setActiveProblem(null); }}
          >
            <HelpCircle size={18} /> Learn
          </button>
          <button
            className={`sidebar-link ${currentTab === 'tracked' ? 'active' : ''}`}
            onClick={() => { setCurrentTab('tracked'); setActiveProblem(null); }}
          >
            <Activity size={18} /> Tracked
          </button>
          <button
            className={`sidebar-link ${currentTab === 'sheet' ? 'active' : ''}`}
            onClick={() => { setCurrentTab('sheet'); setActiveProblem(null); }}
          >
            <BookOpen size={18} /> Sheet
          </button>
        </nav>

        <div className="sidebar-profile">
          <span className="sidebar-email" title={userEmail || ''}>{userEmail}</span>
          <button className="sidebar-logout" onClick={handleLogout} aria-label="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="content-area">
        {activeProblem ? (
          /* SPLIT PANE WORKSPACE */
          <div>
            <div className="workspace-header">
              <div>
                <button className="link-plain" onClick={() => { setActiveProblem(null); setIsTimerRunning(false); }}>
                  <ArrowLeft size={14} /> Exit Workspace
                </button>
                <h2>{activeProblem.title}</h2>
              </div>
              <div className="workspace-badges">
                <span className="tag-badge badge-category">{activeProblem.category}</span>
                <span className="tag-badge badge-difficulty" data-difficulty={activeProblem.difficulty}>
                  {activeProblem.difficulty}
                </span>
                {activeProblem.ease_factor != null && (
                  <div className="confidence-gauge-wrap">
                    <ConfidenceGauge easeFactor={activeProblem.ease_factor} size={72} />
                    <span className="readout-label">Confidence</span>
                  </div>
                )}
              </div>
            </div>

            <RepTimeline history={activeProblem.history || []} />

            <div className="workspace-container">
              {/* Left Pane - Problem Description */}
              <div className="workspace-pane">
                <h3 className="workspace-pane-heading">Problem Description</h3>
                <div
                  className="prose"
                  dangerouslySetInnerHTML={{ __html: activeProblem.description || '<p>No description available.</p>' }}
                />
              </div>

              {/* Right Pane - Practice Session with Workspace Tabs */}
              <div className="workspace-pane">
                <div className="workspace-tabs">
                  <button
                    className={`workspace-tab ${workspaceTab === 'leetcode' ? 'active' : ''}`}
                    onClick={() => setWorkspaceTab('leetcode')}
                  >
                    Practice on LeetCode
                  </button>
                  <button
                    className={`workspace-tab ${workspaceTab === 'sandbox' ? 'active' : ''}`}
                    onClick={() => setWorkspaceTab('sandbox')}
                  >
                    Do it here <span className="soon-badge">Soon</span>
                  </button>
                </div>

                {workspaceTab === 'sandbox' ? (
                  /* SANDBOX PLACEHOLDER */
                  <div className="workspace-tab-panel workspace-tab-panel-empty">
                    <Clock size={40} className="timer-icon" />
                    <h3>Interactive Code Playground</h3>
                    <p>
                      An in-browser code editor and compiler sandbox is currently in progress.
                      Soon you will be able to write and execute code solutions directly on this screen.
                    </p>
                  </div>
                ) : (
                  /* LEETCODE PRACTICE VIEW */
                  <div className="workspace-tab-panel">
                    <Clock size={48} className={`timer-icon ${isTimerRunning ? 'running' : ''}`} />

                    <div className={`timer-display readout-value ${isTimerRunning ? 'running' : ''}`}>
                      {formatTime(timeElapsed)}
                    </div>

                    <div className="workspace-actions">
                      <button onClick={handleOpenLeetCode} className="btn-primary btn-icon">
                        Solve on LeetCode <ExternalLink size={16} />
                      </button>
                      {isTimerRunning && (
                        <button onClick={() => setIsTimerRunning(false)} className="btn-secondary">
                          <Pause size={16} />
                        </button>
                      )}
                    </div>

                    <div className="grading-section">
                      <h4 className="grading-heading">Rate your recall quality</h4>
                      <div className="grade-buttons">
                        {[
                          { val: 0, label: '0', title: 'Blackout', desc: 'No memory' },
                          { val: 1, label: '1', title: 'Familiar', desc: 'Recognized' },
                          { val: 2, label: '2', title: 'Struggled', desc: 'Needed hints' },
                          { val: 3, label: '3', title: 'Solved', desc: 'Correct, rough' },
                          { val: 4, label: '4', title: 'Fluent', desc: 'Clean, fast' }
                        ].map(g => (
                          <button
                            key={g.val}
                            className="btn-grade"
                            onClick={() => handleSubmitReview(g.val)}
                            disabled={ratingLoading}
                          >
                            <span>{g.label}</span>
                            <span className="btn-grade-title">{g.title}</span>
                            <span className="btn-grade-desc">{g.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* NORMAL TAB SWITCHING */
          <div>
            {currentTab === 'dashboard' && (
              /* TODAY DASHBOARD VIEW */
              <div>
                <div className="page-header">
                  <div>
                    <h1 className="page-title">Today Dashboard</h1>
                    <p className="page-subtitle">Your active review items for today</p>
                  </div>
                  <button className="btn-secondary btn-icon" onClick={fetchProblems} disabled={dataLoading}>
                    <RefreshCw size={16} className={dataLoading ? 'spin-animation' : ''} />
                  </button>
                </div>

                {/* Stats Ribbon */}
                <div className="stats-ribbon">
                  <div className="card">
                    <div className="stat-label-row tone-primary">
                      <Calendar size={18} />
                      <span>due today</span>
                    </div>
                    <p className="stat-val readout-value tone-primary">{dueQueue.length}</p>
                  </div>
                  <div className="card">
                    <div className="stat-label-row tone-medium">
                      <RefreshCw size={18} />
                      <span>in progress</span>
                    </div>
                    <p className="stat-val readout-value tone-medium">{totalLearning}</p>
                  </div>
                  <div className="card">
                    <div className="stat-label-row">
                      <Activity size={18} />
                      <span>tracked</span>
                    </div>
                    <p className="stat-val readout-value">{trackedProblems.length}</p>
                  </div>
                  <div className="card">
                    <div className="stat-label-row tone-success">
                      <CheckCircle2 size={18} />
                      <span>mastered</span>
                    </div>
                    <p className="stat-val readout-value tone-success">{totalMastered}</p>
                  </div>
                </div>

                {problemsError && <div className="error-banner">{problemsError}</div>}

                {/* Active Review Problems List */}
                <h2 className="section-heading">Spaced Repetition Due Queue</h2>
                {dueQueue.length === 0 ? (
                  <div className="card empty-state">
                    <CheckCircle2 size={40} className="empty-state-icon tone-success" />
                    <h3>All caught up!</h3>
                    <p className="page-subtitle">
                      You have zero problems due for review today. Go to the <strong>Sheet</strong> tab to practice new topics.
                    </p>
                  </div>
                ) : (
                  <div className="problems-grid">
                    {dueQueue.map(p => (
                      <div key={p.id} className="card problem-card">
                        <div className="problem-card-header">
                          <h3 className="problem-title">{p.title}</h3>
                          <span className="tag-badge badge-difficulty" data-difficulty={p.difficulty}>
                            {p.difficulty}
                          </span>
                        </div>

                        <div className="tag-container">
                          <span className="tag-badge badge-category">{p.category}</span>
                          <span className="tag-badge badge-status" data-status={p.status}>{p.status}</span>
                        </div>

                        <div className="card-footer">
                          <div className="card-footer-left">
                            {p.ease_factor != null && <ConfidenceGauge easeFactor={p.ease_factor} />}
                            <a href={p.leetcode_url} target="_blank" rel="noreferrer" className="btn-leetcode">
                              LeetCode Link <ExternalLink size={14} />
                            </a>
                          </div>
                          <button className="btn-practice" onClick={() => handleStartPractice(p)}>
                            Practice <Play size={12} fill="white" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {currentTab === 'learn' && (
              /* INTERACTIVE LEARNING HUB (UNIT 0) */
              <div className="learn-layout">
                {/* Left Navigation Sidebar */}
                <div className="card learn-nav">
                  <h3 className="learn-nav-heading">Unit 0 — C++ Foundations</h3>
                  <p className="learn-nav-subheading">Language prerequisites &amp; diagnostic test</p>

                  {/* Progress bar */}
                  <div className="progress-bar-track">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${(Object.keys(completedLessons).length / cppFoundationsChapters.reduce((acc, c) => acc + c.lessons.length, 0)) * 100}%`
                      }}
                    ></div>
                  </div>

                  <div className="learn-nav-list">
                    {/* Placement Test Button */}
                    <button
                      className={`sidebar-link placement-cta ${isPlacementTestActive ? 'active' : ''}`}
                      onClick={() => {
                        setIsPlacementTestActive(true);
                        setActiveLesson(null);
                        setMcqAnswerSelected(null);
                      }}
                    >
                      <span className="icon-label"><Zap size={14} /> Placement Test</span>
                      {placementSubmitted && <span className="done-badge">Done</span>}
                    </button>

                    {/* Chapters List */}
                    {cppFoundationsChapters.map(chapter => (
                      <div key={chapter.id}>
                        <h4 className="chapter-heading">{chapter.title.split(' — ')[0]}</h4>
                        <div className="chapter-lessons">
                          {chapter.lessons.map(lesson => {
                            const isSelected = activeLesson?.id === lesson.id;
                            const isDone = completedLessons[lesson.id];
                            return (
                              <button
                                key={lesson.id}
                                className={`sidebar-link lesson-link ${isSelected ? 'active' : ''}`}
                                onClick={() => {
                                  setIsPlacementTestActive(false);
                                  setActiveLesson(lesson);
                                  setMcqAnswerSelected(null);
                                }}
                              >
                                <span className="lesson-link-label">{lesson.title.split(' — ')[1]}</span>
                                {isDone && <Check size={12} className="lesson-done-icon" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Content Viewport */}
                <div className="card learn-content-pane">
                  {isPlacementTestActive ? (
                    /* RENDER PLACEMENT TEST */
                    <div>
                      <h2>Unit 0 Diagnostic Placement Test</h2>
                      <p className="placement-intro">
                        Answer these C++ prerequisite questions. Score <strong>5 / 6</strong> correct to skip Unit 0 and proceed directly to data structures.
                      </p>

                      <div className="placement-questions">
                        {placementQuestions.map((q, idx) => {
                          const selectedOpt = placementAnswers[q.id];
                          return (
                            <div key={q.id} className="placement-question">
                              <h4 className="placement-question-heading">{idx + 1}. {q.question}</h4>
                              <div className="placement-question-options">
                                {q.options.map((opt, optIdx) => {
                                  const isOptionSelected = selectedOpt === optIdx;
                                  let state = '';
                                  if (placementSubmitted) {
                                    if (optIdx === q.answerIndex) state = 'correct';
                                    else if (isOptionSelected) state = 'incorrect';
                                  } else if (isOptionSelected) {
                                    state = 'selected';
                                  }

                                  return (
                                    <button
                                      key={optIdx}
                                      disabled={placementSubmitted}
                                      onClick={() => setPlacementAnswers(prev => ({ ...prev, [q.id]: optIdx }))}
                                      className={`quiz-option ${state}`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                              {placementSubmitted && (
                                <div className="placement-explanation">
                                  <strong>Correct Answer: {q.answerLabel}</strong> — {q.explanation}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {placementSubmitted ? (
                        <div className="card placement-result">
                          <h3>
                            Diagnostic Score: {Object.values(placementAnswers).filter((ans, idx) => ans === placementQuestions[idx].answerIndex).length} / 6 Correct
                          </h3>
                          <p>
                            {Object.values(placementAnswers).filter((ans, idx) => ans === placementQuestions[idx].answerIndex).length >= 5
                              ? 'Strong result — you have verified C++ skills. Skip Unit 0 and proceed straight to Unit 1.'
                              : 'Recommended: review the C++ Foundations lessons before proceeding, to avoid syntax blocks later.'
                            }
                          </p>
                          <button
                            className="btn-secondary"
                            onClick={() => {
                              setPlacementAnswers({});
                              setPlacementSubmitted(false);
                            }}
                          >
                            Retake Diagnostic Test
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn-primary btn-block"
                          onClick={() => {
                            if (Object.keys(placementAnswers).length < placementQuestions.length) {
                              alert('Please complete all questions before submitting.');
                              return;
                            }
                            setPlacementSubmitted(true);
                          }}
                        >
                          Submit Test
                        </button>
                      )}
                    </div>
                  ) : activeLesson ? (
                    /* RENDER ACTIVE LESSON */
                    <div className="lesson-view">
                      <h2 className="lesson-heading">{activeLesson.title}</h2>

                      <div className="prose">
                        {activeLesson.content.map((paragraph, pIdx) => (
                          <div key={pIdx} dangerouslySetInnerHTML={{ __html: paragraph }} />
                        ))}

                        {/* RENDER MCQ IF EXISTS */}
                        {activeLesson.mcq && (
                          <div className="callout">
                            <h4 className="callout-header"><HelpCircle size={16} /> Check Your Understanding</h4>
                            <p className="callout-question">{activeLesson.mcq.question}</p>
                            <div className="quiz-options">
                              {activeLesson.mcq.options.map((opt, optIdx) => {
                                const isCorrect = optIdx === activeLesson.mcq!.answerIndex;
                                const isSelected = mcqAnswerSelected === optIdx;
                                let state = '';
                                if (mcqAnswerSelected !== null) {
                                  if (isCorrect) state = 'correct';
                                  else if (isSelected) state = 'incorrect';
                                }

                                return (
                                  <button
                                    key={optIdx}
                                    onClick={() => setMcqAnswerSelected(optIdx)}
                                    className={`quiz-option ${state}`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                            {mcqAnswerSelected !== null && (
                              <div className="callout-explanation">
                                <strong>Explanation:</strong> {activeLesson.mcq.explanation}
                              </div>
                            )}
                          </div>
                        )}

                        {/* RENDER CODE EXERCISE IF EXISTS */}
                        {activeLesson.codeExercise && (
                          <div className="callout">
                            <h4 className="callout-header"><Terminal size={16} /> Hands-On Exercise</h4>
                            <p className="callout-instruction">{activeLesson.codeExercise.instruction}</p>
                            <pre className="code-block"><code>{activeLesson.codeExercise.templateCode}</code></pre>

                            <div className="exercise-actions">
                              <button
                                className="btn-secondary btn-sm"
                                onClick={() => setRevealedSolutions(prev => ({ ...prev, [activeLesson.id]: !prev[activeLesson.id] }))}
                              >
                                {revealedSolutions[activeLesson.id] ? 'Hide Solution' : 'Reveal Solution'}
                              </button>
                            </div>

                            {revealedSolutions[activeLesson.id] && (
                              <div className="exercise-solution">
                                <strong>Solution Code:</strong>
                                <pre className="code-block solution"><code>{activeLesson.codeExercise.solutionCode}</code></pre>
                                <div className="page-subtitle">
                                  <strong>Concept:</strong> {activeLesson.codeExercise.explanation}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* LESSON COMPLETE BUTTON */}
                      <div className="lesson-complete-bar">
                        <span className="lesson-complete-label">Unit 0 — Lesson {activeLesson.id}</span>
                        <button
                          className={completedLessons[activeLesson.id] ? 'btn-secondary btn-icon' : 'btn-primary btn-icon'}
                          onClick={() => setCompletedLessons(prev => ({ ...prev, [activeLesson.id]: !prev[activeLesson.id] }))}
                        >
                          {completedLessons[activeLesson.id] ? (<><Check size={14} /> Completed</>) : 'Mark Lesson Complete'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {currentTab === 'tracked' && (
              /* TRACKED PROBLEMS LIST */
              <div>
                <div className="page-header">
                  <div>
                    <h1 className="page-title">Tracked Problems</h1>
                    <p className="page-subtitle">All questions currently in your Spaced Repetition queue</p>
                  </div>
                </div>

                {trackedProblems.length === 0 ? (
                  <div className="card empty-state">
                    <Activity size={40} className="empty-state-icon" />
                    <h3>No problems tracked yet</h3>
                    <p className="page-subtitle">
                      Practice a question from the <strong>Sheet</strong> tab to add it to your monitor loop.
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
                          <th>Status / Due Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trackedProblems.map(p => {
                          const dueInDays = p.days_left;
                          let dueMessage = 'Due Now';
                          let isOverdue = p.due;

                          if (!isOverdue && dueInDays !== null) {
                            if (dueInDays <= 0) {
                              dueMessage = 'Due Now';
                              isOverdue = true;
                            } else if (dueInDays === 1) {
                              dueMessage = 'In 1 day';
                            } else {
                              dueMessage = `In ${dueInDays} days`;
                            }
                          }

                          return (
                            <tr key={p.id}>
                              <td>
                                <button className="problem-name-link" onClick={() => handleStartPractice(p)}>
                                  {p.title}
                                </button>
                              </td>
                              <td>{p.category}</td>
                              <td>
                                <span className="tag-badge badge-difficulty" data-difficulty={p.difficulty}>
                                  {p.difficulty}
                                </span>
                              </td>
                              <td className="cell-mono">
                                {p.interval_days} {p.interval_days === 1 ? 'day' : 'days'} (Reps: {p.repetition_count})
                              </td>
                              <td>
                                <span className="tag-badge badge-status" data-status={isOverdue ? 'due' : p.status}>
                                  {isOverdue ? 'Due Now' : dueMessage}
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
              /* SHEET VIEW (ALL 250 PROBLEMS) */
              <div>
                <div className="sheet-header">
                  <h1 className="page-title">NeetCode 250 Sheet</h1>
                  <p className="page-subtitle">Practice problems list. Submitting a grade starts active tracking.</p>
                </div>

                {Object.entries(getProblemsByCategory()).map(([category, items]) => {
                  const isExpanded = expandedCategories[category];
                  const completedCount = items.filter(i => i.status === 'Mastered').length;
                  const trackedCount = items.filter(i => i.status !== 'Untracked').length;

                  return (
                    <div key={category} className="category-section">
                      <button className="category-header" onClick={() => toggleCategory(category)}>
                        <h3 className="category-title">
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          {category}
                        </h3>
                        <span className="category-meta">
                          {trackedCount} / {items.length} Tracked ({completedCount} Mastered)
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
                                    <span className="tag-badge badge-status" data-status={p.status}>{p.status}</span>
                                  </td>
                                  <td>
                                    <div className="row-actions">
                                      <a href={p.leetcode_url} target="_blank" rel="noreferrer" className="btn-leetcode">
                                        <ExternalLink size={14} />
                                      </a>
                                      <button
                                        className="btn-practice btn-practice-sm"
                                        onClick={() => handleStartPractice(p)}
                                      >
                                        {p.status === 'Untracked' ? 'Practice' : 'Review'}
                                      </button>
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

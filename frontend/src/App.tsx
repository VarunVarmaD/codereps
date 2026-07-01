import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Flame, 
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
  Activity
} from 'lucide-react';
import { supabase } from './config/supabase';
import { cppFoundationsChapters, placementQuestions, type Lesson } from './data/cppFoundations';
import './App.css';

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
      <div className="auth-container">
        <div className="card-glass auth-card">
          <h2 style={{ textAlign: 'center', marginBottom: '8px', fontSize: '28px' }}>Codereps</h2>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
            Spaced Repetition coding interview tracking
          </p>

          <form onSubmit={handleAuth}>
            <div className="auth-input-group">
              <label className="auth-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input 
                  type="email" 
                  className="auth-input" 
                  placeholder="name@example.com" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  required
                />
              </div>
            </div>

            <div className="auth-input-group" style={{ marginBottom: '24px' }}>
              <label className="auth-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  className="auth-input" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  required
                />
              </div>
            </div>

            {authError && (
              <div style={{ color: 'var(--accent-rose)', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
                {authError}
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ width: '100%', marginBottom: '16px' }} disabled={authLoading}>
              {authLoading ? 'Verifying...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
            <span 
              style={{ cursor: 'pointer', color: 'var(--text-secondary)', textDecoration: 'underline' }}
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </span>
          </div>

          <div style={{ margin: '24px 0 16px', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
            <hr style={{ flexGrow: 1, borderColor: 'var(--border-subtle)' }} />
            <span style={{ padding: '0 12px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>dev sandbox</span>
            <hr style={{ flexGrow: 1, borderColor: 'var(--border-subtle)' }} />
          </div>

          <button 
            type="button" 
            className="btn-secondary" 
            onClick={handleBypassLogin} 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Play size={16} /> Instant Developer Bypass
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-title">
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-primary)', boxShadow: '0 0 10px var(--accent-primary)' }}></div>
          Codereps
        </div>

        <nav className="sidebar-nav">
          <div 
            className={`sidebar-link ${currentTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setCurrentTab('dashboard'); setActiveProblem(null); }}
          >
            <LayoutDashboard size={18} /> Today
          </div>
          <div 
            className={`sidebar-link ${currentTab === 'learn' ? 'active' : ''}`}
            onClick={() => { setCurrentTab('learn'); setActiveProblem(null); }}
          >
            <HelpCircle size={18} /> Learn
          </div>
          <div 
            className={`sidebar-link ${currentTab === 'tracked' ? 'active' : ''}`}
            onClick={() => { setCurrentTab('tracked'); setActiveProblem(null); }}
          >
            <Activity size={18} /> Tracked
          </div>
          <div 
            className={`sidebar-link ${currentTab === 'sheet' ? 'active' : ''}`}
            onClick={() => { setCurrentTab('sheet'); setActiveProblem(null); }}
          >
            <BookOpen size={18} /> Sheet
          </div>
        </nav>

        <div className="sidebar-profile">
          <span className="sidebar-email" title={userEmail || ''}>{userEmail}</span>
          <LogOut size={16} className="sidebar-logout" onClick={handleLogout} />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="content-area">
        {activeProblem ? (
          /* SPLIT PANE WORKSPACE */
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <span className="sidebar-email" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { setActiveProblem(null); setIsTimerRunning(false); }}>
                  &larr; Exit Workspace
                </span>
                <h2 style={{ fontSize: '28px', marginTop: '8px', marginBottom: '0' }}>{activeProblem.title}</h2>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span className="tag-badge tag-category">{activeProblem.category}</span>
                <span className={`tag-badge ${
                  activeProblem.difficulty === 'Easy' ? 'diff-easy' : 
                  activeProblem.difficulty === 'Medium' ? 'diff-medium' : 'diff-hard'
                }`}>
                  {activeProblem.difficulty}
                </span>
              </div>
            </div>

            <div className="workspace-container">
              {/* Left Pane - Problem Description */}
              <div className="workspace-pane">
                <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginTop: '0' }}>
                  Problem Description
                </h3>
                <div 
                  className="description-content" 
                  dangerouslySetInnerHTML={{ __html: activeProblem.description || '<p>No description available.</p>' }}
                  style={{ fontSize: '15px', lineHeight: '1.6', color: '#e2e8f0' }}
                />
              </div>

              {/* Right Pane - Practice Session with Workspace Tabs */}
              <div className="workspace-pane" style={{ display: 'flex', flexDirection: 'column' }}>
                
                {/* Small Workspace Navbar Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '24px' }}>
                  <button 
                    className={`sidebar-link`}
                    onClick={() => setWorkspaceTab('leetcode')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: workspaceTab === 'leetcode' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      color: workspaceTab === 'leetcode' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      padding: '10px 16px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      borderRadius: '0'
                    }}
                  >
                    Practice on LeetCode
                  </button>
                  <button 
                    className={`sidebar-link`}
                    onClick={() => setWorkspaceTab('sandbox')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: workspaceTab === 'sandbox' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      color: workspaceTab === 'sandbox' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      padding: '10px 16px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      borderRadius: '0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    Do it here <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-subtle)', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Soon</span>
                  </button>
                </div>

                {workspaceTab === 'sandbox' ? (
                  /* SANDBOX PLACEHOLDER */
                  <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '40px 20px' }}>
                    <Clock size={40} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Interactive Code Playground</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '320px', margin: '0 auto', lineHeight: '1.5' }}>
                      An in-browser code editor and compiler sandbox is currently cooking. Soon you will be able to write and execute code solutions directly on this screen!
                    </p>
                  </div>
                ) : (
                  /* LEETCODE PRACTICE VIEW */
                  <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                    <Clock size={48} style={{ color: isTimerRunning ? 'var(--accent-cyan)' : 'var(--text-muted)', marginBottom: '12px', transition: 'color 0.3s' }} />
                    
                    {/* Timer Display */}
                    <div style={{ fontFamily: 'var(--font-code)', fontSize: '42px', fontWeight: 'bold', letterSpacing: '0.05em', color: isTimerRunning ? 'var(--accent-cyan)' : 'var(--text-primary)', marginBottom: '16px' }}>
                      {formatTime(timeElapsed)}
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginBottom: '40px' }}>
                      <button 
                        onClick={handleOpenLeetCode} 
                        className="btn-primary" 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
                      >
                        Solve on LeetCode <ExternalLink size={16} />
                      </button>
                      {isTimerRunning && (
                        <button 
                          onClick={() => setIsTimerRunning(false)} 
                          className="btn-secondary"
                          style={{ padding: '10px 14px' }}
                        >
                          <Pause size={16} />
                        </button>
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-subtle)', width: '100%', paddingTop: '24px' }}>
                      <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Rate your recall quality
                      </h4>
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
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '10px 2px' }}
                          >
                            <span style={{ fontSize: '13px' }}>{g.label}</span>
                            <span style={{ fontSize: '10px', color: 'white', fontWeight: 'bold' }}>{g.title}</span>
                            <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 'normal' }}>{g.desc}</span>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                  <div>
                    <h1 style={{ fontSize: '36px', margin: '0' }}>Today Dashboard</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Your active review items for today</p>
                  </div>
                  <button className="btn-secondary" onClick={fetchProblems} disabled={dataLoading}>
                    <RefreshCw size={16} className={dataLoading ? 'spin-animation' : ''} />
                  </button>
                </div>

                {/* Stats Ribbon */}
                <div className="stats-ribbon">
                  <div className="card-glass">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)' }}>
                      <Calendar size={18} />
                      <span style={{ fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>due today</span>
                    </div>
                    <p className="stat-val" style={{ color: 'var(--accent-cyan)' }}>{dueQueue.length}</p>
                  </div>
                  <div className="card-glass">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-amber)' }}>
                      <RefreshCw size={18} />
                      <span style={{ fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>in progress</span>
                    </div>
                    <p className="stat-val" style={{ color: 'var(--accent-amber)' }}>{totalLearning}</p>
                  </div>
                  <div className="card-glass">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
                      <Flame size={18} />
                      <span style={{ fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>streak</span>
                    </div>
                    <p className="stat-val" style={{ color: 'var(--accent-primary)' }}>3 days</p>
                  </div>
                  <div className="card-glass">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-green)' }}>
                      <CheckCircle2 size={18} />
                      <span style={{ fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>mastered</span>
                    </div>
                    <p className="stat-val" style={{ color: 'var(--accent-green)' }}>{totalMastered}</p>
                  </div>
                </div>

                {problemsError && (
                  <div style={{ background: 'hsla(340, 100%, 60%, 0.1)', border: '1px solid var(--accent-rose)', color: 'var(--accent-rose)', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px' }}>
                    {problemsError}
                  </div>
                )}

                {/* Active Review Problems List */}
                <h2 style={{ fontSize: '22px', marginBottom: '20px' }}>Spaced Repetition Due Queue</h2>
                {dueQueue.length === 0 ? (
                  <div className="card-glass" style={{ textAlign: 'center', padding: '48px' }}>
                    <CheckCircle2 size={40} style={{ color: 'var(--accent-green)', marginBottom: '12px' }} />
                    <h3>All caught up!</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>You have zero problems due for review today. Go to the **Sheet** tab to practice new topics.</p>
                  </div>
                ) : (
                  <div className="problems-grid">
                    {dueQueue.map(p => (
                      <div key={p.id} className="card-glass problem-card">
                        <div className="problem-card-header">
                          <h3 className="problem-title">{p.title}</h3>
                          <span className={`tag-badge ${
                            p.difficulty === 'Easy' ? 'diff-easy' : 
                            p.difficulty === 'Medium' ? 'diff-medium' : 'diff-hard'
                          }`}>
                            {p.difficulty}
                          </span>
                        </div>
                        
                        <div className="tag-container">
                          <span className="tag-badge tag-category">{p.category}</span>
                          <span className="tag-badge tag-status">{p.status}</span>
                        </div>

                        <div className="card-footer">
                          <a href={p.leetcode_url} target="_blank" rel="noreferrer" className="btn-leetcode">
                            LeetCode Link <ExternalLink size={14} />
                          </a>
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
              <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '32px', height: 'calc(100vh - 120px)' }}>
                {/* Left Navigation Sidebar */}
                <div className="card-glass" style={{ display: 'flex', flexDirection: 'column', padding: '20px', overflowY: 'auto' }}>
                  <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Unit 0 — C++ Foundations</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    Language prerequisites & diagnostic test
                  </p>

                  {/* Progress bar */}
                  <div style={{ background: 'var(--border-subtle)', borderRadius: '4px', height: '6px', width: '100%', marginBottom: '24px', overflow: 'hidden' }}>
                    <div style={{ 
                      background: 'var(--accent-green)', 
                      height: '100%', 
                      width: `${(Object.keys(completedLessons).length / cppFoundationsChapters.reduce((acc, c) => acc + c.lessons.length, 0)) * 100}%`,
                      transition: 'width 0.3s'
                    }}></div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Placement Test Button */}
                    <button 
                      className={`sidebar-link ${isPlacementTestActive ? 'active' : ''}`}
                      onClick={() => {
                        setIsPlacementTestActive(true);
                        setActiveLesson(null);
                        setMcqAnswerSelected(null);
                      }}
                      style={{ 
                        border: '1px solid var(--border-glow)',
                        background: isPlacementTestActive ? 'hsla(180, 100%, 50%, 0.15)' : 'transparent',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ fontWeight: 'bold' }}>⚡ Placement Test</span>
                      {placementSubmitted && (
                        <span style={{ fontSize: '11px', background: 'var(--accent-green)', padding: '2px 6px', borderRadius: '4px', color: 'white' }}>Done</span>
                      )}
                    </button>

                    {/* Chapters List */}
                    {cppFoundationsChapters.map(chapter => (
                      <div key={chapter.id}>
                        <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {chapter.title.split(' — ')[0]}
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {chapter.lessons.map(lesson => {
                            const isSelected = activeLesson?.id === lesson.id;
                            const isDone = completedLessons[lesson.id];
                            return (
                              <button
                                key={lesson.id}
                                className={`sidebar-link ${isSelected ? 'active' : ''}`}
                                onClick={() => {
                                  setIsPlacementTestActive(false);
                                  setActiveLesson(lesson);
                                  setMcqAnswerSelected(null);
                                }}
                                style={{ 
                                  textAlign: 'left',
                                  padding: '8px 12px',
                                  fontSize: '13px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  background: isSelected ? 'hsla(263, 90%, 55%, 0.12)' : 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  width: '100%',
                                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'
                                }}
                              >
                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                                  {lesson.title.split(' — ')[1]}
                                </span>
                                {isDone && <span style={{ color: 'var(--accent-green)', fontSize: '12px' }}>✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Content Viewport */}
                <div className="card-glass" style={{ padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  {isPlacementTestActive ? (
                    /* RENDER PLACEMENT TEST */
                    <div>
                      <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>⚡ Unit 0 Diagnostic Placement Test</h2>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '14px' }}>
                        Answer these C++ prerequisite questions. Score <strong>5 / 6</strong> correct to skip Unit 0 and proceed directly to data structures.
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
                        {placementQuestions.map((q, idx) => {
                          const selectedOpt = placementAnswers[q.id];
                          return (
                            <div key={q.id} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '20px' }}>
                              <h4 style={{ fontSize: '15px', marginBottom: '12px', color: 'var(--text-primary)', fontWeight: '600' }}>
                                {idx + 1}. {q.question}
                              </h4>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {q.options.map((opt, optIdx) => {
                                  const isOptionSelected = selectedOpt === optIdx;
                                  let btnBg = 'hsla(224, 71%, 12%, 0.5)';
                                  let btnBorder = 'var(--border-subtle)';
                                  
                                  if (placementSubmitted) {
                                    if (optIdx === q.answerIndex) {
                                      btnBg = 'hsla(142, 70%, 50%, 0.15)';
                                      btnBorder = 'var(--accent-green)';
                                    } else if (isOptionSelected) {
                                      btnBg = 'hsla(340, 100%, 60%, 0.15)';
                                      btnBorder = 'var(--accent-rose)';
                                    }
                                  } else if (isOptionSelected) {
                                    btnBg = 'hsla(263, 90%, 55%, 0.2)';
                                    btnBorder = 'var(--accent-primary)';
                                  }

                                  return (
                                    <button
                                      key={optIdx}
                                      disabled={placementSubmitted}
                                      onClick={() => setPlacementAnswers(prev => ({ ...prev, [q.id]: optIdx }))}
                                      style={{
                                        background: btnBg,
                                        border: `1px solid ${btnBorder}`,
                                        borderRadius: '8px',
                                        padding: '12px 16px',
                                        color: 'var(--text-primary)',
                                        textAlign: 'left',
                                        cursor: placementSubmitted ? 'default' : 'pointer',
                                        fontSize: '13px',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                              {placementSubmitted && (
                                <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '6px' }}>
                                  <strong>Correct Answer: {q.answerLabel}</strong> — {q.explanation}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {placementSubmitted ? (
                        <div className="card-glass" style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '24px' }}>
                          <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>
                            Diagnostic Score: {Object.values(placementAnswers).filter((ans, idx) => ans === placementQuestions[idx].answerIndex).length} / 6 Correct
                          </h3>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                            {Object.values(placementAnswers).filter((ans, idx) => ans === placementQuestions[idx].answerIndex).length >= 5 
                              ? '🏆 Perfect match! You have verified C++ skills. Skip Unit 0 and proceed straight to Unit 1.' 
                              : '💡 Recommended: review C++ Foundations lessons before proceeding to avoid syntax blocks.'
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
                          className="btn-primary" 
                          onClick={() => {
                            if (Object.keys(placementAnswers).length < placementQuestions.length) {
                              alert('Please complete all questions before submitting.');
                              return;
                            }
                            setPlacementSubmitted(true);
                          }}
                          style={{ width: '100%' }}
                        >
                          Submit Test
                        </button>
                      )}
                    </div>
                  ) : activeLesson ? (
                    /* RENDER ACTIVE LESSON */
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <h2 style={{ fontSize: '28px', marginBottom: '24px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
                        {activeLesson.title}
                      </h2>
                      
                      <div className="lesson-body-text" style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '15px', lineHeight: '1.7', color: '#e2e8f0', flexGrow: 1 }}>
                        {activeLesson.content.map((paragraph, pIdx) => (
                          <div key={pIdx} dangerouslySetInnerHTML={{ __html: paragraph }} />
                        ))}

                        {/* RENDER MCQ IF EXISTS */}
                        {activeLesson.mcq && (
                          <div className="card-glass" style={{ background: 'hsla(224, 71%, 6%, 0.4)', border: '1px solid var(--border-subtle)', padding: '24px', borderRadius: '8px', marginTop: '24px' }}>
                            <h4 style={{ fontSize: '15px', color: 'var(--accent-cyan)', marginBottom: '16px', marginTop: '0' }}>
                              ❓ Check Your Understanding
                            </h4>
                            <p style={{ fontWeight: '600', marginBottom: '16px', color: 'var(--text-primary)', fontSize: '14px' }}>{activeLesson.mcq.question}</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {activeLesson.mcq.options.map((opt, optIdx) => {
                                const isCorrect = optIdx === activeLesson.mcq!.answerIndex;
                                const isSelected = mcqAnswerSelected === optIdx;
                                let optBorder = 'var(--border-subtle)';
                                let optBg = 'transparent';
                                
                                if (mcqAnswerSelected !== null) {
                                  if (isCorrect) {
                                    optBorder = 'var(--accent-green)';
                                    optBg = 'rgba(142, 70, 50, 0.08)';
                                  } else if (isSelected) {
                                    optBorder = 'var(--accent-rose)';
                                    optBg = 'rgba(340, 100, 60, 0.08)';
                                  }
                                }

                                return (
                                  <button
                                    key={optIdx}
                                    onClick={() => setMcqAnswerSelected(optIdx)}
                                    style={{
                                      background: optBg,
                                      border: `1px solid ${optBorder}`,
                                      borderRadius: '6px',
                                      padding: '10px 14px',
                                      color: 'var(--text-primary)',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      fontSize: '13px',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                            {mcqAnswerSelected !== null && (
                              <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                                <strong>Explanation:</strong> {activeLesson.mcq.explanation}
                              </div>
                            )}
                          </div>
                        )}

                        {/* RENDER CODE EXERCISE IF EXISTS */}
                        {activeLesson.codeExercise && (
                          <div className="card-glass" style={{ background: 'hsla(224, 71%, 6%, 0.4)', border: '1px solid var(--border-subtle)', padding: '24px', borderRadius: '8px', marginTop: '24px' }}>
                            <h4 style={{ fontSize: '15px', color: 'var(--accent-amber)', marginBottom: '12px', marginTop: '0' }}>
                              💻 Hands-On Exercise
                            </h4>
                            <p style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '16px' }}>
                              {activeLesson.codeExercise.instruction}
                            </p>
                            <pre><code style={{ fontSize: '13px' }}>{activeLesson.codeExercise.templateCode}</code></pre>
                            
                            <div style={{ marginTop: '16px' }}>
                              <button 
                                className="btn-secondary" 
                                onClick={() => setRevealedSolutions(prev => ({ ...prev, [activeLesson.id]: !prev[activeLesson.id] }))}
                                style={{ fontSize: '12px', padding: '6px 12px' }}
                              >
                                {revealedSolutions[activeLesson.id] ? 'Hide Solution' : 'Reveal Solution'}
                              </button>
                            </div>

                            {revealedSolutions[activeLesson.id] && (
                              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                                <strong>Solution Code:</strong>
                                <pre><code style={{ fontSize: '13px', color: 'var(--accent-green)' }}>{activeLesson.codeExercise.solutionCode}</code></pre>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                  <strong>Concept:</strong> {activeLesson.codeExercise.explanation}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* LESSON COMPLETE BUTTON */}
                      <div style={{ marginTop: '40px', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                          Unit 0 — Lesson {activeLesson.id}
                        </span>
                        <button
                          className={completedLessons[activeLesson.id] ? 'btn-secondary' : 'btn-primary'}
                          onClick={() => setCompletedLessons(prev => ({ ...prev, [activeLesson.id]: !prev[activeLesson.id] }))}
                          style={{ padding: '8px 16px', fontSize: '13px' }}
                        >
                          {completedLessons[activeLesson.id] ? '✓ Completed' : 'Mark Lesson Complete'}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                  <div>
                    <h1 style={{ fontSize: '36px', margin: '0' }}>Tracked Problems</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>All questions currently in your Spaced Repetition queue</p>
                  </div>
                </div>

                {trackedProblems.length === 0 ? (
                  <div className="card-glass" style={{ textAlign: 'center', padding: '48px' }}>
                    <Activity size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                    <h3>No problems tracked yet</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>Practice a question from the **Sheet** tab to add it to your monitor loop.</p>
                  </div>
                ) : (
                  <div className="card-glass" style={{ padding: '0', overflowX: 'auto' }}>
                    <table className="problems-table">
                      <thead>
                        <tr>
                          <th style={{ width: '30%' }}>Problem Name</th>
                          <th style={{ width: '20%' }}>Category</th>
                          <th style={{ width: '15%' }}>Difficulty</th>
                          <th style={{ width: '15%' }}>Interval</th>
                          <th style={{ width: '20%' }}>Status / Due Time</th>
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
                              <td style={{ fontWeight: '600' }}>
                                <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => handleStartPractice(p)}>
                                  {p.title}
                                </span>
                              </td>
                              <td>{p.category}</td>
                              <td>
                                <span className={`tag-badge ${
                                  p.difficulty === 'Easy' ? 'diff-easy' : 
                                  p.difficulty === 'Medium' ? 'diff-medium' : 'diff-hard'
                                }`}>
                                  {p.difficulty}
                                </span>
                              </td>
                              <td style={{ fontFamily: 'var(--font-code)', fontSize: '13px' }}>
                                {p.interval_days} {p.interval_days === 1 ? 'day' : 'days'} (Reps: {p.repetition_count})
                              </td>
                              <td>
                                <span className={`tag-badge ${isOverdue ? 'diff-hard' : 'tag-status'}`}>
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
                <h1 style={{ fontSize: '36px', marginBottom: '12px' }}>NeetCode 250 Sheet</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Practice problems list. Submitting a grade starts active tracking.</p>

                {Object.entries(getProblemsByCategory()).map(([category, items]) => {
                  const isExpanded = expandedCategories[category];
                  const completedCount = items.filter(i => i.status === 'Mastered').length;
                  const trackedCount = items.filter(i => i.status !== 'Untracked').length;
                  
                  return (
                    <div key={category} style={{ marginBottom: '16px' }}>
                      <div className="category-header" onClick={() => toggleCategory(category)}>
                        <h3 className="category-title">
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          {category}
                        </h3>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                          {trackedCount} / {items.length} Tracked ({completedCount} Mastered)
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="card-glass" style={{ padding: '0', overflowX: 'auto', marginBottom: '16px' }}>
                          <table className="problems-table">
                            <thead>
                              <tr>
                                <th style={{ width: '40%' }}>Problem Name</th>
                                <th style={{ width: '20%' }}>Difficulty</th>
                                <th style={{ width: '20%' }}>Status</th>
                                <th style={{ width: '20%' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map(p => (
                                <tr key={p.id}>
                                  <td style={{ fontWeight: '600' }}>{p.title}</td>
                                  <td>
                                    <span className={`tag-badge ${
                                      p.difficulty === 'Easy' ? 'diff-easy' : 
                                      p.difficulty === 'Medium' ? 'diff-medium' : 'diff-hard'
                                    }`}>
                                      {p.difficulty}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`tag-badge ${
                                      p.status === 'Untracked' ? 'tag-status' :
                                      p.status === 'Learning' ? 'diff-medium' :
                                      p.status === 'Review' ? 'diff-easy' : 'diff-green'
                                    }`}>
                                      {p.status}
                                    </span>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                      <a href={p.leetcode_url} target="_blank" rel="noreferrer" className="btn-leetcode">
                                        <ExternalLink size={14} />
                                      </a>
                                      <button 
                                        className="btn-practice" 
                                        onClick={() => handleStartPractice(p)}
                                        style={{ padding: '4px 10px', fontSize: '12px' }}
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

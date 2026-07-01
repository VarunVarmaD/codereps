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
  RefreshCw
} from 'lucide-react';
import { supabase } from './config/supabase';
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
  status: 'New' | 'Learning' | 'Review' | 'Mastered';
  due: boolean;
}

function App() {
  const [session, setSession] = useState<any>(null);
  const [isBypassed, setIsBypassed] = useState(false);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'curriculum'>('dashboard');
  
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

  // Collapsible categories state
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

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
    // Fetch problem details including description
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
      setActiveProblem(detailedProblem);
    } catch (err: any) {
      alert(err.message || 'Failed to open problem workspace');
    } finally {
      setDataLoading(false);
    }
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
        body: JSON.stringify({ grade })
      });
      if (!response.ok) throw new Error('Failed to save review results');
      
      // Reload problems list to refresh dashboard
      await fetchProblems();
      setActiveProblem(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save review grade');
    } finally {
      setRatingLoading(false);
    }
  };

  // Group problems by category for Curriculum tab
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

  // Filtering dashboard problems (only due or learning problems)
  const dueQueue = problems.filter(p => p.due);

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
            <LayoutDashboard size={18} /> Today Dashboard
          </div>
          <div 
            className={`sidebar-link ${currentTab === 'curriculum' ? 'active' : ''}`}
            onClick={() => { setCurrentTab('curriculum'); setActiveProblem(null); }}
          >
            <BookOpen size={18} /> Curriculum
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
                <span className="sidebar-email" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setActiveProblem(null)}>
                  &larr; Back to Dashboard
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
              {/* Left Pane - LeetCode problem description */}
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

              {/* Right Pane - Grading and Practice Instructions */}
              <div className="workspace-pane" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                <h3 style={{ fontSize: '22px', marginBottom: '12px' }}>Practice Session</h3>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '340px', marginBottom: '32px', fontSize: '14px' }}>
                  Solve the problem on LeetCode's playground. When completed, rate your recall quality below to schedule your next repeat interval.
                </p>

                <a 
                  href={activeProblem.leetcode_url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn-primary" 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginBottom: '48px' }}
                >
                  Solve on LeetCode <ExternalLink size={16} />
                </a>

                <div style={{ borderTop: '1px solid var(--border-subtle)', width: '100%', paddingTop: '32px' }}>
                  <h4 style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Rate your recall quality
                  </h4>
                  <div className="grade-buttons">
                    {[
                      { val: 1, label: 'Again', desc: 'Forgot' },
                      { val: 2, label: 'Hard', desc: 'Slow' },
                      { val: 3, label: 'Good', desc: 'Okay' },
                      { val: 4, label: 'Easy', desc: 'Sleek' },
                      { val: 5, label: 'Perfect', desc: 'Instant' }
                    ].map(g => (
                      <button 
                        key={g.val}
                        className="btn-grade" 
                        onClick={() => handleSubmitReview(g.val)}
                        disabled={ratingLoading}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '10px 4px' }}
                      >
                        <span style={{ fontSize: '14px' }}>{g.val}</span>
                        <span style={{ fontSize: '11px', color: 'white' }}>{g.label}</span>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 'normal' }}>{g.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* NORMAL TAB SWITCHING */
          <div>
            {currentTab === 'dashboard' ? (
              /* TODAY DASHBOARD VIEW */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                  <div>
                    <h1 style={{ fontSize: '36px', margin: '0' }}>Today Dashboard</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Your Spaced Repetition queue for today</p>
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
                      <span style={{ fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>due review</span>
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
                <h2 style={{ fontSize: '22px', marginBottom: '20px' }}>Active Spaced Repetition Queue</h2>
                {dueQueue.length === 0 ? (
                  <div className="card-glass" style={{ textAlign: 'center', padding: '48px' }}>
                    <CheckCircle2 size={40} style={{ color: 'var(--accent-green)', marginBottom: '12px' }} />
                    <h3>All caught up!</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>You have zero problems due for review today. Go to the Curriculum tab to practice new topics.</p>
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
            ) : (
              /* CURRICULUM VIEW */
              <div>
                <h1 style={{ fontSize: '36px', marginBottom: '12px' }}>Curriculum Map</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Detailed roadmap of all 250 problems grouped by tags</p>

                {Object.entries(getProblemsByCategory()).map(([category, items]) => {
                  const isExpanded = expandedCategories[category];
                  const completedCount = items.filter(i => i.status === 'Mastered').length;
                  
                  return (
                    <div key={category} style={{ marginBottom: '16px' }}>
                      <div className="category-header" onClick={() => toggleCategory(category)}>
                        <h3 className="category-title">
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          {category}
                        </h3>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                          {completedCount} / {items.length} Mastered
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
                                    <span className="tag-badge tag-status">{p.status}</span>
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
                                        Practice
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

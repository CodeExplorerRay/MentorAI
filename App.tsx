
import React, { useState, useEffect } from 'react';
import { AppView, UserProfile, LearningPlan, DayPlan, Badge } from './types';
import { Diagnostic } from './components/Diagnostic';
import { Dashboard } from './components/Dashboard';
import { Session } from './components/Session';
import { Auth } from './components/Auth';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { generateLearningPlan } from './services/geminiService';
import { DatabaseService } from './services/dbService';
import { BrainCircuit, Loader2, LogOut } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const [view, setView] = useState<AppView>(AppView.ONBOARDING);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [currentDay, setCurrentDay] = useState<DayPlan | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  useEffect(() => {
    if (!process.env.API_KEY) {
        setApiKeyMissing(true);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const loadUserData = async () => {
      try {
        const userProfile = await DatabaseService.getUserProfile(user.id);
        const userPlan = await DatabaseService.getLearningPlan(user.id);

        if (userProfile && userPlan) {
          setProfile(userProfile);
          setPlan(userPlan);
          setView(AppView.DASHBOARD);
        } else {
          setView(AppView.ONBOARDING);
        }
      } catch (e) {
        console.error('Failed to load user data', e);
        setView(AppView.ONBOARDING);
      }
    };

    loadUserData();
  }, [user]);


  const handleDiagnosticComplete = async (newProfile: UserProfile) => {
    if (!user) return;

    setProfile(newProfile);
    setView(AppView.LOADING_PLAN);

    try {
      await DatabaseService.createOrUpdateUser(user.id, user.email!, newProfile.name);

      const schedule = await generateLearningPlan(newProfile.goal, newProfile.level);
      const planId = await DatabaseService.saveLearningPlan(user.id, newProfile, schedule);

      const newPlan: LearningPlan = {
        id: planId,
        topic: newProfile.goal,
        createdAt: Date.now(),
        schedule
      };

      setPlan(newPlan);
      setView(AppView.DASHBOARD);
    } catch (e) {
      console.error('Failed to save plan', e);
      alert('Failed to save learning plan. Please try again.');
    }
  };

  const handleStartDay = (day: DayPlan) => {
    setCurrentDay(day);
    setView(AppView.SESSION);
  };

  const handleSessionComplete = async (score: number) => {
    if (!plan || !currentDay || !profile || !user) return;

    try {
      await DatabaseService.updateDayPlan(plan.id, currentDay.day, {
        status: 'completed',
        quizScore: score
      });

      if (currentDay.day < plan.schedule.length) {
        await DatabaseService.updateDayPlan(plan.id, currentDay.day + 1, {
          status: 'active'
        });
      }

      const updatedSchedule = plan.schedule.map(d => {
        if (d.day === currentDay.day) {
          return { ...d, status: 'completed' as const, quizScore: score };
        }
        if (d.day === currentDay.day + 1) {
          return { ...d, status: 'active' as const };
        }
        return d;
      });

      const updatedPlan = { ...plan, schedule: updatedSchedule };
      setPlan(updatedPlan);

    // 2. Gamification Logic (Points & Streak)
    const today = new Date().toISOString().split('T')[0];
    const newStats = { ...profile.stats };
    
    // Calculate Points (Base 50 + Quiz Score)
    const pointsEarned = 50 + (score || 0);
    newStats.totalPoints += pointsEarned;

    // Calculate Streak
    if (newStats.lastActivityDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (newStats.lastActivityDate === yesterdayStr) {
            // Continued streak
            newStats.streak += 1;
        } else {
            // Broken streak or new start
            newStats.streak = 1;
        }
        newStats.lastActivityDate = today;
    }

    // Badges Logic
    const badges = [...newStats.badges];
    const addBadge = (id: string, name: string, desc: string, icon: Badge['icon']) => {
        if (!badges.find(b => b.id === id)) {
            badges.push({ id, name, description: desc, icon, earnedAt: Date.now() });
        }
    };

    // Check Milestones
    addBadge('first_step', 'First Step', 'Completed your first lesson', 'target');
    
    if (newStats.streak >= 3) addBadge('streak_3', 'On Fire', '3 Day Streak', 'flame');
    if (newStats.streak >= 7) addBadge('streak_7', 'Week Warrior', '7 Day Streak', 'zap');
    if (score >= 100) addBadge('quiz_perfect', 'Perfectionist', 'Scored 100% on a quiz', 'star');
    if (score >= 90) addBadge('quiz_master', 'Quiz Master', 'Scored 90%+ on a quiz', 'trophy');
    
    const completedCount = updatedSchedule.filter(d => d.status === 'completed').length;
    if (completedCount >= 10) addBadge('dedication_10', 'Dedicated', 'Completed 10 lessons', 'award');

    newStats.badges = badges;

      await DatabaseService.updateUserStats(user.id, {
        streak: newStats.streak,
        totalPoints: newStats.totalPoints,
        lastActivityDate: newStats.lastActivityDate
      });

      for (const badge of badges) {
        if (!profile.stats.badges.find(b => b.id === badge.id)) {
          await DatabaseService.addBadge(user.id, badge);
        }
      }

      const updatedProfile = { ...profile, stats: newStats };
      setProfile(updatedProfile);

      setView(AppView.DASHBOARD);
      setCurrentDay(null);
    } catch (e) {
      console.error('Failed to update progress', e);
    }
  };

  const handleReset = async () => {
    if (window.confirm("Are you sure you want to sign out?")) {
      await signOut();
      setProfile(null);
      setPlan(null);
      setView(AppView.ONBOARDING);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (apiKeyMissing) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-800 p-4 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-2 text-red-600">Configuration Error</h1>
          <p>The <code>process.env.API_KEY</code> is missing. This app requires a Google Gemini API key to function.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-800">
        
      {view !== AppView.SESSION && (
        <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
            <div className="max-w-5xl mx-auto flex justify-between items-center">
                <div className="flex items-center gap-2 text-indigo-600">
                    <BrainCircuit size={28} />
                    <span className="font-bold text-xl tracking-tight">MentorAI</span>
                </div>
                {view === AppView.DASHBOARD && (
                    <button onClick={handleReset} className="text-sm text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-2">
                        <LogOut size={16} />
                        Sign Out
                    </button>
                )}
            </div>
        </nav>
      )}

      <main className="h-[calc(100vh-65px)]">
        {view === AppView.ONBOARDING && (
          <div className="flex flex-col items-center justify-center h-full p-6">
            <div className="max-w-md w-full text-center space-y-6 mb-8">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                    Master any skill in <span className="text-indigo-600">30 days</span>.
                </h1>
                <p className="text-lg text-slate-500">
                    Your personalized AI tutor creates a custom curriculum, tracks your progress, and adapts to your learning style.
                </p>
                <button 
                    onClick={() => setView(AppView.DIAGNOSTIC)}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-lg shadow-lg shadow-indigo-200 transition-all transform hover:scale-[1.02]"
                >
                    Start Assessment
                </button>
            </div>
          </div>
        )}

        {view === AppView.DIAGNOSTIC && (
          <Diagnostic onComplete={handleDiagnosticComplete} />
        )}

        {view === AppView.LOADING_PLAN && (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                <p className="text-lg font-medium text-slate-600 animate-pulse">Designing your custom curriculum...</p>
            </div>
        )}

        {view === AppView.DASHBOARD && profile && plan && (
          <Dashboard profile={profile} plan={plan} onStartDay={handleStartDay} />
        )}

        {view === AppView.SESSION && plan && currentDay && (
          <Session 
            plan={currentDay} 
            topic={plan.topic} 
            onBack={() => setView(AppView.DASHBOARD)} 
            onComplete={handleSessionComplete}
          />
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;

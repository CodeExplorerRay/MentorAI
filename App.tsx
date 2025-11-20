
import React, { useState, useEffect } from 'react';
import { AppView, UserProfile, LearningPlan, DayPlan, Badge } from './types';
import { Diagnostic } from './components/Diagnostic';
import { Dashboard } from './components/Dashboard';
import { Session } from './components/Session';
import { generateLearningPlan } from './services/geminiService';
import { BrainCircuit, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.ONBOARDING);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [currentDay, setCurrentDay] = useState<DayPlan | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  useEffect(() => {
    // Check for API key in environment (frontend env vars)
    if (!process.env.API_KEY) {
        setApiKeyMissing(true);
    }
    
    // Load from local storage safely
    try {
        const savedProfile = localStorage.getItem('plm_profile');
        const savedPlan = localStorage.getItem('plm_plan');

        if (savedProfile && savedPlan) {
            const parsedProfile = JSON.parse(savedProfile);
            // Migrate old profiles that don't have stats
            if (!parsedProfile.stats) {
                parsedProfile.stats = { streak: 0, totalPoints: 0, lastActivityDate: null, badges: [] };
            }
            setProfile(parsedProfile);
            setPlan(JSON.parse(savedPlan));
            setView(AppView.DASHBOARD);
        } else {
            setView(AppView.ONBOARDING);
        }
    } catch (e) {
        console.error("Failed to load progress", e);
        setView(AppView.ONBOARDING);
    }
  }, []);

  // Helper to persist state reliably
  const persistState = (key: string, data: any) => {
      try {
          localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
          console.error(`Failed to save ${key}`, e);
          alert("Warning: Could not save progress to local storage. Check your browser settings.");
      }
  }

  const handleDiagnosticComplete = async (newProfile: UserProfile) => {
    setProfile(newProfile);
    persistState('plm_profile', newProfile);
    setView(AppView.LOADING_PLAN);

    // Call Planner Agent
    const schedule = await generateLearningPlan(newProfile.goal, newProfile.level);
    const newPlan: LearningPlan = {
      id: crypto.randomUUID(),
      topic: newProfile.goal,
      createdAt: Date.now(),
      schedule
    };

    setPlan(newPlan);
    persistState('plm_plan', newPlan);
    setView(AppView.DASHBOARD);
  };

  const handleStartDay = (day: DayPlan) => {
    setCurrentDay(day);
    setView(AppView.SESSION);
  };

  const handleSessionComplete = (score: number) => {
    if (!plan || !currentDay || !profile) return;

    // 1. Update Plan Status
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
    persistState('plm_plan', updatedPlan);

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

    // Update Profile State
    const updatedProfile = { ...profile, stats: newStats };
    setProfile(updatedProfile);
    persistState('plm_profile', updatedProfile);
    
    // Navigate back
    setView(AppView.DASHBOARD);
    setCurrentDay(null);
  };

  const handleReset = () => {
      if (window.confirm("Are you sure you want to reset all progress? This cannot be undone.")) {
        localStorage.clear();
        setProfile(null);
        setPlan(null);
        setView(AppView.ONBOARDING);
      }
  };

  if (apiKeyMissing) {
      return (
          <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-800 p-4 text-center">
              <div>
                  <h1 className="text-2xl font-bold mb-2 text-red-600">Configuration Error</h1>
                  <p>The <code>process.env.API_KEY</code> is missing. This app requires a Google Gemini API key to function.</p>
              </div>
          </div>
      )
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
                    <button onClick={handleReset} className="text-sm text-slate-400 hover:text-red-500 transition-colors">
                        Reset Progress
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

export default App;

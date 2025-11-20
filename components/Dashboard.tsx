
import React from 'react';
import { DayPlan, LearningPlan, UserProfile, Badge } from '../types';
import { Lock, Play, CheckCircle, Trophy, BarChart3, Calendar, Flame, Star, Target, Zap, Award } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

interface DashboardProps {
  profile: UserProfile;
  plan: LearningPlan;
  onStartDay: (day: DayPlan) => void;
}

const BadgeIcon: React.FC<{ icon: Badge['icon'], size?: number }> = ({ icon, size = 16 }) => {
    switch(icon) {
        case 'trophy': return <Trophy size={size} />;
        case 'star': return <Star size={size} />;
        case 'flame': return <Flame size={size} />;
        case 'target': return <Target size={size} />;
        case 'zap': return <Zap size={size} />;
        case 'award': return <Award size={size} />;
        default: return <Trophy size={size} />;
    }
};

export const Dashboard: React.FC<DashboardProps> = ({ profile, plan, onStartDay }) => {
  const completedDays = plan.schedule.filter(d => d.status === 'completed').length;
  const totalDays = plan.schedule.length;
  const progress = Math.round((completedDays / totalDays) * 100);
  const { streak, totalPoints, badges } = profile.stats;

  // Mock data for the chart
  const chartData = plan.schedule.map(d => ({
    day: `Day ${d.day}`,
    score: d.quizScore || 0,
    status: d.status
  }));

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {profile.name}</h1>
          <p className="text-slate-500 mt-1">Goal: <span className="font-medium text-indigo-600">{profile.goal}</span> • Level: <span className="font-medium text-indigo-600">{profile.level}</span></p>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 px-6 py-3 rounded-xl">
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Progress</p>
            <p className="text-xl font-bold text-slate-800">{progress}%</p>
          </div>
          <div className="w-12 h-12">
            <svg viewBox="0 0 36 36" className="w-full h-full text-indigo-600">
              <path
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="4"
              />
              <path
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray={`${progress}, 100`}
                className="animate-[spin_1s_ease-out_reverse]"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Schedule */}
        <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-500" />
                    Your Learning Path
                </h2>
            </div>
            <div className="space-y-3">
                {plan.schedule.map((day) => (
                <div 
                    key={day.day}
                    className={`group relative overflow-hidden rounded-xl border transition-all duration-200 ${
                        day.status === 'active' 
                        ? 'bg-white border-indigo-200 shadow-md ring-1 ring-indigo-100' 
                        : day.status === 'completed'
                        ? 'bg-slate-50 border-slate-200 opacity-75'
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                >
                    <div className="p-5 flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 font-bold text-lg ${
                            day.status === 'active' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' :
                            day.status === 'completed' ? 'bg-emerald-500 text-white' :
                            'bg-slate-200 text-slate-400'
                        }`}>
                            {day.status === 'completed' ? <CheckCircle size={20} /> : day.day}
                        </div>
                        
                        <div className="flex-1">
                            <h3 className={`font-semibold ${day.status === 'active' ? 'text-slate-900' : 'text-slate-700'}`}>
                                {day.title}
                            </h3>
                            <p className="text-sm text-slate-500 line-clamp-1">{day.objective}</p>
                        </div>

                        <button
                            onClick={() => day.status !== 'locked' && onStartDay(day)}
                            disabled={day.status === 'locked'}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                                day.status === 'active' 
                                ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' 
                                : day.status === 'completed'
                                ? 'text-emerald-600'
                                : 'text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            {day.status === 'active' ? (
                                <>Start <Play size={14} /></>
                            ) : day.status === 'completed' ? (
                                <>Review</>
                            ) : (
                                <Lock size={16} />
                            )}
                        </button>
                    </div>
                </div>
                ))}
            </div>
        </div>

        {/* Sidebar / Stats */}
        <div className="space-y-6">
            {/* Streaks & Points */}
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-5 rounded-2xl text-white shadow-lg">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <p className="text-violet-100 text-sm font-medium mb-1">Current Streak</p>
                        <div className="flex items-center gap-2">
                            <Flame className={`${streak > 0 ? 'text-orange-300 fill-orange-300' : 'text-violet-300'}`} />
                            <p className="text-3xl font-bold">{streak} Days</p>
                        </div>
                    </div>
                    <div className="text-right">
                         <p className="text-violet-100 text-sm font-medium mb-1">Total Points</p>
                         <p className="text-2xl font-bold text-yellow-300">{totalPoints.toLocaleString()}</p>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs text-violet-100 leading-relaxed flex items-center gap-2">
                        <Zap size={12} /> Keep studying daily to maintain your streak!
                    </p>
                </div>
            </div>

            {/* Badges */}
            {badges.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Award size={16} /> Earned Badges
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                        {badges.map((badge) => (
                            <div key={badge.id} className="group relative flex flex-col items-center justify-center p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                <div className="w-10 h-10 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center mb-1 ring-1 ring-yellow-100 group-hover:scale-110 transition-transform">
                                    <BadgeIcon icon={badge.icon} size={20} />
                                </div>
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 w-32 p-2 bg-slate-800 text-white text-xs rounded shadow-xl text-center">
                                    <p className="font-bold text-yellow-300 mb-1">{badge.name}</p>
                                    <p>{badge.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Mastery Chart */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <BarChart3 size={16} /> Recent Quiz Scores
                </h3>
                <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <XAxis dataKey="day" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                            <Tooltip 
                                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                            />
                            <Bar dataKey="score" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

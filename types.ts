
export enum AppView {
  ONBOARDING = 'ONBOARDING',
  DIAGNOSTIC = 'DIAGNOSTIC',
  LOADING_PLAN = 'LOADING_PLAN',
  DASHBOARD = 'DASHBOARD',
  SESSION = 'SESSION',
}

export interface Message {
  role: 'user' | 'model' | 'system';
  text: string;
  image?: string; // Base64 Data URI
  timestamp: number;
  isThinking?: boolean;
  groundingChunks?: any[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: 'trophy' | 'star' | 'flame' | 'target' | 'zap' | 'award';
  earnedAt: number;
}

export interface UserStats {
  streak: number;
  totalPoints: number;
  lastActivityDate: string | null; // ISO Date string YYYY-MM-DD
  badges: Badge[];
}

export interface UserProfile {
  name: string;
  goal: string; 
  level: string; 
  style: string; 
  competencyVector: Record<string, number>;
  stats: UserStats;
}

export interface DayPlan {
  day: number;
  title: string;
  objective: string;
  activities: string[];
  status: 'locked' | 'active' | 'completed';
  quizScore?: number;
}

export interface LearningPlan {
  id: string;
  topic: string;
  createdAt: number;
  schedule: DayPlan[];
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string; 
  explanation: string;
  hint?: string;
  resource?: string;
}

export interface QuizResult {
  score: number;
  total: number;
  feedback: string;
}

export interface SessionState {
  currentDay: number;
  messages: Message[];
  quizMode: boolean;
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          email?: string;
          updated_at?: string;
        };
      };
      learning_plans: {
        Row: {
          id: string;
          user_id: string;
          topic: string;
          level: string;
          style: string;
          competency_vector: Record<string, number>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic: string;
          level: string;
          style: string;
          competency_vector?: Record<string, number>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          topic?: string;
          level?: string;
          style?: string;
          competency_vector?: Record<string, number>;
          updated_at?: string;
        };
      };
      day_plans: {
        Row: {
          id: string;
          plan_id: string;
          day: number;
          title: string;
          objective: string;
          activities: string[];
          status: 'locked' | 'active' | 'completed';
          quiz_score: number | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          plan_id: string;
          day: number;
          title: string;
          objective: string;
          activities?: string[];
          status?: 'locked' | 'active' | 'completed';
          quiz_score?: number | null;
          completed_at?: string | null;
        };
        Update: {
          title?: string;
          objective?: string;
          activities?: string[];
          status?: 'locked' | 'active' | 'completed';
          quiz_score?: number | null;
          completed_at?: string | null;
        };
      };
      user_stats: {
        Row: {
          id: string;
          user_id: string;
          streak: number;
          total_points: number;
          last_activity_date: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          streak?: number;
          total_points?: number;
          last_activity_date?: string | null;
          updated_at?: string;
        };
        Update: {
          streak?: number;
          total_points?: number;
          last_activity_date?: string | null;
          updated_at?: string;
        };
      };
      badges: {
        Row: {
          id: string;
          user_id: string;
          badge_type: string;
          name: string;
          description: string;
          icon: string;
          earned_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          badge_type: string;
          name: string;
          description: string;
          icon: string;
          earned_at?: string;
        };
      };
      chat_history: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string | null;
          day: number | null;
          role: string;
          content: string;
          image: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id?: string | null;
          day?: number | null;
          role: string;
          content: string;
          image?: string | null;
          created_at?: string;
        };
      };
    };
  };
}

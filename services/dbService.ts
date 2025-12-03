import { supabase } from './supabaseClient';
import { UserProfile, LearningPlan, DayPlan, Badge } from '../types';

export class DatabaseService {
  static async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !user) return null;

    const { data: stats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: badges } = await supabase
      .from('badges')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    const { data: plans } = await supabase
      .from('learning_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      name: user.name,
      goal: plans?.topic || '',
      level: plans?.level || 'Intermediate',
      style: plans?.style || 'Adaptive',
      competencyVector: plans?.competency_vector || {},
      stats: {
        streak: stats?.streak || 0,
        totalPoints: stats?.total_points || 0,
        lastActivityDate: stats?.last_activity_date || null,
        badges: badges?.map(b => ({
          id: b.badge_type,
          name: b.name,
          description: b.description,
          icon: b.icon as Badge['icon'],
          earnedAt: new Date(b.earned_at).getTime()
        })) || []
      }
    };
  }

  static async createOrUpdateUser(userId: string, email: string, name: string) {
    const { error } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email,
        name,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    const { error: statsError } = await supabase
      .from('user_stats')
      .upsert({
        user_id: userId,
        streak: 0,
        total_points: 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (statsError) throw statsError;
  }

  static async saveLearningPlan(userId: string, profile: UserProfile, schedule: DayPlan[]): Promise<string> {
    const { data: plan, error: planError } = await supabase
      .from('learning_plans')
      .insert({
        user_id: userId,
        topic: profile.goal,
        level: profile.level,
        style: profile.style,
        competency_vector: profile.competencyVector
      })
      .select()
      .single();

    if (planError || !plan) throw planError;

    const dayPlansInserts = schedule.map(day => ({
      plan_id: plan.id,
      day: day.day,
      title: day.title,
      objective: day.objective,
      activities: day.activities,
      status: day.status,
      quiz_score: day.quizScore || null
    }));

    const { error: daysError } = await supabase
      .from('day_plans')
      .insert(dayPlansInserts);

    if (daysError) throw daysError;

    return plan.id;
  }

  static async getLearningPlan(userId: string): Promise<LearningPlan | null> {
    const { data: plan } = await supabase
      .from('learning_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!plan) return null;

    const { data: days } = await supabase
      .from('day_plans')
      .select('*')
      .eq('plan_id', plan.id)
      .order('day', { ascending: true });

    return {
      id: plan.id,
      topic: plan.topic,
      createdAt: new Date(plan.created_at).getTime(),
      schedule: days?.map(d => ({
        day: d.day,
        title: d.title,
        objective: d.objective,
        activities: d.activities as string[],
        status: d.status as 'locked' | 'active' | 'completed',
        quizScore: d.quiz_score || undefined
      })) || []
    };
  }

  static async updateDayPlan(planId: string, day: number, updates: Partial<DayPlan>) {
    const { error } = await supabase
      .from('day_plans')
      .update({
        status: updates.status,
        quiz_score: updates.quizScore || null,
        completed_at: updates.status === 'completed' ? new Date().toISOString() : null
      })
      .eq('plan_id', planId)
      .eq('day', day);

    if (error) throw error;
  }

  static async updateUserStats(userId: string, stats: {
    streak: number;
    totalPoints: number;
    lastActivityDate: string | null;
  }) {
    const { error } = await supabase
      .from('user_stats')
      .update({
        streak: stats.streak,
        total_points: stats.totalPoints,
        last_activity_date: stats.lastActivityDate,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) throw error;
  }

  static async addBadge(userId: string, badge: Badge) {
    const { error } = await supabase
      .from('badges')
      .insert({
        user_id: userId,
        badge_type: badge.id,
        name: badge.name,
        description: badge.description,
        icon: badge.icon
      });

    if (error && !error.message.includes('duplicate')) throw error;
  }

  static async saveChatMessage(
    userId: string,
    planId: string | null,
    day: number | null,
    role: string,
    content: string,
    image?: string
  ) {
    const { error } = await supabase
      .from('chat_history')
      .insert({
        user_id: userId,
        plan_id: planId,
        day,
        role,
        content,
        image: image || null
      });

    if (error) throw error;
  }
}

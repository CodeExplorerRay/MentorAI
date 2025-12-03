/*
  # Learning Platform Schema

  ## Overview
  Complete database schema for the MentorAI personalized learning platform.
  Migrates from localStorage to Supabase for cross-device sync and data persistence.

  ## New Tables

  ### `users`
  - `id` (uuid, primary key) - Links to auth.users
  - `name` (text) - Learner name
  - `email` (text) - User email
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last profile update

  ### `learning_plans`
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key) - Owner of the plan
  - `topic` (text) - Learning goal/subject
  - `level` (text) - Beginner/Intermediate/Advanced
  - `style` (text) - Learning preference
  - `competency_vector` (jsonb) - Skill assessment map
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `day_plans`
  - `id` (uuid, primary key)
  - `plan_id` (uuid, foreign key) - Parent learning plan
  - `day` (integer) - Day number (1-30)
  - `title` (text) - Lesson title
  - `objective` (text) - Learning objective
  - `activities` (jsonb) - Array of activities
  - `status` (text) - locked/active/completed
  - `quiz_score` (integer) - Quiz result (0-100)
  - `completed_at` (timestamptz) - Completion timestamp

  ### `user_stats`
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key, unique) - One stats record per user
  - `streak` (integer) - Consecutive days studied
  - `total_points` (integer) - Cumulative XP
  - `last_activity_date` (date) - Last study session date
  - `updated_at` (timestamptz)

  ### `badges`
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key)
  - `badge_type` (text) - Badge identifier
  - `name` (text) - Badge display name
  - `description` (text) - Achievement description
  - `icon` (text) - Icon identifier
  - `earned_at` (timestamptz)

  ### `chat_history`
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key)
  - `plan_id` (uuid, foreign key)
  - `day` (integer) - Associated day plan
  - `role` (text) - user/model/system
  - `content` (text) - Message text
  - `image` (text) - Optional base64 image
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Users can only access their own data
  - Strict authentication requirements

  ## Notes
  - Uses gen_random_uuid() for primary keys
  - Timestamps default to now()
  - Foreign keys enforce referential integrity
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Learning plans
CREATE TABLE IF NOT EXISTS learning_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  topic text NOT NULL,
  level text NOT NULL DEFAULT 'Intermediate',
  style text NOT NULL DEFAULT 'Adaptive',
  competency_vector jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Day plans (curriculum schedule)
CREATE TABLE IF NOT EXISTS day_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES learning_plans(id) ON DELETE CASCADE NOT NULL,
  day integer NOT NULL,
  title text NOT NULL,
  objective text NOT NULL,
  activities jsonb DEFAULT '[]',
  status text NOT NULL DEFAULT 'locked',
  quiz_score integer DEFAULT NULL,
  completed_at timestamptz DEFAULT NULL,
  UNIQUE(plan_id, day)
);

-- User statistics (gamification)
CREATE TABLE IF NOT EXISTS user_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  streak integer DEFAULT 0,
  total_points integer DEFAULT 0,
  last_activity_date date DEFAULT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Badges (achievements)
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  badge_type text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_type)
);

-- Chat history (session memory)
CREATE TABLE IF NOT EXISTS chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES learning_plans(id) ON DELETE CASCADE,
  day integer DEFAULT NULL,
  role text NOT NULL,
  content text NOT NULL,
  image text DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_learning_plans_user_id ON learning_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_day_plans_plan_id ON day_plans(plan_id);
CREATE INDEX IF NOT EXISTS idx_badges_user_id ON badges(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_plan ON chat_history(user_id, plan_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for learning_plans
CREATE POLICY "Users can view own learning plans"
  ON learning_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own learning plans"
  ON learning_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learning plans"
  ON learning_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own learning plans"
  ON learning_plans FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for day_plans
CREATE POLICY "Users can view own day plans"
  ON day_plans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_plans
      WHERE learning_plans.id = day_plans.plan_id
      AND learning_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own day plans"
  ON day_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_plans
      WHERE learning_plans.id = day_plans.plan_id
      AND learning_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own day plans"
  ON day_plans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_plans
      WHERE learning_plans.id = day_plans.plan_id
      AND learning_plans.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_plans
      WHERE learning_plans.id = day_plans.plan_id
      AND learning_plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own day plans"
  ON day_plans FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_plans
      WHERE learning_plans.id = day_plans.plan_id
      AND learning_plans.user_id = auth.uid()
    )
  );

-- RLS Policies for user_stats
CREATE POLICY "Users can view own stats"
  ON user_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stats"
  ON user_stats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stats"
  ON user_stats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for badges
CREATE POLICY "Users can view own badges"
  ON badges FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own badges"
  ON badges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for chat_history
CREATE POLICY "Users can view own chat history"
  ON chat_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own chat history"
  ON chat_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat history"
  ON chat_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

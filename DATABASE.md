# Database Architecture

## Overview

MentorAI now uses Supabase for persistent data storage, replacing localStorage with a production-ready PostgreSQL database. This enables cross-device sync, better data integrity, and scalable user management.

## Schema Design

### Tables

#### `users`
Extends Supabase's `auth.users` table with application-specific profile data.
- Primary key references `auth.users.id`
- Stores user name and email
- One-to-many relationship with learning plans

#### `learning_plans`
Stores the generated 30-day curricula for each user.
- Foreign key to `users`
- Stores topic, level, style, and competency vector
- Each user can have multiple plans (historical tracking)

#### `day_plans`
Individual day entries within a learning plan.
- Foreign key to `learning_plans`
- Tracks status (locked/active/completed)
- Records quiz scores and completion timestamps
- Unique constraint on (plan_id, day) prevents duplicates

#### `user_stats`
Gamification metrics for each user.
- One-to-one relationship with `users`
- Tracks streak, points, and last activity date
- Updated after each completed session

#### `badges`
Achievement records.
- Foreign key to `users`
- Unique constraint on (user_id, badge_type) prevents duplicate awards
- Stores icon type and earned timestamp

#### `chat_history`
Conversation logs between user and AI agents.
- Foreign key to `users` and `learning_plans`
- Stores role (user/model), content, and optional images
- Enables session replay and analytics

## Security

### Row Level Security (RLS)

All tables have RLS enabled with strict policies:

- Users can only SELECT/INSERT/UPDATE their own data
- `day_plans` access controlled through parent `learning_plans` ownership
- Badge insertion restricted to authenticated users for their own account
- Chat history fully isolated per user

### Authentication Flow

1. User signs up via Supabase Auth (email/password)
2. Profile created in `users` table with matching ID
3. Stats record initialized in `user_stats`
4. All subsequent operations authenticated via JWT

## Database Service Layer

The `DatabaseService` class (`services/dbService.ts`) provides type-safe methods:

- `getCurrentUser()` - Get authenticated user
- `getUserProfile()` - Fetch complete profile with stats and badges
- `saveLearningPlan()` - Save generated curriculum
- `updateDayPlan()` - Mark days completed
- `updateUserStats()` - Update streak and points
- `addBadge()` - Award achievements

## Migration from localStorage

The app still checks localStorage on first load but prioritizes database data when a user is authenticated. To migrate existing users:

1. User signs in/up
2. If localStorage data exists, prompt to import
3. Save localStorage state to database
4. Clear localStorage cache

## Environment Variables

Required in `.env`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
API_KEY=your-gemini-api-key
```

## Performance Optimizations

- **Indexes** on foreign keys for fast joins
- **Batch inserts** for day_plans (30 rows at once)
- **Selective queries** using `.maybeSingle()` to avoid errors
- **Upsert operations** for idempotent stats updates

## Future Enhancements

1. Real-time subscriptions for collaborative features
2. Analytics dashboard using aggregated chat_history
3. Progress sharing via public view policies
4. Backup/export functionality
5. Migration tool for bulk localStorage imports

import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

export interface TikBoostUser {
  id: string;
  email: string;
  tiktokUsername: string;
  stars: number;
  totalStarsEarned: number;
  loginStreak: number;
  lastLoginAt: string | null;
  isVIP: boolean;
  isAdmin: boolean;
  vipExpiresAt: string | null;
  referralCode: string;
  completedTaskIds: string[];
  activeBoosts: ActiveBoost[];
  subscriptionTier: string | null;   // 'free' | 'pro' | 'elite'
  starMultiplier: number;             // from subscription_plans.star_multiplier
  boostMultiplier: number;            // from subscription_plans.boost_multiplier
}

export interface ActiveBoost {
  id: string;
  packageId: string;
  label: string;
  reach: string;
  expiresAt: string;
  progress: number;
}

export interface StarTransaction {
  id: string;
  userId: string;
  type: 'earn' | 'spend';
  amount: number;
  description: string;
  category: string;
  createdAt: string;
}

export interface BoostOrder {
  id: string;
  userId: string;
  packageId: string;
  label: string;
  boostType: string;
  reach: string;
  starsSent: number;
  status: 'active' | 'completed' | 'pending';
  progress: number;
  videoUrl?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface LeaderboardUser {
  id: string;
  tiktokUsername: string;
  stars: number;
  totalStarsEarned: number;
  isVIP: boolean;
  loginStreak: number;
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function mapProfile(row: any, planRow?: any): TikBoostUser {
  // Derive multipliers from subscription plan row (or defaults)
  const starMultiplier = planRow?.star_multiplier ?? (row.is_vip ? 1.5 : 1.0);
  const boostMultiplier = planRow?.boost_multiplier ?? (row.is_vip ? 1.5 : 1.0);
  return {
    id: row.id,
    email: row.email || '',
    tiktokUsername: row.tiktok_username || '',
    stars: row.stars || 0,
    totalStarsEarned: row.total_stars_earned || 0,
    loginStreak: row.login_streak || 0,
    lastLoginAt: row.last_login_at || null,
    isVIP: row.is_vip || false,
    isAdmin: row.is_admin || false,
    vipExpiresAt: row.vip_expires_at || null,
    referralCode: row.referral_code || '',
    completedTaskIds: row.completed_task_ids || [],
    activeBoosts: (row.active_boosts || []) as ActiveBoost[],
    subscriptionTier: row.subscription_tier || null,
    starMultiplier,
    boostMultiplier,
  };
}

// Auth
export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function signUpWithPassword(email: string, password: string, tiktokUsername: string, referralCode?: string) {
  // Pass all extra data as metadata — the handle_new_user trigger will read it
  // and create the profile server-side using the service role, avoiding RLS issues
  // during the pre-confirmation window.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        tiktok_username: tiktokUsername,
        referral_code: referralCode ? referralCode.toUpperCase() : '',
      },
    },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Signup failed');
  return data.user;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Profile
export async function loadProfile(userId: string): Promise<TikBoostUser | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) return null;

  // Load subscription plan for multipliers
  let planRow: any = null;
  if (data.subscription_tier) {
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('star_multiplier, boost_multiplier')
      .eq('id', data.subscription_tier)
      .maybeSingle();
    planRow = plan;
  }

  return mapProfile(data, planRow);
}

export async function updateProfile(userId: string, updates: Record<string, any>) {
  const { error } = await supabase.from('user_profiles').update(updates).eq('id', userId);
  if (error) throw new Error(error.message);
}

// Stars
export async function earnStars(userId: string, amount: number, description: string, category: string) {
  // Fetch current stars
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('stars, total_stars_earned')
    .eq('id', userId)
    .single();
  if (!profile) throw new Error('Profile not found');

  const newStars = (profile.stars || 0) + amount;
  const newTotal = (profile.total_stars_earned || 0) + amount;

  await supabase.from('user_profiles').update({
    stars: newStars,
    total_stars_earned: newTotal,
  }).eq('id', userId);

  await supabase.from('star_transactions').insert({
    user_id: userId,
    type: 'earn',
    amount,
    description,
    category,
  });

  return { stars: newStars, totalStarsEarned: newTotal };
}

export async function spendStarsDB(userId: string, amount: number, description: string, category: string) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('stars')
    .eq('id', userId)
    .single();
  if (!profile || (profile.stars || 0) < amount) return false;

  const newStars = (profile.stars || 0) - amount;
  await supabase.from('user_profiles').update({ stars: newStars }).eq('id', userId);

  await supabase.from('star_transactions').insert({
    user_id: userId,
    type: 'spend',
    amount,
    description,
    category,
  });
  return true;
}

export async function markTaskCompleteDB(userId: string, taskId: string, currentIds: string[]) {
  const newIds = [...new Set([...currentIds, taskId])];
  await supabase.from('user_profiles').update({ completed_task_ids: newIds }).eq('id', userId);
  return newIds;
}

export async function updateActiveBoosts(userId: string, boosts: ActiveBoost[]) {
  await supabase.from('user_profiles').update({ active_boosts: boosts }).eq('id', userId);
}

// Transactions
export async function fetchTransactions(userId: string, limit = 50): Promise<StarTransaction[]> {
  const { data, error } = await supabase
    .from('star_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amount: row.amount,
    description: row.description,
    category: row.category,
    createdAt: row.created_at,
  }));
}

// Boost Orders
export async function createBoostOrder(
  userId: string,
  order: {
    packageId: string;
    label: string;
    boostType: string;
    reach: string;
    starsSent: number;
    videoUrl?: string;
    expiresAt?: string;
  }
): Promise<string> {
  const { data, error } = await supabase.from('boost_orders').insert({
    user_id: userId,
    package_id: order.packageId,
    label: order.label,
    boost_type: order.boostType,
    reach: order.reach,
    stars_spent: order.starsSent,
    status: 'active',
    progress: 0,
    video_url: order.videoUrl || null,
    expires_at: order.expiresAt || null,
  }).select('id').single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function fetchBoostOrders(userId: string): Promise<BoostOrder[]> {
  const { data, error } = await supabase
    .from('boost_orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    packageId: row.package_id,
    label: row.label,
    boostType: row.boost_type,
    reach: row.reach,
    starsSent: row.stars_spent,
    status: row.status,
    progress: row.progress,
    videoUrl: row.video_url,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

// Notifications
export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    type: row.type,
    isRead: row.is_read,
    createdAt: row.created_at,
  }));
}

export async function insertNotification(userId: string, title: string, body: string, type: string) {
  const { data, error } = await supabase.from('notifications').insert({
    user_id: userId,
    title,
    body,
    type,
    is_read: false,
  }).select('*').single();
  if (error) return null;
  return {
    id: data.id,
    userId: data.user_id,
    title: data.title,
    body: data.body,
    type: data.type,
    isRead: data.is_read,
    createdAt: data.created_at,
  } as AppNotification;
}

export async function markNotificationReadDB(notificationId: string) {
  await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
}

export async function markAllNotificationsReadDB(userId: string) {
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
}

// Leaderboard
export async function fetchLeaderboard(period: 'weekly' | 'alltime' = 'alltime', limit = 50): Promise<LeaderboardUser[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, tiktok_username, stars, total_stars_earned, is_vip, login_streak')
    .not('tiktok_username', 'is', null)
    .neq('tiktok_username', '')
    .order(period === 'alltime' ? 'total_stars_earned' : 'stars', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    tiktokUsername: row.tiktok_username || 'anonymous',
    stars: row.stars || 0,
    totalStarsEarned: row.total_stars_earned || 0,
    isVIP: row.is_vip || false,
    loginStreak: row.login_streak || 0,
  }));
}

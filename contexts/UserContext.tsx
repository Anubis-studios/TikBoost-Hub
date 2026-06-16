import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { getSupabaseClient } from '@/template';
import {
  TikBoostUser,
  ActiveBoost,
  AppNotification,
  signInWithPassword,
  signUpWithPassword,
  signOut as signOutDB,
  loadProfile,
  updateProfile,
  earnStars,
  spendStarsDB,
  markTaskCompleteDB,
  updateActiveBoosts,
  fetchNotifications,
  insertNotification,
  markNotificationReadDB,
  markAllNotificationsReadDB,
  createBoostOrder,
} from '@/services/supabaseService';
import {
  requestNotificationPermissions,
  scheduleDailyStreakReminder,
  scheduleBoostCompleteNotification,
  scheduleVIPExpiryWarning,
} from '@/services/notificationService';

const supabase = getSupabaseClient();

export interface UserContextType {
  user: TikBoostUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, tiktokUsername: string, referralCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
  addStars: (amount: number, description?: string, category?: string) => Promise<void>;
  spendStars: (amount: number, description?: string, category?: string) => Promise<boolean>;
  markTaskComplete: (taskId: string) => Promise<void>;
  checkDailyStreak: () => Promise<{ streakContinued: boolean; bonusStars: number }>;
  upgradeVIP: () => Promise<void>;
  activateBoost: (boost: {
    id: string;
    packageId: string;
    label: string;
    reach: string;
    expiresAt: string;
    progress: number;
    videoUrl?: string;
    boostType?: string;
  }) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  addNotification: (title: string, body: string, type?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TikBoostUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const loadNotifications = useCallback(async (userId: string) => {
    const notifs = await fetchNotifications(userId);
    setNotifications(notifs);
  }, []);

  const loadUser = useCallback(async (userId: string) => {
    const profile = await loadProfile(userId);
    if (profile) {
      setUser(profile);
      await loadNotifications(userId);
      // Check VIP expiry and schedule warning notification
      if (profile.isVIP && profile.vipExpiresAt) {
        const expiryDate = new Date(profile.vipExpiresAt);
        const now = new Date();
        const daysLeft = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysLeft > 0 && daysLeft <= 7) {
          await scheduleVIPExpiryWarning(expiryDate).catch(() => {});
        }
      }
    }
  }, [loadNotifications]);

  const startPolling = useCallback((userId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      loadNotifications(userId);
    }, 60000);
  }, [loadNotifications]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && mounted) {
        await loadUser(session.user.id);
        startPolling(session.user.id);
        await requestNotificationPermissions();
        await scheduleDailyStreakReminder();
      }
      if (mounted) setIsLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_IN' && session?.user) {
        await loadUser(session.user.id);
        startPolling(session.user.id);
        await requestNotificationPermissions();
        await scheduleDailyStreakReminder();
        setIsLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setNotifications([]);
        stopPolling();
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      stopPolling();
      listener.subscription.unsubscribe();
    };
  }, [loadUser, startPolling, stopPolling]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithPassword(email, password);
    // onAuthStateChange handles the rest
  }, []);

  const signUp = useCallback(async (email: string, password: string, tiktokUsername: string, referralCode?: string) => {
    await signUpWithPassword(email, password, tiktokUsername, referralCode);
    // onAuthStateChange handles the rest
  }, []);

  const signOut = useCallback(async () => {
    await signOutDB();
  }, []);

  const addStars = useCallback(async (amount: number, description = 'Stars earned', category = 'task') => {
    if (!user) return;
    const result = await earnStars(user.id, amount, description, category);
    setUser((prev) => prev ? { ...prev, stars: result.stars, totalStarsEarned: result.totalStarsEarned } : prev);
  }, [user]);

  const spendStars = useCallback(async (amount: number, description = 'Stars spent', category = 'boost'): Promise<boolean> => {
    if (!user) return false;
    const success = await spendStarsDB(user.id, amount, description, category);
    if (success) {
      setUser((prev) => prev ? { ...prev, stars: prev.stars - amount } : prev);
    }
    return success;
  }, [user]);

  const markTaskComplete = useCallback(async (taskId: string) => {
    if (!user) return;
    const newIds = await markTaskCompleteDB(user.id, taskId, user.completedTaskIds);
    setUser((prev) => prev ? { ...prev, completedTaskIds: newIds } : prev);
  }, [user]);

  const checkDailyStreak = useCallback(async (): Promise<{ streakContinued: boolean; bonusStars: number }> => {
    if (!user) return { streakContinued: false, bonusStars: 0 };

    const now = new Date();
    const lastLogin = user.lastLoginAt ? new Date(user.lastLoginAt) : null;

    if (lastLogin) {
      const diffHours = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60);
      if (diffHours < 20) return { streakContinued: false, bonusStars: 0 };
    }

    const diffDays = lastLogin ? (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24) : 2;
    const streakContinued = diffDays < 48;
    const newStreak = streakContinued ? user.loginStreak + 1 : 1;
    const bonusStars = Math.min(newStreak * 25, 300);

    await updateProfile(user.id, {
      login_streak: newStreak,
      last_login_at: now.toISOString(),
    });

    const result = await earnStars(user.id, bonusStars, `Day ${newStreak} streak bonus`, 'streak');

    setUser((prev) => prev ? {
      ...prev,
      loginStreak: newStreak,
      lastLoginAt: now.toISOString(),
      stars: result.stars,
      totalStarsEarned: result.totalStarsEarned,
    } : prev);

    return { streakContinued, bonusStars };
  }, [user]);

  const upgradeVIP = useCallback(async () => {
    if (!user) return;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await updateProfile(user.id, {
      is_vip: true,
      vip_expires_at: expiresAt.toISOString(),
    });

    const result = await earnStars(user.id, 500, 'VIP activation bonus', 'vip');

    await insertNotification(user.id, 'VIP Activated!', 'You now have VIP status for 30 days. Enjoy 2x stars and priority boost!', 'vip');

    setUser((prev) => prev ? {
      ...prev,
      isVIP: true,
      vipExpiresAt: expiresAt.toISOString(),
      stars: result.stars,
      totalStarsEarned: result.totalStarsEarned,
    } : prev);

    await loadNotifications(user.id);
  }, [user, loadNotifications]);

  const activateBoost = useCallback(async (boost: {
    id: string;
    packageId: string;
    label: string;
    reach: string;
    expiresAt: string;
    progress: number;
    videoUrl?: string;
    boostType?: string;
  }) => {
    if (!user) return;

    await createBoostOrder(user.id, {
      packageId: boost.packageId,
      label: boost.label,
      boostType: boost.boostType || 'video',
      reach: boost.reach,
      starsSent: 0,
      videoUrl: boost.videoUrl,
      expiresAt: boost.expiresAt,
    });

    const activeBoost: ActiveBoost = {
      id: boost.id,
      packageId: boost.packageId,
      label: boost.label,
      reach: boost.reach,
      expiresAt: boost.expiresAt,
      progress: 0,
    };

    const newBoosts = [...user.activeBoosts, activeBoost];
    await updateActiveBoosts(user.id, newBoosts);
    setUser((prev) => prev ? { ...prev, activeBoosts: newBoosts } : prev);

    const hours = parseInt(boost.expiresAt) || 24;
    await scheduleBoostCompleteNotification(boost.label, hours);

    const notif = await insertNotification(user.id, 'Boost Activated!', `Your "${boost.label}" boost is now live and reaching ${boost.reach} users.`, 'boost');
    if (notif) setNotifications((prev) => [notif, ...prev]);
  }, [user]);

  const addNotification = useCallback(async (title: string, body: string, type = 'general') => {
    if (!user) return;
    const notif = await insertNotification(user.id, title, body, type);
    if (notif) setNotifications((prev) => [notif, ...prev]);
  }, [user]);

  const markNotificationRead = useCallback(async (id: string) => {
    await markNotificationReadDB(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    if (!user) return;
    await markAllNotificationsReadDB(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, [user]);

  const refreshUser = useCallback(async () => {
    if (!user) return;
    await loadUser(user.id);
  }, [user, loadUser]);

  return (
    <UserContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      notifications,
      unreadCount,
      signIn,
      signUp,
      signOut,
      addStars,
      spendStars,
      markTaskComplete,
      checkDailyStreak,
      upgradeVIP,
      activateBoost,
      addNotification,
      markNotificationRead,
      markAllNotificationsRead,
      refreshUser,
    }}>
      {children}
    </UserContext.Provider>
  );
}

'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { AuthApiError } from '@supabase/supabase-js';
import { apiService, User, isApiNetworkError } from '@/lib/api';
import { humanizeIdentifier } from '@/lib/names';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { clearSupabaseAuthStorage } from '@/lib/supabaseStorage';
import { clearAuthCookies } from '@/lib/auth/cookies';

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  createUser: (userData: { email: string; full_name: string; profile_picture_url?: string }) => Promise<User>;
  updateUser: (userData: {
    full_name?: string;
    profile_picture_url?: string;
    role?: string;
    plan_tier?: string | null;
    personalization_nickname?: string | null;
    personalization_occupation?: string | null;
    personalization_about?: string | null;
    personalization_custom_instructions?: string | null;
    personalization_system_prompt_override?: string | null;
    personalization_show_calendar?: boolean;
    maps_enabled?: boolean;
    has_seen_general_chat?: boolean;
  }) => Promise<void>;
  refreshUser: () => Promise<void>;
  waitForUser: () => Promise<User | null>;
  deleteUserAccount: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
  userEmail?: string;
}

const USER_CACHE_KEY_PREFIX = 'gray-user-cache:';
const USER_CACHE_VERSION = 1;
const USER_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 12;

const isMissingUserError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const maybeStatus = typeof (error as { status?: number }).status === 'number'
    ? (error as { status: number }).status
    : null;
  if (maybeStatus && (maybeStatus === 404 || maybeStatus === 422)) {
    return true;
  }
  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();
    return (
      normalized.includes('user not found') ||
      normalized.includes('failed to fetch user') ||
      normalized.includes('validation error') ||
      normalized.includes('422')
    );
  }
  return false;
};

type CachedUserPayload = {
  version: number;
  timestamp: number;
  user: User;
};

const sanitizeCachedUser = (value: unknown): { user: User; timestamp: number } | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const payload = value as Partial<CachedUserPayload>;

  if (payload.version !== USER_CACHE_VERSION) {
    return null;
  }

  if (typeof payload.timestamp !== 'number' || !Number.isFinite(payload.timestamp)) {
    return null;
  }

  const userValue = payload.user;
  if (!userValue || typeof userValue !== 'object') {
    return null;
  }
  const raw = userValue as Partial<User>;

  if (typeof raw.id !== 'number' || !Number.isFinite(raw.id)) {
    return null;
  }
  if (typeof raw.email !== 'string' || raw.email.trim().length === 0) {
    return null;
  }
  if (typeof raw.full_name !== 'string' || raw.full_name.trim().length === 0) {
    return null;
  }

  const user: User = {
    id: raw.id,
    email: raw.email,
    full_name: raw.full_name,
    profile_picture_url:
      typeof raw.profile_picture_url === 'string' && raw.profile_picture_url.trim().length > 0
        ? raw.profile_picture_url
        : undefined,
    role: typeof raw.role === 'string' && raw.role.trim().length > 0 ? raw.role : 'user',
    initials: typeof raw.initials === 'string' && raw.initials.trim().length > 0 ? raw.initials : 'OP',
    workspace_background_id:
      typeof raw.workspace_background_id === 'string' && raw.workspace_background_id.length > 0
        ? raw.workspace_background_id
        : null,
    maps_enabled: typeof raw.maps_enabled === 'boolean' ? raw.maps_enabled : false,
    personalization_nickname:
      typeof raw.personalization_nickname === 'string' && raw.personalization_nickname.length > 0
        ? raw.personalization_nickname
        : null,
    personalization_occupation:
      typeof raw.personalization_occupation === 'string' && raw.personalization_occupation.length > 0
        ? raw.personalization_occupation
        : null,
    personalization_about:
      typeof raw.personalization_about === 'string' && raw.personalization_about.length > 0
        ? raw.personalization_about
        : null,
    personalization_custom_instructions:
      typeof raw.personalization_custom_instructions === 'string' &&
        raw.personalization_custom_instructions.length > 0
        ? raw.personalization_custom_instructions
        : null,
    personalization_system_prompt_override:
      typeof raw.personalization_system_prompt_override === 'string' &&
        raw.personalization_system_prompt_override.length > 0
        ? raw.personalization_system_prompt_override
        : null,
    personalization_show_calendar:
      typeof raw.personalization_show_calendar === 'boolean' ? raw.personalization_show_calendar : true,
    created_at:
      typeof raw.created_at === 'string' && raw.created_at.trim().length > 0
        ? raw.created_at
        : new Date(payload.timestamp).toISOString(),
    updated_at:
      typeof raw.updated_at === 'string' && raw.updated_at.trim().length > 0
        ? raw.updated_at
        : new Date(payload.timestamp).toISOString(),
  };

  return { user, timestamp: payload.timestamp };
};

const getUserCacheKey = (email: string) => `${USER_CACHE_KEY_PREFIX}${email.toLowerCase()}`;

const readCachedUser = (_email?: string | null): { user: User; timestamp: number } | null => null;

const persistCachedUser = (_email: string, _user: User) => {
  // User profile caching is now handled exclusively by the backend.
};

const removeCachedUser = (_email?: string | null) => {
  // No-op: user cache is not stored in browser storage anymore.
};

const touchDailyStreakOnce = (userId: number) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `gray-streak-last-touch:${userId}`;
    const last = window.localStorage.getItem(storageKey);
    if (last === todayKey) {
      return;
    }
    window.localStorage.setItem(storageKey, todayKey);
    void apiService.touchUserStreak(userId).catch(() => undefined);
  } catch {
    // If localStorage or the API fails, silently skip; streaks are non-critical.
  }
};

export function UserProvider({ children, userEmail }: UserProviderProps) {
  const cachedUser = useMemo(() => readCachedUser(userEmail ?? null)?.user ?? null, [userEmail]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(userEmail));
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const activeRequestIdRef = useRef(0);
  const pendingUserResolversRef = useRef<Set<(value: User | null) => void>>(new Set());

  const deriveNameFromEmail = (email: string) => humanizeIdentifier(email) ?? 'Operator';

  const fetchSupabaseProfile = async (): Promise<{ fullName: string | null; avatarUrl: string | null; planTier: string | null } | null> => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return null;
      }



      const { data, error: supabaseError } = await supabase.auth.getUser();
      if (supabaseError) {
        if (
          supabaseError instanceof AuthApiError &&
          typeof supabaseError.message === 'string' &&
          supabaseError.message.toLowerCase().includes('invalid refresh token')
        ) {
          clearSupabaseAuthStorage();
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {
            // Ignore sign out errors; the storage is already cleared
          }
          return null;
        }
        throw supabaseError;
      }

      const authUser = data?.user;
      if (!authUser) {
        return null;
      }

      const metadata = (authUser.user_metadata ?? {}) as Record<string, unknown>;
      const nameCandidates = [
        metadata.full_name,
        metadata.name,
        metadata.preferred_username,
        metadata.user_name,
        metadata.username,
        metadata.nickname,
        metadata.display_name,
        metadata.given_name && metadata.family_name
          ? `${metadata.given_name as string} ${metadata.family_name as string}`.trim()
          : undefined,
      ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

      const fullName =
        nameCandidates[0]?.trim() ?? (authUser.email ? deriveNameFromEmail(authUser.email) : null);

      const avatarUrlCandidate = [
        metadata.avatar_url,
        metadata.picture,
        metadata.avatar,
        metadata.image,
      ].find((value) => typeof value === 'string' && value.trim().length > 0) as string | undefined;

      // Normalize Supabase/Discord avatar URLs so they are absolute and usable by the browser.
      let normalizedAvatarUrl: string | null = avatarUrlCandidate ?? null;
      if (normalizedAvatarUrl) {
        try {
          const lower = normalizedAvatarUrl.toLowerCase();
          const looksAbsolute = lower.startsWith('http://') || lower.startsWith('https://');
          const isDataUrl = lower.startsWith('data:');
          if (!looksAbsolute && !isDataUrl) {
            // Some providers (or custom extensions) may store a relative Supabase
            // storage path (e.g. `/storage/v1/object/public/avatars/...`). Prefer
            // resolving those against the Supabase base URL so avatar URLs point
            // at the actual storage bucket instead of the app origin.
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
            if (supabaseUrl && normalizedAvatarUrl.startsWith('/')) {
              normalizedAvatarUrl = new URL(normalizedAvatarUrl, supabaseUrl).toString();
            } else if (typeof window !== 'undefined') {
              normalizedAvatarUrl = new URL(normalizedAvatarUrl, window.location.origin).toString();
            }
          }
        } catch {
          // If normalization fails, fall back to the raw value.
          normalizedAvatarUrl = avatarUrlCandidate ?? null;
        }
      }

      const planTierRaw = (metadata.plan_tier ?? metadata.planTier) as unknown;
      const planTier =
        typeof planTierRaw === 'string' && planTierRaw.trim().length > 0
          ? planTierRaw.trim().toLowerCase()
          : null;

      return {
        fullName: fullName ?? null,
        avatarUrl: normalizedAvatarUrl,
        planTier,
      };
    } catch (supabaseError) {
      // Avoid crashing the UI when Supabase is not configured.
      if (process.env.NODE_ENV !== 'production') {
        // Use log instead of warn to avoid triggering error overlays for non-critical failures
        console.log('Supabase profile lookup failed (non-critical):', supabaseError);
      }
      return null;
    }
  };

  const loadUser = async (email: string, options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    const requestId = ++activeRequestIdRef.current;
    const isStale = () => !isMountedRef.current || activeRequestIdRef.current !== requestId;

    try {
      if (!silent && !isStale()) {
        setLoading(true);
      }
      if (!isStale()) {
        setError(null);
      }

      console.log('loadUser: Starting to load user with email:', email);

      // CRITICAL FIX: Explicitly check the session token.
      // fetchSupabaseProfile uses getUser() which might return a user even if the session is stale/refreshing.
      // We need to ensure we have a valid access token for API calls.
      const supabase = getSupabaseClient(); // Ensure supabase client is available for getSession()
      if (!supabase) {
        console.warn('[v2] loadUser: Supabase client not available. Aborting.');
        if (!isStale()) {
          setUser(null);
          // Ensure any stale auth state is cleared so server and client stay in sync.
          clearSupabaseAuthStorage();
          clearAuthCookies();
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session || !session.access_token) {
        console.warn('[v2] loadUser: No valid session token found. Aborting and clearing auth.');
        if (!isStale()) {
          setUser(null);
          // Keep Supabase + Gray session cookies aligned: if the token is gone, treat the
          // user as logged out everywhere so they aren't stuck in a half-logged-in state.
          clearSupabaseAuthStorage();
          clearAuthCookies();
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }
        return;
      }

      const supabaseProfile = await fetchSupabaseProfile();
      if (isStale()) {
        return;
      }

      if (!supabaseProfile) {
        // Should be covered by session check, but double check
        return;
      }

      const supabaseName = supabaseProfile?.fullName;
      const derivedName = deriveNameFromEmail(email);
      const preferredName = supabaseName ?? derivedName;
      const preferredAvatar = supabaseProfile?.avatarUrl ?? undefined;
      const preferredPlanTier = supabaseProfile?.planTier ?? null;

      console.log('loadUser: Preferred name:', preferredName, 'Avatar:', preferredAvatar);

      try {
        console.log('loadUser: Attempting to get user by email from API...');
        const userData = await apiService.getUserByEmail(email);
        if (isStale()) {
          return;
        }
        console.log('loadUser: User data retrieved:', userData);

        const updates: { full_name?: string; profile_picture_url?: string; plan_tier?: string | null } = {};

        // Only update name if:
        // 1. We have a name from Supabase (authoritative source)
        // 2. OR the current user has no name (we are filling a gap)
        // 3. AND the new name is different
        const shouldUpdateName =
          preferredName &&
          preferredName !== userData.full_name &&
          (supabaseName || !userData.full_name || userData.full_name.trim() === '');

        if (shouldUpdateName) {
          updates.full_name = preferredName;
        }
        if (preferredAvatar && preferredAvatar !== userData.profile_picture_url) {
          updates.profile_picture_url = preferredAvatar;
        }
        if (preferredPlanTier && preferredPlanTier !== (userData.plan_tier ?? null)) {
          updates.plan_tier = preferredPlanTier;
        }

        if (Object.keys(updates).length > 0) {
          try {
            console.log('loadUser: Updating user profile with:', updates);
            const updatedUser = await apiService.updateUser(userData.id, updates);
            if (isStale()) {
              return;
            }
            const hydratedUser = {
              ...updatedUser,
              profile_picture_url: preferredAvatar ?? updatedUser.profile_picture_url ?? null,
            };
            setUser(hydratedUser);
            persistCachedUser(hydratedUser.email, hydratedUser);
            touchDailyStreakOnce(hydratedUser.id);
          } catch (updateError) {
            console.debug('[v2] Error updating user profile:', updateError);
            if (!isStale()) {
              const hydratedUserFallback = {
                ...userData,
                profile_picture_url: preferredAvatar ?? userData.profile_picture_url ?? null,
              };
              setUser(hydratedUserFallback);
              persistCachedUser(hydratedUserFallback.email, hydratedUserFallback);
              touchDailyStreakOnce(hydratedUserFallback.id);
            }
          }
        } else {
          if (!isStale()) {
            const hydratedUser = {
              ...userData,
              profile_picture_url: preferredAvatar ?? userData.profile_picture_url ?? null,
            };
            setUser(hydratedUser);
            persistCachedUser(hydratedUser.email, hydratedUser);
            touchDailyStreakOnce(hydratedUser.id);
          }
        }
      } catch (userError) {
        console.log('[v2] loadUser: Error getting user, checking if user not found...');
        // If user doesn't exist, create them
        if (isMissingUserError(userError)) {
          console.log('[v2] loadUser: User not found, creating new user...');
          const defaultUserData = {
            email,
            full_name: preferredName,
            profile_picture_url: preferredAvatar,
            role: 'user',
            plan_tier: preferredPlanTier,
          };
          const newUser = await apiService.createUser(defaultUserData);
          console.log('[v2] loadUser: New user created:', newUser);
          if (!isStale()) {
            const hydratedUser = {
              ...newUser,
              profile_picture_url: preferredAvatar ?? newUser.profile_picture_url ?? null,
            };
            setUser(hydratedUser);
            persistCachedUser(hydratedUser.email, hydratedUser);
            touchDailyStreakOnce(hydratedUser.id);
          }
        } else {
          console.debug('[v2] loadUser: Unexpected error getting user:', userError);
          throw userError;
        }
      }
    } catch (err) {
      if (!isStale()) {
        setError(err instanceof Error ? err.message : 'Failed to load user');
      }
      const shouldSkipLog = isApiNetworkError(err);
      if (!shouldSkipLog) {
        console.debug('[v2] Error loading user:', err);
      } else if (process.env.NODE_ENV !== 'production') {
        console.debug('[v2] API unreachable while loading user profile:', err);
      }
    } finally {
      if (!silent && !isStale()) {
        setLoading(false);
      }
    }
  };

  const createUser = async (userData: { email: string; full_name: string; profile_picture_url?: string }) => {
    try {
      const newUser = await apiService.createUser(userData);
      setUser(newUser);
      persistCachedUser(newUser.email, newUser);
      return newUser;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create user';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const updateUser = async (userData: {
    full_name?: string;
    profile_picture_url?: string;
    role?: string;
    plan_tier?: string | null;
    personalization_nickname?: string | null;
    personalization_occupation?: string | null;
    personalization_about?: string | null;
    personalization_custom_instructions?: string | null;
    personalization_system_prompt_override?: string | null;
    personalization_show_calendar?: boolean;
    maps_enabled?: boolean;
    has_seen_general_chat?: boolean;
  }) => {
    if (!user) throw new Error('No user logged in');

    // Build a sanitized payload restricted to fields the backend schema knows.
    const payload: {
      full_name?: string;
      profile_picture_url?: string;
      role?: string;
      plan_tier?: string | null;
      personalization_nickname?: string | null;
      personalization_occupation?: string | null;
      personalization_about?: string | null;
      personalization_custom_instructions?: string | null;
      personalization_system_prompt_override?: string | null;
      personalization_show_calendar?: boolean;
      maps_enabled?: boolean;
      has_seen_general_chat?: boolean;
    } = {};

    if (typeof userData.full_name === 'string') {
      payload.full_name = userData.full_name;
    }
    if (typeof userData.profile_picture_url === 'string') {
      payload.profile_picture_url = userData.profile_picture_url;
    }
    if (typeof userData.role === 'string') {
      payload.role = userData.role;
    }
    if (Object.prototype.hasOwnProperty.call(userData, 'plan_tier')) {
      payload.plan_tier = userData.plan_tier ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(userData, 'personalization_nickname')) {
      payload.personalization_nickname = userData.personalization_nickname ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(userData, 'personalization_occupation')) {
      payload.personalization_occupation = userData.personalization_occupation ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(userData, 'personalization_about')) {
      payload.personalization_about = userData.personalization_about ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(userData, 'personalization_custom_instructions')) {
      payload.personalization_custom_instructions =
        userData.personalization_custom_instructions ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(userData, 'personalization_system_prompt_override')) {
      payload.personalization_system_prompt_override =
        userData.personalization_system_prompt_override ?? null;
    }
    if (typeof userData.maps_enabled === 'boolean') {
      payload.maps_enabled = userData.maps_enabled;
    }
    if (typeof userData.personalization_show_calendar === 'boolean') {
      payload.personalization_show_calendar = userData.personalization_show_calendar;
    }
    if (typeof userData.has_seen_general_chat === 'boolean') {
      payload.has_seen_general_chat = userData.has_seen_general_chat;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    try {
      const updatedUser = await apiService.updateUser(user.id, payload);

      // Ensure local state reflects latest profile so viewerName and panel baselines
      // immediately pick up nickname / full_name changes.
      setUser(updatedUser);
      persistCachedUser(updatedUser.email, updatedUser);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update user';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const refreshUser = async () => {
    if (!user) return;

    try {
      const updatedUser = await apiService.getUser(user.id);
      setUser(updatedUser);
      persistCachedUser(updatedUser.email, updatedUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh user');
    }
  };

  const deleteUserAccount = async () => {
    if (!user) {
      throw new Error('No user logged in');
    }

    try {
      await apiService.deleteUser(user.id);
      const supabaseClient = getSupabaseClient();
      if (supabaseClient) {
        try {
          await supabaseClient.auth.signOut({ scope: 'global' });
        } catch (supabaseError) {
          console.warn('Failed to sign out after account deletion:', supabaseError);
        }
      }
      clearAuthCookies();
      clearSupabaseAuthStorage();
      removeCachedUser(user.email);
      setUser(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete user account';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const waitForUser = useCallback((): Promise<User | null> => {
    if (user) {
      return Promise.resolve(user);
    }
    if (!loading) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      pendingUserResolversRef.current.add(resolve);
    });
  }, [loading, user]);

  useEffect(() => {
    if (user || !loading) {
      const pending = Array.from(pendingUserResolversRef.current);
      pendingUserResolversRef.current.clear();
      pending.forEach((resolve) => resolve(user ?? null));
    }
  }, [loading, user]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      const pending = Array.from(pendingUserResolversRef.current);
      pendingUserResolversRef.current.clear();
      pending.forEach((resolve) => resolve(null));
    };
  }, []);

  useEffect(() => {
    if (userEmail) {
      console.log('[v2] UserContext: Loading user with email:', userEmail);
      loadUser(userEmail, { silent: Boolean(user) }).catch((err) => {
        if (isApiNetworkError(err)) {
          if (process.env.NODE_ENV !== 'production') {
            console.debug('[v2] User profile API unreachable while bootstrapping:', err);
          }
          return;
        }
        console.debug('[v2] Failed to load user profile:', err);
        console.debug('[v2] User load error details:', err);
      });
    } else {
      console.log('[v2] UserContext: No userEmail provided');
      setUser(null);
      setLoading(false);
      removeCachedUser(null);
    }
  }, [userEmail]);

  useEffect(() => {
    if (user && userEmail) {
      persistCachedUser(userEmail, user);
    }
  }, [user, userEmail]);

  const value: UserContextType = {
    user,
    waitForUser,
    loading,
    error,
    createUser,
    updateUser,
    refreshUser,
    deleteUserAccount,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

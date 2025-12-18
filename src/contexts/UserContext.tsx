'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { AuthApiError } from '@supabase/supabase-js';
import { userService, isApiNetworkError, type User, type UserUpdate } from '@/lib/api';
import { humanizeIdentifier } from '@/lib/names';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { clearSupabaseAuthStorage } from '@/lib/supabaseStorage';
import { clearAuthCookies } from '@/lib/auth/cookies';

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  createUser: (userData: { email: string; full_name: string; profile_picture_url?: string }) => Promise<User>;
  updateUser: (userData: UserUpdate) => Promise<void>;
  refreshUser: () => Promise<void>;
  waitForUser: () => Promise<User | null>;
  deleteUserAccount: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
  userEmail?: string;
}

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

const deriveNameFromEmail = (email: string) => humanizeIdentifier(email) ?? 'Operator';

export function UserProvider({ children, userEmail }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(userEmail));
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const activeRequestIdRef = useRef(0);
  const pendingUserResolversRef = useRef<Set<(value: User | null) => void>>(new Set());
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const fetchSupabaseProfile = useCallback(async (): Promise<{ fullName: string | null; avatarUrl: string | null; planTier: string | null } | null> => {
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
  }, []);

  const loadUser = useCallback(async (email: string, options?: { silent?: boolean }) => {
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

      // console.log('loadUser: Starting to load user with email:', email);

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

      // console.log('loadUser: Preferred name:', preferredName, 'Avatar:', preferredAvatar);

      try {
        // console.log('loadUser: Attempting to get user by email from API...');
        const userData = await userService.getUserByEmail(email);
        if (isStale()) {
          return;
        }
        // console.log('loadUser: User data retrieved:', userData);

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
            // console.log('loadUser: Updating user profile with:', updates);
            const updatedUser = await userService.updateUser(userData.id, updates);
            if (isStale()) {
              return;
            }
            const hydratedUser = {
              ...updatedUser,
              profile_picture_url: preferredAvatar ?? updatedUser.profile_picture_url ?? null,
            };
            setUser(hydratedUser);
          } catch (updateError) {
            console.debug('[v2] Error updating user profile:', updateError);
            if (!isStale()) {
              const hydratedUserFallback = {
                ...userData,
                profile_picture_url: preferredAvatar ?? userData.profile_picture_url ?? null,
              };
              setUser(hydratedUserFallback);
            }
          }
        } else {
          if (!isStale()) {
            const hydratedUser = {
              ...userData,
              profile_picture_url: preferredAvatar ?? userData.profile_picture_url ?? null,
            };
            setUser(hydratedUser);
          }
        }
      } catch (userError) {
        // console.log('[v2] loadUser: Error getting user, checking if user not found...');
        // If user doesn't exist, create them
        if (isMissingUserError(userError)) {
          // console.log('[v2] loadUser: User not found, creating new user...');
          const defaultUserData = {
            email,
            full_name: preferredName,
            profile_picture_url: preferredAvatar,
            role: 'user',
            plan_tier: preferredPlanTier,
          };
          const newUser = await userService.createUser(defaultUserData);
          // console.log('[v2] loadUser: New user created:', newUser);
          if (!isStale()) {
            const hydratedUser = {
              ...newUser,
              profile_picture_url: preferredAvatar ?? newUser.profile_picture_url ?? null,
            };
            setUser(hydratedUser);
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
  }, [fetchSupabaseProfile]);

  const createUser = async (userData: { email: string; full_name: string; profile_picture_url?: string }) => {
    try {
      const newUser = await userService.createUser(userData);
      setUser(newUser);
      return newUser;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create user';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const updateUser = async (userData: UserUpdate) => {
    if (!user) throw new Error('No user logged in');

    // Build a sanitized payload restricted to fields the backend schema knows.
    const payload: UserUpdate = {};

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
    if (Object.prototype.hasOwnProperty.call(userData, 'personalization_location')) {
      payload.personalization_location = userData.personalization_location ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(userData, 'personalization_time_zone')) {
      payload.personalization_time_zone = userData.personalization_time_zone ?? null;
    }
    if (typeof userData.maps_enabled === 'boolean') {
      payload.maps_enabled = userData.maps_enabled;
    }
    if (Object.prototype.hasOwnProperty.call(userData, 'preferred_model')) {
      payload.preferred_model = userData.preferred_model ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(userData, 'visible_model_ids')) {
      payload.visible_model_ids = userData.visible_model_ids ?? null;
    }
    if (typeof userData.improve_model_for_everyone === 'boolean') {
      payload.improve_model_for_everyone = userData.improve_model_for_everyone;
    }
    if (typeof userData.has_seen_general_chat === 'boolean') {
      payload.has_seen_general_chat = userData.has_seen_general_chat;
    }
    if (Object.prototype.hasOwnProperty.call(userData, 'workspace_background_id')) {
      payload.workspace_background_id = userData.workspace_background_id ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(userData, 'theme_mode')) {
      payload.theme_mode = userData.theme_mode ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(userData, 'ui_locale')) {
      payload.ui_locale = userData.ui_locale ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(userData, 'preferred_response_language')) {
      payload.preferred_response_language = userData.preferred_response_language ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(userData, 'notification_preferences')) {
      payload.notification_preferences = userData.notification_preferences ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(userData, 'conversation_memory_enabled')) {
      payload.conversation_memory_enabled = userData.conversation_memory_enabled ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(userData, 'auto_web_search_enabled')) {
      payload.auto_web_search_enabled = userData.auto_web_search_enabled ?? null;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    try {
      const updatedUser = await userService.updateUser(user.id, payload);

      // Ensure local state reflects latest profile so viewerName and panel baselines
      // immediately pick up nickname / full_name changes.
      setUser(updatedUser);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update user';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const refreshUser = async () => {
    if (!user) return;

    try {
      const updatedUser = await userService.getUser(user.id);
      setUser(updatedUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh user');
    }
  };

  const deleteUserAccount = async () => {
    if (!user) {
      throw new Error('No user logged in');
    }

    try {
      await userService.deleteUser(user.id);
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
      // Set a safety timeout to prevent hanging forever
      const timeoutId = setTimeout(() => {
        pendingUserResolversRef.current.delete(resolve);
        resolve(null);
      }, 15000);

      const wrapper = (u: User | null) => {
        clearTimeout(timeoutId);
        resolve(u);
      };

      pendingUserResolversRef.current.add(wrapper);
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
    const pendingUserResolvers = pendingUserResolversRef.current;
    return () => {
      isMountedRef.current = false;
      const pending = Array.from(pendingUserResolvers);
      pendingUserResolvers.clear();
      pending.forEach((resolve) => resolve(null));
    };
  }, []);

  useEffect(() => {
    if (userEmail) {
      // console.log('[v2] UserContext: Loading user with email:', userEmail);
      loadUser(userEmail, { silent: Boolean(userRef.current) }).catch((err) => {
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
      // console.log('[v2] UserContext: No userEmail provided');
      setUser(null);
      setLoading(false);
    }
  }, [loadUser, userEmail]);

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

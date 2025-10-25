'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService, User } from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabaseClient';

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  createUser: (userData: { email: string; full_name: string; profile_picture_url?: string }) => Promise<User>;
  updateUser: (userData: { full_name?: string; profile_picture_url?: string; role?: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
  userEmail?: string;
}

export function UserProvider({ children, userEmail }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const deriveNameFromEmail = (email: string) => {
    const localPart = email.split('@')[0] ?? email;
    return localPart
      .split(/[\s._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const fetchSupabaseProfile = async (): Promise<{ fullName: string | null; avatarUrl: string | null } | null> => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return null;
      }

      const { data, error: supabaseError } = await supabase.auth.getUser();
      if (supabaseError) {
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

      return {
        fullName: fullName ?? null,
        avatarUrl: avatarUrlCandidate ?? null,
      };
    } catch (supabaseError) {
      // Avoid crashing the UI when Supabase is not configured.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Supabase profile lookup failed:', supabaseError);
      }
      return null;
    }
  };

  const loadUser = async (email: string) => {
    try {
      setLoading(true);
      setError(null);

      const supabaseProfile = await fetchSupabaseProfile();
      const preferredName = supabaseProfile?.fullName ?? deriveNameFromEmail(email);
      const preferredAvatar = supabaseProfile?.avatarUrl ?? undefined;

      try {
        const userData = await apiService.getUserByEmail(email);

        const updates: { full_name?: string; profile_picture_url?: string } = {};
        if (preferredName && preferredName !== userData.full_name) {
          updates.full_name = preferredName;
        }
        if (preferredAvatar && preferredAvatar !== userData.profile_picture_url) {
          updates.profile_picture_url = preferredAvatar;
        }

        if (Object.keys(updates).length > 0) {
          try {
            const updatedUser = await apiService.updateUser(userData.id, updates);
            setUser(updatedUser);
          } catch (updateError) {
            console.error('Error updating user profile:', updateError);
            setUser(userData);
          }
        } else {
          setUser(userData);
        }
      } catch (userError) {
        // If user doesn't exist, create them
        if (userError instanceof Error && userError.message.includes('User not found')) {
          const defaultUserData = {
            email,
            full_name: preferredName,
            profile_picture_url: preferredAvatar,
            role: 'user',
          };
          const newUser = await apiService.createUser(defaultUserData);
          setUser(newUser);
        } else {
          throw userError;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
      console.error('Error loading user:', err);
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (userData: { email: string; full_name: string; profile_picture_url?: string }) => {
    try {
      const newUser = await apiService.createUser(userData);
      setUser(newUser);
      return newUser;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create user';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const updateUser = async (userData: { full_name?: string; profile_picture_url?: string; role?: string }) => {
    if (!user) throw new Error('No user logged in');

    try {
      const updatedUser = await apiService.updateUser(user.id, userData);
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
      const updatedUser = await apiService.getUser(user.id);
      setUser(updatedUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh user');
    }
  };

  useEffect(() => {
    if (userEmail) {
      loadUser(userEmail);
    } else {
      setLoading(false);
    }
  }, [userEmail]);

  const value: UserContextType = {
    user,
    loading,
    error,
    createUser,
    updateUser,
    refreshUser,
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

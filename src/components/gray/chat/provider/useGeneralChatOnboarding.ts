import { useCallback, useEffect, useRef } from "react";
import type { User, UserUpdate } from "@/lib/api";

type UseGeneralChatOnboardingOptions = {
  user: User | null;
  updateUser: (userData: UserUpdate) => Promise<void>;
};

export const useGeneralChatOnboarding = ({ user, updateUser }: UseGeneralChatOnboardingOptions) => {
  const onboardingSeenRef = useRef(false);

  useEffect(() => {
    if (user?.has_seen_general_chat) {
      onboardingSeenRef.current = true;
    }
  }, [user?.has_seen_general_chat]);

  const markHasSeenGeneralChat = useCallback(async () => {
    if (!user || onboardingSeenRef.current || user.has_seen_general_chat) {
      onboardingSeenRef.current = onboardingSeenRef.current || Boolean(user?.has_seen_general_chat);
      return;
    }

    onboardingSeenRef.current = true;
    try {
      await updateUser({ has_seen_general_chat: true });
    } catch (error) {
      console.error("Failed to mark general chat as seen:", error);
    }
  }, [updateUser, user]);

  return { markHasSeenGeneralChat };
};


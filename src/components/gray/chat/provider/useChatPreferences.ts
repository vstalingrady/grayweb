import { useCallback, useState } from "react";
import type { User, UserUpdate } from "@/lib/api";
import { useModelPreferences } from "./useModelPreferences";

type ModelTier = "lite" | "pro" | "pioneer";

type UseChatPreferencesOptions = {
  user: User | null;
  updateUser: (userData: UserUpdate) => Promise<void>;
};

export const useChatPreferences = ({ user, updateUser }: UseChatPreferencesOptions) => {
  const [autoWebSearchEnabledOverride, setAutoWebSearchEnabledOverride] = useState<boolean | undefined>(undefined);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [reasoningMode, setReasoningMode] = useState(false);
  const [modelTier, setModelTier] = useState<ModelTier>("lite");
  const [selectedModelIdOverride, setSelectedModelIdOverride] = useState<string | null | undefined>(undefined);
  const [visibleModelIds, setVisibleModelIds] = useState<string[] | null>(null);

  const autoWebSearchEnabled =
    autoWebSearchEnabledOverride === undefined
      ? typeof user?.auto_web_search_enabled === "boolean"
        ? user.auto_web_search_enabled
        : false
      : autoWebSearchEnabledOverride;

  const selectedModelId =
    selectedModelIdOverride === undefined ? user?.preferred_model ?? null : selectedModelIdOverride;

  useModelPreferences({
    user,
    updateUser,
    modelTier,
    setModelTier,
    selectedModelId,
    setSelectedModelId: setSelectedModelIdOverride,
    reasoningMode,
    setReasoningMode,
    visibleModelIds,
    setVisibleModelIds,
  });

  const toggleWebSearchEnabled = useCallback(() => {
    setWebSearchEnabled((prev) => !prev);
  }, []);

  const setAutoWebSearchEnabled = useCallback(
    (value: boolean) => {
      setAutoWebSearchEnabledOverride(value);
      if (!user) {
        return;
      }

      void updateUser({ auto_web_search_enabled: value })
        .then(() => {
          setAutoWebSearchEnabledOverride(undefined);
        })
        .catch((error) => {
          console.error("Failed to persist automatic web search preference:", error);
        });
    },
    [updateUser, user]
  );

  const setSelectedModelId = useCallback(
    (id: string | null) => {
      setSelectedModelIdOverride(id);
      if (!user) {
        return;
      }
      void updateUser({ preferred_model: id }).catch((error) => {
        console.error("Failed to persist model preference:", error);
      });
    },
    [updateUser, user]
  );

  return {
    autoWebSearchEnabled,
    setAutoWebSearchEnabled,
    webSearchEnabled,
    toggleWebSearchEnabled,
    reasoningMode,
    setReasoningMode,
    modelTier,
    setModelTier,
    selectedModelId,
    setSelectedModelId,
    visibleModelIds,
    setVisibleModelIds,
  };
};


import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { User, UserUpdate } from "@/lib/api";
import { ALL_PIONEER_MODEL_IDS, PIONEER_GROUPS, PIONEER_ONLY_MODEL_IDS } from "../../modelCatalog";
import { normalizePlanTier } from "../../utils/helperFunctions";

const VISIBLE_MODEL_IDS_STORAGE_PREFIX = "gray_visible_model_ids";

type ModelTier = "lite" | "pro" | "pioneer";

type UseModelPreferencesOptions = {
  user: User | null;
  updateUser: (userData: UserUpdate) => Promise<void>;
  modelTier: ModelTier;
  setModelTier: Dispatch<SetStateAction<ModelTier>>;
  selectedModelId: string | null | undefined;
  setSelectedModelId: Dispatch<SetStateAction<string | null | undefined>>;
  reasoningMode: boolean;
  setReasoningMode: Dispatch<SetStateAction<boolean>>;
  visibleModelIds: string[] | null;
  setVisibleModelIds: Dispatch<SetStateAction<string[] | null>>;
};

export const useModelPreferences = ({
  user,
  updateUser,
  modelTier,
  setModelTier,
  selectedModelId,
  setSelectedModelId,
  reasoningMode,
  setReasoningMode,
  visibleModelIds,
  setVisibleModelIds,
}: UseModelPreferencesOptions) => {
  const visibleModelIdsHydratedRef = useRef(false);
  const lastPersistedVisibleModelIdsRef = useRef<string | null>(null);

  const normalizeVisibleModelIds = useCallback((value: unknown): string[] | null => {
    if (value === null || value === undefined) {
      return null;
    }
    if (!Array.isArray(value)) {
      return null;
    }
    const allowed = new Set(ALL_PIONEER_MODEL_IDS);
    const sanitized = value
      .filter((candidate): candidate is string => typeof candidate === "string" && allowed.has(candidate))
      .filter((candidate, index, self) => self.indexOf(candidate) === index);
    return sanitized.length === 0
      ? []
      : sanitized.length === ALL_PIONEER_MODEL_IDS.length
        ? null
        : sanitized;
  }, []);

  const areVisibleModelIdsEqual = useCallback(
    (left: string[] | null, right: string[] | null): boolean => {
      if (left === null && right === null) {
        return true;
      }
      if (left === null || right === null) {
        return false;
      }
      if (left.length !== right.length) {
        return false;
      }
      for (let index = 0; index < left.length; index += 1) {
        if (left[index] !== right[index]) {
          return false;
        }
      }
      return true;
    },
    []
  );

  // Restore model selection from local storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedTier = localStorage.getItem("gray_model_tier");
      if (storedTier && ["lite", "pioneer"].includes(storedTier)) {
        setModelTier(storedTier as "lite" | "pioneer");
      } else if (storedTier === "pro") {
        // Migration: "Pro" is removed, force to "Lite"
        setModelTier("lite");
        localStorage.setItem("gray_model_tier", "lite");
      }
      const storedModelId = localStorage.getItem("gray_selected_model_id");
      if (storedModelId && !user) {
        setSelectedModelId(storedModelId);
      }
    }
  }, [setModelTier, setSelectedModelId, user]);

  // Enforce plan-tier model access on the client to avoid stale localStorage
  // keeping a user on a higher-tier model after downgrade.
  useEffect(() => {
    const normalizedTier = normalizePlanTier(user);

    if (selectedModelId === "moonshotai/kimi-k2-thinking") {
      setSelectedModelId("moonshotai/kimi-k2-0905");
      if (!reasoningMode) {
        setReasoningMode(true);
      }
      return;
    }

    if (selectedModelId === "moonshotai/kimi-k2-fast" && reasoningMode) {
      setReasoningMode(false);
    }

    if (normalizedTier === "scout") {
      if (modelTier !== "lite") {
        setModelTier("lite");
      }
      if (selectedModelId) {
        setSelectedModelId(null);
      }
      if (reasoningMode) {
        setReasoningMode(false);
      }
      return;
    }

    const selectedModelTierRequired = selectedModelId
      ? PIONEER_GROUPS.flatMap((group) => group.models)
          .find((model) => model.id === selectedModelId)
          ?.tierRequired
      : null;

    if (normalizedTier === "pathfinder") {
      if (selectedModelId && selectedModelTierRequired !== "pathfinder") {
        setSelectedModelId(null);
        setModelTier("lite");
      }
    } else if (normalizedTier === "voyager") {
      if (selectedModelId && PIONEER_ONLY_MODEL_IDS.includes(selectedModelId)) {
        setSelectedModelId(null);
        setModelTier("lite");
      }
    }

    if (selectedModelId && selectedModelTierRequired && modelTier !== "pioneer") {
      const isAllowed =
        (normalizedTier === "pathfinder" && selectedModelTierRequired === "pathfinder") ||
        (normalizedTier === "voyager" && selectedModelTierRequired !== "pioneer") ||
        normalizedTier === "pioneer";
      if (isAllowed) {
        setModelTier("pioneer");
      }
    }
  }, [modelTier, reasoningMode, selectedModelId, setModelTier, setReasoningMode, setSelectedModelId, user]);

  // Restore visible models per user (or anon)
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (user && "visible_model_ids" in user) {
      setVisibleModelIds(normalizeVisibleModelIds((user as { visible_model_ids?: unknown }).visible_model_ids));
      visibleModelIdsHydratedRef.current = true;
      return;
    }
    const key = `${VISIBLE_MODEL_IDS_STORAGE_PREFIX}:${user?.id ?? "anon"}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      setVisibleModelIds(null);
      visibleModelIdsHydratedRef.current = true;
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setVisibleModelIds(normalizeVisibleModelIds(parsed));
      visibleModelIdsHydratedRef.current = true;
    } catch {
      setVisibleModelIds(null);
      visibleModelIdsHydratedRef.current = true;
    }
  }, [normalizeVisibleModelIds, setVisibleModelIds, user]);

  // Persist visible models preference
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (user) {
      return;
    }
    const key = `${VISIBLE_MODEL_IDS_STORAGE_PREFIX}:${user?.id ?? "anon"}`;
    if (visibleModelIds === null) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(visibleModelIds));
  }, [user, user?.id, visibleModelIds]);

  // Persist visible models preference to the backend (so it survives browser resets / multi-device).
  useEffect(() => {
    if (!user || typeof updateUser !== "function") {
      lastPersistedVisibleModelIdsRef.current = null;
      return;
    }
    if (!("visible_model_ids" in user)) {
      return;
    }
    if (!visibleModelIdsHydratedRef.current) {
      return;
    }

    const normalizedFromUser = normalizeVisibleModelIds((user as { visible_model_ids?: unknown }).visible_model_ids);
    if (areVisibleModelIdsEqual(normalizedFromUser, visibleModelIds)) {
      return;
    }

    const serialized =
      visibleModelIds === null ? "all" : JSON.stringify(visibleModelIds);
    if (lastPersistedVisibleModelIdsRef.current === serialized) {
      return;
    }
    lastPersistedVisibleModelIdsRef.current = serialized;

    void updateUser({ visible_model_ids: visibleModelIds }).catch((error) => {
      console.error("Failed to persist visible models preference:", error);
    });
  }, [areVisibleModelIdsEqual, normalizeVisibleModelIds, updateUser, user, visibleModelIds]);

  // Persist model selection changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gray_model_tier", modelTier);
    }
  }, [modelTier]);

  useEffect(() => {
    if (typeof window !== "undefined" && !user) {
      if (selectedModelId) {
        localStorage.setItem("gray_selected_model_id", selectedModelId);
      } else {
        localStorage.removeItem("gray_selected_model_id");
      }
    }
  }, [selectedModelId, user]);
};

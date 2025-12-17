import { useCallback, useEffect, useRef, useState } from "react";
import { SELF_CONTEXT_PATTERNS } from "../constants";
import { shouldIncludeWorkspaceContext } from "../utils";

const WORKSPACE_CONTEXT_COOLDOWN_MS = 600000; // 10 minutes

type UseWorkspaceContextAttachmentOptions = {
  workspaceContext?: string;
};

export const useWorkspaceContextAttachment = ({ workspaceContext }: UseWorkspaceContextAttachmentOptions) => {
  const [workspaceContextState, setWorkspaceContextState] = useState<string | null>(workspaceContext ?? null);
  const workspaceContextValue =
    workspaceContext !== undefined ? workspaceContext ?? null : workspaceContextState;

  const workspaceContextUsageRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    workspaceContextUsageRef.current.clear();
  }, [workspaceContextValue]);

  const shouldAttachWorkspaceContextForSession = useCallback(
    (sessionId: string, message: string) => {
      if (!workspaceContextValue) {
        return false;
      }
      const wantsContext = shouldIncludeWorkspaceContext(message, workspaceContextValue);
      if (!wantsContext) {
        return false;
      }
      const normalized = message.trim().toLowerCase();
      const forceContext = SELF_CONTEXT_PATTERNS.some((pattern) => pattern.test(normalized));
      const lastUsed = workspaceContextUsageRef.current.get(sessionId);
      const now = Date.now();
      if (
        !forceContext &&
        typeof lastUsed === "number" &&
        now - lastUsed < WORKSPACE_CONTEXT_COOLDOWN_MS
      ) {
        return false;
      }
      workspaceContextUsageRef.current.set(sessionId, now);
      return true;
    },
    [workspaceContextValue]
  );

  return {
    workspaceContext: workspaceContextValue,
    setWorkspaceContext: setWorkspaceContextState,
    shouldAttachWorkspaceContextForSession,
  };
};


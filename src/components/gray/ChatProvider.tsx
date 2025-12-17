"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ChatContextValue } from "./chat/types";
import { GENERAL_CHAT_SESSION_ID } from "./chat/constants";
import { useChatProviderValue } from "./chat/provider/useChatProviderValue";

const ChatContext = createContext<ChatContextValue | null>(null);

type ChatProviderProps = {
  children: ReactNode;
  workspaceContext?: string;
};

export function ChatProvider({ children, workspaceContext }: ChatProviderProps) {
  const value = useChatProviderValue(workspaceContext);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChatStore = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatStore must be used within a ChatProvider");
  }
  return ctx;
};

export { GENERAL_CHAT_SESSION_ID };

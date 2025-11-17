"use client";

import { type ReactNode } from "react";
import { UserProvider } from "@/contexts/UserContext";
import { ChatProvider } from "@/components/gray/ChatProvider";
import { ProactivityNotificationProvider } from "@/components/gray/ProactivityNotificationProvider";

type GrayProvidersProps = {
  viewerEmail?: string | null;
  children: ReactNode;
};

export function GrayProviders({ viewerEmail, children }: GrayProvidersProps) {
  return (
    <UserProvider userEmail={viewerEmail ?? undefined}>
      <ChatProvider>
        <ProactivityNotificationProvider>{children}</ProactivityNotificationProvider>
      </ChatProvider>
    </UserProvider>
  );
}

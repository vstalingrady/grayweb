"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { UserProvider } from "@/contexts/UserContext";
import { ChatProvider } from "@/components/gray/ChatProvider";
import { ProactivityNotificationProvider } from "@/components/gray/ProactivityNotificationProvider";

type GrayProvidersProps = {
  viewerEmail?: string | null;
  children: ReactNode;
};

export function GrayProviders({ viewerEmail, children }: GrayProvidersProps) {
  const pathname = usePathname();

  // Skip user loading on confirm-delete page to prevent 401 errors after account deletion
  const shouldLoadUser = pathname !== "/confirm-delete";
  const effectiveEmail = shouldLoadUser ? viewerEmail : null;

  return (
    <UserProvider userEmail={effectiveEmail ?? undefined}>
      <ChatProvider>
        <ProactivityNotificationProvider>{children}</ProactivityNotificationProvider>
      </ChatProvider>
    </UserProvider>
  );
}

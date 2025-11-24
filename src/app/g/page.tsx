import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import GrayPageClient from "@/app/gray/GrayPageClient";
import { readServerSession } from "@/lib/auth/server";
import { GENERAL_CHAT_SESSION_ID } from "@/components/gray/ChatProvider";
import { hostFromHeaders, isGrayWorkspaceHost } from "@/lib/grayRouting";

export const metadata: Metadata = {
  title: "General",
};

export default async function GeneralWorkspacePage() {
  const requestHeaders = await headers();
  const host = hostFromHeaders(requestHeaders);
  if (!isGrayWorkspaceHost(host)) {
    notFound();
  }

  const redirectPath = "/g";
  const loginRedirect = `/login?redirect=${encodeURIComponent(redirectPath)}`;
  const session = await readServerSession();

  if (!session) {
    redirect(loginRedirect);
  }

  // Seed the client clock from the request time so hydration matches.
  // eslint-disable-next-line react-hooks/purity
  const initialTimestamp = Date.now();

  return (
    <GrayPageClient
      initialTimestamp={initialTimestamp}
      activeNav="general"
      variant="chat"
      activeChatId={GENERAL_CHAT_SESSION_ID}
    />
  );
}

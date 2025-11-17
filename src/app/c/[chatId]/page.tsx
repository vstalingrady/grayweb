import type { Metadata } from "next";
import { redirect } from "next/navigation";
import GrayPageClient from "@/app/gray/GrayPageClient";
import { readServerSession } from "@/lib/auth/server";
import { GENERAL_CHAT_SESSION_ID } from "@/components/gray/ChatProvider";

type ChatPageProps = {
  params: Promise<{
    chatId: string;
  }>;
};

export const metadata: Metadata = {
  title: "Chat",
};

export default async function ChatPage({ params }: ChatPageProps) {
  const { chatId } = await params;
  const session = await readServerSession();

  if (chatId === GENERAL_CHAT_SESSION_ID) {
    redirect("/g");
  }

  if (!session) {
    const redirectTarget = encodeURIComponent(`/c/${chatId}`);
    redirect(`/login?redirect=${redirectTarget}`);
  }

  // eslint-disable-next-line react-hooks/purity
  const initialTimestamp = Date.now();

  return (
    <GrayPageClient
      initialTimestamp={initialTimestamp}
      activeNav="history"
      variant="chat"
      activeChatId={chatId}
    />
  );
}

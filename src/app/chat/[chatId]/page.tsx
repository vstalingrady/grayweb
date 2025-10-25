import { redirect } from "next/navigation";
import GrayPageClient from "@/app/gray/GrayPageClient";
import { readServerSession } from "@/lib/auth/server";

type ChatPageProps = {
  params: Promise<{
    chatId: string;
  }>;
};

export default async function ChatPage({ params }: ChatPageProps) {
  const { chatId } = await params;
  const session = await readServerSession();

  if (!session) {
    const redirectTarget = encodeURIComponent(`/chat/${chatId}`);
    redirect(`/login?redirect=${redirectTarget}`);
  }

  // eslint-disable-next-line react-hooks/purity
  const initialTimestamp = Date.now();

  return (
    <GrayPageClient
      initialTimestamp={initialTimestamp}
      viewerEmail={session?.email ?? null}
      activeNav="history"
      variant="chat"
      activeChatId={chatId}
    />
  );
}

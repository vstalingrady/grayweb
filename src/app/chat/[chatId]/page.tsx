import { redirect } from "next/navigation";

type ChatPageProps = {
  params: Promise<{
    chatId: string;
  }>;
};

export default async function LegacyChatPage({ params }: ChatPageProps) {
  const { chatId } = await params;
  redirect(`/c/${chatId}`);
}

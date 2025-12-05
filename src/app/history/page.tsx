import type { Metadata } from "next";
import GrayPageClient from "../gray/GrayPageClient";
import { readServerSession } from "@/lib/auth/server";
/* eslint-disable react-hooks/purity */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "History",
};

export default async function HistoryPage() {
  const session = await readServerSession();
  if (!session) {
    const redirectPath = "/history";
    redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }

  const initialTimestamp = Date.now();

  return (
    <GrayPageClient
      initialTimestamp={initialTimestamp}
      activeNav="history"
      variant="general"
      activeChatId={null}
    />
  );
}

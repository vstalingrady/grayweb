import { redirect } from "next/navigation";
import GrayPageClient from "@/app/gray/GrayPageClient";
import { readServerSession } from "@/lib/auth/server";

export default async function GrayWorkspaceEntry() {
  const session = await readServerSession();
  if (!session) {
    redirect(`/login?redirect=${encodeURIComponent("/gray")}`);
  }
  return (
    <GrayPageClient
      initialTimestamp={Date.now()}
      activeNav="threads"
      variant="general"
    />
  );
}

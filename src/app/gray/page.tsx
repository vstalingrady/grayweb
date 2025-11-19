import { redirect } from "next/navigation";
import GrayPageClient from "@/app/gray/GrayPageClient";
import { readServerSession } from "@/lib/auth/server";

export default async function GrayPage() {
  const session = await readServerSession();
  if (!session) {
    redirect(`/login?redirect=${encodeURIComponent("/gray")}`);
  }

  const initialTimestamp = Date.now();
  return (
    <GrayPageClient
      initialTimestamp={initialTimestamp}
      activeNav="threads"
      variant="general"
    />
  );
}

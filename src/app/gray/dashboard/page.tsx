import { redirect } from "next/navigation";
import { readServerSession } from "@/lib/auth/server";
import GrayPageClient from "@/app/gray/GrayPageClient";

export default async function DashboardPage() {
  const session = await readServerSession();

  if (!session) {
    redirect("/login?redirect=/gray/dashboard");
  }

  // Seed the client clock from the request time so hydration matches.
  // eslint-disable-next-line react-hooks/purity
  const initialTimestamp = Date.now();

  return (
    <GrayPageClient
      initialTimestamp={initialTimestamp}
      activeNav="dashboard"
      variant="dashboard"
    />
  );
}

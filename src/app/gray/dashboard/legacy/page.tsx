import { redirect } from "next/navigation";
import GrayPageClient from "@/app/gray/GrayPageClient";
import { readServerSession } from "@/lib/auth/server";

const DEFAULT_REDIRECT = "/login?redirect=/gray/dashboard";

export default async function GrayDashboardPage() {
  const session = await readServerSession();

  if (!session) {
    redirect(DEFAULT_REDIRECT);
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

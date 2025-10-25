import { redirect } from "next/navigation";
import GrayPageClient from "@/app/gray/GrayPageClient";
import { readServerSession } from "@/lib/auth/server";

const DEFAULT_REDIRECT = "/login?redirect=/";

export default function GrayWorkspaceHome() {
  const session = readServerSession();

  if (!session) {
    redirect(DEFAULT_REDIRECT);
  }

  // The workspace clock seeds itself from the request time to avoid hydration drift.
  // eslint-disable-next-line react-hooks/purity
  const initialTimestamp = Date.now();

  return (
    <GrayPageClient
      initialTimestamp={initialTimestamp}
      viewerEmail={session?.email ?? null}
    />
  );
}

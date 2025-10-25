import { redirect } from "next/navigation";
import GrayPageClient from "@/app/gray/GrayPageClient";
import { readServerSession } from "@/lib/auth/server";

const DEFAULT_REDIRECT = "/login?redirect=/";

export default async function GrayWorkspaceHome() {
  const session = await readServerSession();

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

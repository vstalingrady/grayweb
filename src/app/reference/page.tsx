import { redirect } from "next/navigation";
import type { Metadata } from "next";
import GrayPageClient from "@/app/gray/GrayPageClient";
import { readServerSession } from "@/lib/auth/server";

const DEFAULT_REDIRECT = "/login?redirect=/reference";

export const metadata: Metadata = {
  title: "Reference Library",
};

export default async function ReferencePage() {
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
      activeNav="reference"
      variant="general"
    />
  );
}

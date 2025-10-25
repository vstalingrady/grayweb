import { redirect } from "next/navigation";
import GeminiPageClient from "./GeminiPageClient";
import { readServerSession } from "@/lib/auth/server";

const DEFAULT_REDIRECT = "/login?redirect=/gemini";

export default async function GeminiPage() {
  const session = await readServerSession();

  if (!session) {
    redirect(DEFAULT_REDIRECT);
  }

  return <GeminiPageClient viewerEmail={session.email ?? null} />;
}

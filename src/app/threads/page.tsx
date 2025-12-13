import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readServerSession } from "@/lib/auth/server";
import { hostFromHeaders, isGrayWorkspaceHost } from "@/lib/grayRouting";

export const metadata: Metadata = {
  title: "New Chat",
};

export default async function ThreadsRoute() {
  const requestHeaders = await headers();
  const host = hostFromHeaders(requestHeaders);

  if (!isGrayWorkspaceHost(host)) {
    redirect("/");
  }

  const session = await readServerSession();
  if (!session) {
    redirect(`/login?redirect=${encodeURIComponent("/threads")}`);
  }

  redirect("/");
}

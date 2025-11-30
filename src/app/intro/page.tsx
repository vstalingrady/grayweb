import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { readServerSession } from "@/lib/auth/server";
import { hostFromHeaders, isGrayWorkspaceHost } from "@/lib/grayRouting";
import IntroSplash from "../components/IntroSplash";

export const metadata: Metadata = {
  title: "Welcome",
};

export default async function IntroPage() {
  const requestHeaders = await headers();
  const host = hostFromHeaders(requestHeaders);
  if (!isGrayWorkspaceHost(host)) {
    notFound();
  }

  const session = await readServerSession();
  if (!session) {
    redirect(`/login?redirect=${encodeURIComponent("/intro")}`);
  }

  const cookieStore = await cookies();
  const hasSeenIntro = Boolean(cookieStore.get("gray_intro_done")?.value);
  if (hasSeenIntro) {
    redirect("/g");
  }

  return <IntroSplash />;
}

import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
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

  const cookieStore = await cookies();
  const hasSeenIntro = Boolean(cookieStore.get("gray_intro_done")?.value);
  if (hasSeenIntro) {
    redirect("/g");
  }

  return <IntroSplash />;
}


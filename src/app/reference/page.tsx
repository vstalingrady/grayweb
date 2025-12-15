import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { readServerSession } from "@/lib/auth/server";

const DEFAULT_REDIRECT = "/login?redirect=/reference";

export const metadata: Metadata = {
  title: "Reference",
};

export default async function ReferencePage() {
  const session = await readServerSession();

  if (!session) {
    redirect(DEFAULT_REDIRECT);
  }

  redirect("/g");
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Join Gray on Discord — alignment.id",
  description: "Enter the alignment.id sanctuary on Discord and activate Gray for your own workspace.",
};

export default function DiscordPage() {
  redirect("https://discord.gg/uUyPxxcfWP");
}

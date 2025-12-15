import { redirect } from "next/navigation";
import { readServerSession } from "@/lib/auth/server";
import GrayPageClient from "@/app/gray/GrayPageClient";

export default async function DashboardPage() {
    const session = await readServerSession();

    if (!session) {
        redirect("/login?redirect=/gray/dashboard");
    }

    return (
        <GrayPageClient
            user={{
                ...session.user,
                // Ensure strictly typed matches if needed
            }}
            initialSession={session}
            variant="dashboard"
        />
    );
}

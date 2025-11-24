import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { readServerSession } from "@/lib/auth/server";
import {
  hostFromHeaders,
  normalizeWorkspaceRedirect,
  resolveDefaultWorkspacePath,
  resolveWorkspaceOrigin,
  resolveWorkspaceHost,
} from "@/lib/grayRouting";

type LoginPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const sanitizeRedirect = (
  value: string | string[] | undefined
): string | null => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost") {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await readServerSession();

  if (session) {
    const requestHeaders = await headers();
    const host = hostFromHeaders(requestHeaders);
    const workspaceHost = resolveWorkspaceHost(host) ?? host;
    const redirectTarget =
      sanitizeRedirect(searchParams?.redirect) ??
      resolveDefaultWorkspacePath(workspaceHost);
    const destination = normalizeWorkspaceRedirect(
      redirectTarget,
      workspaceHost
    );
    const workspaceOrigin = resolveWorkspaceOrigin(
      host,
      requestHeaders.get("x-forwarded-proto") ?? undefined,
      requestHeaders.get("x-forwarded-port") ?? undefined
    );

    if (workspaceOrigin && destination.startsWith("/")) {
      redirect(new URL(destination, workspaceOrigin).toString());
    }

    redirect(destination);
  }

  return <LoginForm initialMode="signin" />;
}

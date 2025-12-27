import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import {
  hostFromHeaders,
  isGrayWorkspaceHost,
  isLocalHostname,
  resolveWorkspaceOrigin,
} from "@/lib/grayRouting";

type SignupPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const requestHeaders = await headers();
  const host = hostFromHeaders(requestHeaders);
  const isLocal = isLocalHostname(host);
  const isWorkspaceHost = isGrayWorkspaceHost(host);
  const forwardedProto = requestHeaders.get("x-forwarded-proto") ?? undefined;
  const forwardedPort = requestHeaders.get("x-forwarded-port") ?? undefined;
  const workspaceOrigin = resolveWorkspaceOrigin(host, forwardedProto, forwardedPort);

  if (!isLocal && !isWorkspaceHost && workspaceOrigin) {
    const params = await searchParams;
    const redirectUrl = new URL("/signup", workspaceOrigin);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
          value.forEach((entry) => {
            if (typeof entry === "string") {
              redirectUrl.searchParams.append(key, entry);
            }
          });
        } else if (typeof value === "string") {
          redirectUrl.searchParams.set(key, value);
        }
      }
    }
    redirect(redirectUrl.toString());
  }

  return <LoginForm initialMode="signup" />;
}

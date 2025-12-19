import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { hostFromHeaders, isGrayWorkspaceHost, isPayHost } from "@/lib/grayRouting";

const MAIN_SITE_URL = (process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? "https://alignment.id").replace(/\/+$/, "");

const MARKETING_DISALLOWS = [
  "/api",
  "/c",
  "/g",
  "/gray",
  "/login",
  "/signup",
  "/reset-password",
  "/callback",
  "/confirm-delete",
  "/delete-account",
  "/admin",
  "/threads",
  "/pulse",
  "/grove",
  "/cal",
  "/reference",
  "/payment",
];

export default function robots(): MetadataRoute.Robots {
  const host = hostFromHeaders(headers());
  const isProductHost = isGrayWorkspaceHost(host) || isPayHost(host);

  if (isProductHost) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: MARKETING_DISALLOWS,
    },
    sitemap: `${MAIN_SITE_URL}/sitemap.xml`,
  };
}

import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const apiOrigin =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "") ||
  "http://localhost:5080";
const configuredMockOrigin =
  process.env.NEXT_PUBLIC_MOCK_BASE_URL?.trim().replace(/\/+$/, "") || null;

/**
 * QLT-09: the management API is the only origin we can pin at build time.
 * When `NEXT_PUBLIC_MOCK_BASE_URL` is not set, `/meta` chooses the runtime
 * origin at runtime, so `https:` is allowed for that data-plane call only.
 * An explicit mock origin tightens the policy further.
 */
function contentSecurityPolicy(): string {
  const connect = [
    "'self'",
    apiOrigin,
    ...(configuredMockOrigin ? [configuredMockOrigin] : ["https:"]),
    ...(isDev ? ["ws:", "http://localhost:*"] : []),
  ];

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        // The MSW worker is only used by dev:mock and E2E. Never cache it.
        source: "/mockServiceWorker.js",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;

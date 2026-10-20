"use client";

/**
 * Replaces the root layout when it fails, so it must render its own html/body.
 * Inline styles keep the page readable even if the stylesheet did not load.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest?: unknown }).digest ?? "")
      : "";

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#09090b",
          color: "#f4f4f5",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <main
          style={{
            maxWidth: "42rem",
            margin: "0 auto",
            padding: "4rem 1.25rem",
            lineHeight: 1.6,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.75rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#bef264",
            }}
          >
            Something went wrong
          </p>
          <h1 style={{ marginTop: "0.75rem", fontSize: "2rem" }}>
            The app could not start
          </h1>
          <p style={{ color: "#a1a1aa" }}>
            Nothing was saved. Reload the page. If the problem continues, check
            your connection and the API configuration.
          </p>

          {digest ? (
            <p style={{ color: "#71717a", fontSize: "0.8rem" }}>
              Reference: <code>{digest}</code>
            </p>
          ) : null}

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                borderRadius: "0.5rem",
                border: "1px solid #bef264",
                background: "#bef264",
                color: "#09090b",
                padding: "0.6rem 1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
            {/* global-error renders outside the app router, so Link is not available here. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                borderRadius: "0.5rem",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#f4f4f5",
                padding: "0.6rem 1rem",
                textDecoration: "none",
              }}
            >
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}

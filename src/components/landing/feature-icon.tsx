import type { FeatureIconName } from "@/content/landing";

/**
 * Inline SVG so the landing page ships no icon dependency and no extra
 * network request. Every icon is decorative: the card title carries the
 * meaning.
 */
export function FeatureIcon({ name }: { name: FeatureIconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      {name === "schema" ? (
        <>
          <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1" />
          <path d="M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1" />
        </>
      ) : null}

      {name === "clock" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      ) : null}

      {name === "alert" ? (
        <>
          <path d="m10.29 3.86-8.18 14a2 2 0 0 0 1.72 3h16.34a2 2 0 0 0 1.72-3l-8.18-14a2 2 0 0 0-3.42 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </>
      ) : null}

      {name === "list" ? (
        <>
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <path d="M3 6h.01" />
          <path d="M3 12h.01" />
          <path d="M3 18h.01" />
        </>
      ) : null}

      {name === "route" ? (
        <>
          <circle cx="6" cy="19" r="3" />
          <path d="M9 19h6.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H15" />
          <circle cx="18" cy="5" r="3" />
        </>
      ) : null}

      {name === "terminal" ? (
        <>
          <path d="m4 17 6-5-6-5" />
          <path d="M12 19h8" />
        </>
      ) : null}
    </svg>
  );
}

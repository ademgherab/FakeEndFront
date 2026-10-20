/**
 * Edit-token storage.
 *
 * The API returns the edit token exactly once, when a project is created.
 * The contract says to keep it **in memory only**: never in `localStorage`,
 * never in `sessionStorage`, never in the URL. A page reload therefore loses
 * edit access until the user pastes the token again.
 *
 * The map lives in the module scope of the browser bundle, so it is per tab
 * and disappears with the tab.
 */

const tokens = new Map<string, string>();
const listeners = new Set<() => void>();

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** Stores the token for a slug. The token is never logged or persisted. */
export function rememberToken(slug: string, token: string): void {
  if (!isBrowser() || !slug || !token) return;
  tokens.set(slug, token);
  notify();
}

export function getToken(slug: string): string | null {
  if (!isBrowser()) return null;
  return tokens.get(slug) ?? null;
}

export function forgetToken(slug: string): void {
  if (!tokens.delete(slug)) return;
  notify();
}

/** Subscribes to token changes. Used with `useSyncExternalStore`. */
export function subscribeToTokens(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The server snapshot is always `null`: the token only exists in the browser
 * bundle, so the server-rendered markup never depends on it.
 */
export function getServerTokenSnapshot(): null {
  return null;
}

/**
 * The token shape from the contract: `et_` plus 43 URL-safe characters.
 * The check is a cheap guard against pasting something else; the server is
 * the authority.
 */
export function looksLikeEditToken(value: string): boolean {
  return /^et_[A-Za-z0-9_-]{43}$/.test(value.trim());
}

/**
 * Edit-token storage (FND-08).
 *
 * - Remembered tokens live in localStorage under `mockapi.token.{slug}`.
 * - Session-only tokens live in memory and disappear on reload, as promised.
 * - Recent-project metadata never contains the token.
 * - Corrupt, malformed and legacy entries are ignored and removed on read.
 *
 * Security note: localStorage is readable by any script on this origin. The
 * token is deliberately not encrypted — encryption without a user secret adds
 * no real protection and would only complicate recovery. The UI documents the
 * limitation and never prints, logs or copies the token by default.
 */

export const TOKEN_PREFIX = "mockapi.token.";
export const RECENT_PROJECTS_KEY = "mockapi.projects";
/** Older shape from before per-slug keys. Removed on cleanup. */
const LEGACY_TOKENS_KEY = "mockapi.tokens";
const MAX_RECENT_PROJECTS = 50;
const TOKEN_SHAPE = /^et_[A-Za-z0-9_-]{8,}$/;

export interface RecentProject {
  slug: string;
  name?: string | null;
  baseUrl?: string;
  expiresAt?: string;
  /** Last time this project was opened or its token was saved. */
  updatedAt: string;
}

export interface SaveTokenOptions {
  remember: boolean;
  name?: string | null;
  baseUrl?: string;
  expiresAt?: string;
}

export type TokenRemovalListener = (slug: string) => void;

const sessionTokens = new Map<string, string>();
const removalListeners = new Set<TokenRemovalListener>();

function tokenKey(slug: string): string {
  return `${TOKEN_PREFIX}${slug}`;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** True when a value looks like a token this product can use. */
export function isTokenShaped(value: unknown): value is string {
  return typeof value === "string" && TOKEN_SHAPE.test(value);
}

function readRecent(): RecentProject[] {
  const store = storage();
  if (!store) return [];

  let raw: string | null;
  try {
    raw = store.getItem(RECENT_PROJECTS_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      store.removeItem(RECENT_PROJECTS_KEY);
      return [];
    }

    const valid = parsed.filter(isRecentProject);
    if (valid.length !== parsed.length) {
      // Drop corrupt rows instead of leaving them to break every future read.
      writeRecent(valid);
    }
    return valid;
  } catch {
    try {
      store.removeItem(RECENT_PROJECTS_KEY);
    } catch {
      // Ignore unavailable storage.
    }
    return [];
  }
}

function isRecentProject(value: unknown): value is RecentProject {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as {
    slug?: unknown;
    updatedAt?: unknown;
    name?: unknown;
    baseUrl?: unknown;
    expiresAt?: unknown;
  };
  return (
    typeof candidate.slug === "string" &&
    candidate.slug.trim().length > 0 &&
    typeof candidate.updatedAt === "string" &&
    !Number.isNaN(Date.parse(candidate.updatedAt)) &&
    (candidate.name === undefined ||
      candidate.name === null ||
      typeof candidate.name === "string") &&
    (candidate.baseUrl === undefined || typeof candidate.baseUrl === "string") &&
    (candidate.expiresAt === undefined ||
      typeof candidate.expiresAt === "string")
  );
}

function writeRecent(projects: RecentProject[]): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(RECENT_PROJECTS_KEY, JSON.stringify(projects));
  } catch {
    // Storage may be disabled or full; do not break the flow.
  }
}

function upsertRecent(entry: RecentProject): void {
  const existing = readRecent().filter((project) => project.slug !== entry.slug);
  writeRecent([entry, ...existing].slice(0, MAX_RECENT_PROJECTS));
}

function notifyRemoval(slug: string): void {
  for (const listener of removalListeners) {
    try {
      listener(slug);
    } catch {
      // A listener must never break token removal.
    }
  }
}

/**
 * Removes malformed tokens, the legacy token map and corrupt recent rows.
 * Safe to call often; it never throws.
 */
export function cleanupTokenStorage(): void {
  const store = storage();
  if (!store) return;

  try {
    store.removeItem(LEGACY_TOKENS_KEY);

    for (let index = store.length - 1; index >= 0; index -= 1) {
      const key = store.key(index);
      if (!key?.startsWith(TOKEN_PREFIX)) continue;
      const value = store.getItem(key);
      if (!isTokenShaped(value)) store.removeItem(key);
    }
  } catch {
    // Ignore unavailable storage.
  }

  // Also validates the recent-project payload.
  readRecent();
}

function normalizeOptions(
  remember: boolean | SaveTokenOptions,
): SaveTokenOptions {
  return typeof remember === "boolean" ? { remember } : remember;
}

/**
 * Saves a token for one slug. `remember: false` keeps it in this tab only and
 * removes any previously remembered value for the same project. Other slugs
 * are never touched.
 *
 * Accepts `saveToken(slug, token, true)` and the richer options form.
 */
export function saveToken(
  slug: string,
  token: string,
  remember: boolean | SaveTokenOptions,
): void {
  if (!slug || !isTokenShaped(token)) return;
  const options = normalizeOptions(remember);

  sessionTokens.set(slug, token);

  const store = storage();
  try {
    if (options.remember) {
      store?.setItem(tokenKey(slug), token);
    } else {
      store?.removeItem(tokenKey(slug));
    }
  } catch {
    // Keep the in-memory copy so the current tab still works.
  }

  upsertRecent({
    slug,
    name: options.name ?? null,
    baseUrl: options.baseUrl,
    expiresAt: options.expiresAt,
    updatedAt: new Date().toISOString(),
  });
}

export function getToken(slug: string): string | null {
  if (!slug) return null;

  const inMemory = sessionTokens.get(slug);
  if (inMemory && isTokenShaped(inMemory)) return inMemory;
  if (inMemory) sessionTokens.delete(slug);

  const store = storage();
  if (!store) return null;

  try {
    const stored = store.getItem(tokenKey(slug));
    if (stored === null) return null;
    if (!isTokenShaped(stored)) {
      store.removeItem(tokenKey(slug));
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

export function hasToken(slug: string): boolean {
  return Boolean(getToken(slug));
}

/** True only when the token would survive a reload. */
export function isTokenPersisted(slug: string): boolean {
  const store = storage();
  if (!store) return false;
  try {
    const stored = store.getItem(tokenKey(slug));
    return isTokenShaped(stored);
  } catch {
    return false;
  }
}

/** Forget the token in this tab and on this device. */
export function removeToken(slug: string): void {
  sessionTokens.delete(slug);
  const store = storage();
  try {
    store?.removeItem(tokenKey(slug));
  } catch {
    // Ignore.
  }
  notifyRemoval(slug);
}

/** Destructive action: remove every remembered token but keep recent rows. */
export function clearAllTokens(): void {
  const slugs = new Set(sessionTokens.keys());
  sessionTokens.clear();

  const store = storage();
  if (store) {
    try {
      for (let index = store.length - 1; index >= 0; index -= 1) {
        const key = store.key(index);
        if (!key?.startsWith(TOKEN_PREFIX)) continue;
        slugs.add(key.slice(TOKEN_PREFIX.length));
        store.removeItem(key);
      }
    } catch {
      // Ignore unavailable storage.
    }
  }

  for (const slug of slugs) notifyRemoval(slug);
}

/** Destructive action: remove tokens and recent-project metadata. */
export function clearAllProjectData(): void {
  const slugs = new Set(sessionTokens.keys());
  sessionTokens.clear();

  const store = storage();
  if (store) {
    try {
      for (let index = store.length - 1; index >= 0; index -= 1) {
        const key = store.key(index);
        if (!key?.startsWith(TOKEN_PREFIX)) continue;
        slugs.add(key.slice(TOKEN_PREFIX.length));
        store.removeItem(key);
      }
      store.removeItem(RECENT_PROJECTS_KEY);
      store.removeItem(LEGACY_TOKENS_KEY);
    } catch {
      // Ignore unavailable storage.
    }
  }

  for (const slug of slugs) notifyRemoval(slug);
}

export function listRecentProjects(): RecentProject[] {
  return readRecent().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Task-facing alias for the recent-project list. */
export function listKnownProjects(): RecentProject[] {
  return listRecentProjects();
}

/** Update "last opened" without changing which token is stored. */
export function touchRecentProject(
  slug: string,
  updates: Omit<RecentProject, "slug" | "updatedAt"> = {},
): void {
  if (!slug) return;
  const existing = readRecent().find((project) => project.slug === slug);
  upsertRecent({
    slug,
    name: updates.name ?? existing?.name ?? null,
    baseUrl: updates.baseUrl ?? existing?.baseUrl,
    expiresAt: updates.expiresAt ?? existing?.expiresAt,
    updatedAt: new Date().toISOString(),
  });
}

export function removeRecentProject(slug: string): void {
  writeRecent(readRecent().filter((project) => project.slug !== slug));
}

/**
 * Notified whenever a token is removed or cleared. Workspace state subscribes
 * to this so a forgotten token cannot leave project data on screen.
 */
export function subscribeToTokenRemoval(
  listener: TokenRemovalListener,
): () => void {
  removalListeners.add(listener);
  return () => {
    removalListeners.delete(listener);
  };
}

/** Masked formatter, re-exported so token UI has one import. */
export { maskToken } from "@/lib/format";

/** Test-only helper. */
export function clearSessionTokensForTests(): void {
  sessionTokens.clear();
}

/** Test-only helper. */
export function clearTokenStorageForTests(): void {
  sessionTokens.clear();
  const store = storage();
  if (!store) return;
  try {
    for (let index = store.length - 1; index >= 0; index -= 1) {
      const key = store.key(index);
      if (
        key?.startsWith(TOKEN_PREFIX) ||
        key === RECENT_PROJECTS_KEY ||
        key === LEGACY_TOKENS_KEY
      ) {
        store.removeItem(key);
      }
    }
  } catch {
    // Ignore.
  }
}

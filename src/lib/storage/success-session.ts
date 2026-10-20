/**
 * Tracks that the one-time token screen has been shown in this tab, without
 * storing the token itself. Returning to the screen then renders the masked
 * form only.
 */

const PREFIX = "mockapi.success-shown.";
const shownInMemory = new Set<string>();

function available(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function hasSuccessBeenShown(slug: string): boolean {
  if (shownInMemory.has(slug)) return true;
  const store = available();
  try {
    return store?.getItem(`${PREFIX}${slug}`) === "1";
  } catch {
    return false;
  }
}

export function markSuccessShown(slug: string): void {
  shownInMemory.add(slug);
  const store = available();
  try {
    store?.setItem(`${PREFIX}${slug}`, "1");
  } catch {
    // The in-memory marker still protects this render tree.
  }
}

/** Test-only helper. */
export function clearSuccessShownForTests(): void {
  shownInMemory.clear();
  const store = available();
  if (!store) return;
  try {
    for (let index = store.length - 1; index >= 0; index -= 1) {
      const key = store.key(index);
      if (key?.startsWith(PREFIX)) store.removeItem(key);
    }
  } catch {
    // Ignore.
  }
}

import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

let startPromise: Promise<unknown> | null = null;

/** Start the service worker once, even if several components ask for it. */
export function startMocks(): Promise<unknown> {
  if (startPromise) return startPromise;
  startPromise = worker.start({
    onUnhandledRequest: "bypass",
    serviceWorker: { url: "/mockServiceWorker.js" },
    quiet: false,
  });
  return startPromise;
}

export function stopMocks(): void {
  worker.stop();
  startPromise = null;
}

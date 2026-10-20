import { setupServer } from "msw/node";
import { handlers } from "./handlers";
import { resetMockData } from "./data";

/** Vitest/Node server. Reset state before every test for determinism. */
export const server = setupServer(...handlers);

export function resetMocks(): void {
  resetMockData();
  server.resetHandlers();
}

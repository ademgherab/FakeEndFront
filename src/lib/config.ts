/**
 * Single source of truth for runtime configuration.
 *
 * Every value is read from `process.env` here and nowhere else. Parsing is lazy
 * so importing this module (from a test, a script or metadata) cannot crash on
 * a missing variable — only reading a value does. Outside production a missing
 * URL falls back to the local defaults from `.env.example`; production still
 * fails fast so a typo cannot silently send requests to the wrong host.
 */

export const API_V1_PREFIX = "/api/v1";
export const DEFAULT_APP_VERSION = "0.1.0";

const LOCAL_DEFAULTS = {
  NEXT_PUBLIC_API_BASE_URL: "http://localhost:5080",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
} as const;

export interface AppConfig {
  /** API origin without `/api/v1` and without a trailing slash. */
  apiBaseUrl: string;
  /** Public origin of this app, without a trailing slash. */
  appUrl: string;
  /** Optional mock-runtime origin from the environment. */
  mockBaseUrl: string | null;
  /** Cache-busting version for the meta payload. */
  version: string;
  isDev: boolean;
  /** Starts the MSW contract mocks in the browser when true. */
  enableMocks: boolean;
}

export type ConfigEnv = Record<string, string | undefined>;

function fail(name: string, reason: string): never {
  throw new Error(
    `[config] ${name} ${reason}. Copy .env.example to .env.local and set ${name} to an absolute http(s) URL.`,
  );
}

/**
 * Validates an absolute http(s) URL and removes trailing slashes so joins can
 * never produce a double slash.
 */
export function normalizeBaseUrl(
  name: string,
  raw: string | undefined,
  { required }: { required: boolean },
): string | null {
  const value = raw?.trim();
  if (!value) {
    if (required) {
      fail(name, "is missing");
    }
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    fail(name, `is not a valid absolute URL ("${value}")`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    fail(name, `must use http or https ("${value}")`);
  }
  if (parsed.username || parsed.password) {
    fail(name, "must not contain credentials");
  }
  if (parsed.search || parsed.hash) {
    fail(name, "must not contain a query string or fragment");
  }

  return value.replace(/\/+$/, "");
}

/** Pure, testable config parser. */
export function parseConfig(env: ConfigEnv): AppConfig {
  const apiBaseUrl = normalizeBaseUrl(
    "NEXT_PUBLIC_API_BASE_URL",
    env.NEXT_PUBLIC_API_BASE_URL,
    { required: true },
  ) as string;
  const appUrl = normalizeBaseUrl("NEXT_PUBLIC_APP_URL", env.NEXT_PUBLIC_APP_URL, {
    required: true,
  }) as string;
  const mockBaseUrl = normalizeBaseUrl(
    "NEXT_PUBLIC_MOCK_BASE_URL",
    env.NEXT_PUBLIC_MOCK_BASE_URL,
    { required: false },
  );
  const version = env.NEXT_PUBLIC_APP_VERSION?.trim() || DEFAULT_APP_VERSION;

  return {
    apiBaseUrl,
    appUrl,
    mockBaseUrl,
    version,
    isDev: env.NODE_ENV !== "production",
    enableMocks: env.NEXT_PUBLIC_ENABLE_MOCKS === "true",
  };
}

/**
 * Reads only the keys this module consumes. The literal `process.env.NEXT_PUBLIC_*`
 * references are required for Next.js to inline public values into client bundles.
 */
function readRuntimeEnv(): ConfigEnv {
  return {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_MOCK_BASE_URL: process.env.NEXT_PUBLIC_MOCK_BASE_URL,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
    NEXT_PUBLIC_ENABLE_MOCKS: process.env.NEXT_PUBLIC_ENABLE_MOCKS,
    NODE_ENV: process.env.NODE_ENV,
  };
}

/** Local development works without an `.env.local`; production still fails fast. */
function withLocalDefaults(env: ConfigEnv): ConfigEnv {
  if (env.NODE_ENV === "production") return env;

  return {
    ...env,
    NEXT_PUBLIC_API_BASE_URL:
      env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
      LOCAL_DEFAULTS.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_APP_URL:
      env.NEXT_PUBLIC_APP_URL?.trim() || LOCAL_DEFAULTS.NEXT_PUBLIC_APP_URL,
  };
}

let cachedConfig: AppConfig | undefined;

/** Parse the environment once, on first use. */
export function getConfig(): AppConfig {
  cachedConfig ??= parseConfig(withLocalDefaults(readRuntimeEnv()));
  return cachedConfig;
}

/**
 * Lazily parsed config. Property reads are forwarded to {@link getConfig}, so
 * `import { config }` is safe even before the environment is ready.
 */
export const config: AppConfig = {
  get apiBaseUrl() {
    return getConfig().apiBaseUrl;
  },
  get appUrl() {
    return getConfig().appUrl;
  },
  get mockBaseUrl() {
    return getConfig().mockBaseUrl;
  },
  get version() {
    return getConfig().version;
  },
  get isDev() {
    return getConfig().isDev;
  },
  get enableMocks() {
    return getConfig().enableMocks;
  },
};

/** Join a management API path onto the configured origin. */
export function apiUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${config.apiBaseUrl}${API_V1_PREFIX}${suffix}`;
}

/**
 * The mock runtime origin. Environment configuration wins; otherwise the
 * value advertised by GET /meta is used.
 */
export function resolveMockBaseUrl(
  metaMockBaseUrl?: string | null,
  configured: string | null = config.mockBaseUrl,
): string | null {
  const preferred = configured?.trim() || metaMockBaseUrl?.trim() || "";
  return preferred ? preferred.replace(/\/+$/, "") : null;
}

/** Join a mock base origin and an endpoint path without duplicate slashes. */
export function joinUrl(base: string, path: string): string {
  const left = base.replace(/\/+$/, "");
  const right = path.startsWith("/") ? path : `/${path}`;
  return `${left}${right}`;
}

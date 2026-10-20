# Production deployment

How to ship the FakeEnd frontend, how to verify the integration from the
browser, and what the host is responsible for.

## 1. Where it runs

The frontend is a standard Next.js 16 App Router application. It runs on any
Node.js 20 host (Vercel is the easiest). It is a single static route (`/`)
plus the browser-side builder, and it never talks to a database.

There is no Next.js API route and no BFF: the browser calls the management API
and the FakeEnd runtime directly.

## 2. Environment variables per environment

| Variable | Preview | Production |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api-staging.example.com` | `https://api.example.com` |

Rules:

- `NEXT_PUBLIC_*` values are **baked in at build time**. Changing an
  environment variable requires a new deployment, not a restart.
- Never put a token or any other secret in a `NEXT_PUBLIC_*` variable: the
  value is readable in the shipped JavaScript.
- The value is the API **origin** only. The client appends `/api/v1` itself,
  so a trailing slash or a path prefix will break every call.

## 3. Vercel setup

1. Import the repository. Framework preset: **Next.js**. Build command:
   `npm run build`; install command: `npm ci`.
2. Add the variable above for **Preview** and **Production** separately.
3. Deploy. The build must succeed, because `NEXT_PUBLIC_API_BASE_URL` is
   inlined into the client bundle.
4. Point a custom domain at the production project and confirm the certificate
   is issued. HTTPS only — the API is called with a bearer token.
5. Keep preview deployments out of the API allowlist unless you deliberately
   want them (see §4).

## 4. CORS verification

The management API and the FakeEnd runtime must allow the frontend origin.
Verify the preflight, because a missing or wrong `Access-Control-Allow-Origin`
only fails in the browser:

```bash
curl -i -X OPTIONS "https://api.example.com/api/v1/projects" \
  -H "Origin: https://fakeend.example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

The response must contain:

```
Access-Control-Allow-Origin: https://fakeend.example.com
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Accept
```

The same check applies to the FakeEnd runtime (`/m/*`), which must also expose
`X-Request-Id`, `X-Mock-Delay-Ms` and `X-Mock-Injected-Error`, otherwise the
test panel cannot show them.

Preview deployments use a different origin. Either add every preview origin to
the allowlist, or keep them out and accept that preview builds cannot call
the API. The default in this repository is to keep them out.

## 5. Security headers

`next.config.ts` sets these headers for every route:

| Header | Value | Why |
| --- | --- | --- |
| `Content-Security-Policy` | strict policy, `connect-src` limited to the API origin | Blocks injected scripts and unexpected outbound calls. |
| `X-Content-Type-Options` | `nosniff` | No MIME sniffing. |
| `X-Frame-Options` | `DENY` | No clickjacking. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Keeps paths out of other sites' referrers. |
| `Permissions-Policy` | camera, microphone, geolocation, payment disabled | The app needs none of them. |

`connect-src` contains the management API origin only. The FakeEnd runtime
origin is not known at build time, so it is not pinned; if the runtime must be
restricted, allow that origin in the host's own CSP.

If the host sets its own headers, the host wins. On Vercel these headers are
the ones the app sends; nothing else is required.

## 6. Smoke test after deploying

1. Load the production URL over HTTPS; the builder renders and the console
   shows no CSP violation.
2. Paste a JSON sample and click **Infer schema**; the schema appears.
3. Set an error rate above 0 and click **Create mock**; the base URL and the
   endpoint URL appear.
4. Click **Test endpoint**; the status, the runtime headers and the body are
   shown.
5. Check the security headers:

```bash
curl -sI "https://fakeend.example.com/" | grep -iE "content-security-policy|x-frame-options|x-content-type"
```

## 7. Rollback and incidents

- Redeploy the previous build; the frontend is stateless, so a rollback is
  instant.
- If the API contract changed, deploy the frontend and the backend together.
- When a user reports a failure, ask for the **request id** shown in the test
  panel. It is the id from the API and is the fastest way to find the matching
  backend log. The frontend never sends tokens, samples or request bodies to
  analytics or error reporting, because none is configured.

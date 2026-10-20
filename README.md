# FakeEnd frontend

Next.js (App Router) + TypeScript + Tailwind frontend for the FakeEnd sprint. One page
(`/`) turns a JSON sample into a live fake endpoint, lets you test it, and shows the
response. A static landing page (`/landing`) explains the product and links into it.

## Requirements

- Node.js 20 or newer
- npm (the repo commits a single `package-lock.json`)

## Local setup

```bash
npm install
npm run dev
```

The app runs at <http://localhost:3000> and calls the backend directly. Set the backend
origin with `NEXT_PUBLIC_API_BASE_URL`; it defaults to `http://localhost:5031`.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | No | Management API origin. Defaults to `http://localhost:5031`. The client appends `/api/v1`. |

The variable is inlined into the browser bundle at build time, so it must never contain a
secret.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run `tsc --noEmit`. |

## Layout

```
src/app/page.tsx                 # the builder page, renders the builder
src/app/landing/page.tsx         # static landing page (no API call)
src/components/builder/
  builder.tsx                    # state machine and layout
  json-sample-input.tsx          # sample, list switch, infer
  settings-form.tsx              # method/path/status/delay/errors/list size + presets
  schema-preview.tsx             # read-only JSON schema
  result-panel.tsx               # baseUrl + endpoint URL + copy
  test-panel.tsx                 # call the mock, show status/headers/body
  copy-button.tsx                # clipboard copy with fallback
  error-banner.tsx               # code + detail API error banner
src/components/landing/
  site-header.tsx                # brand, section links, CTA to the builder
  hero.tsx                       # headline, subline, CTAs
  code-preview.tsx               # sample in, served response out
  sections.tsx                   # how it works, features, privacy
  site-footer.tsx                # footer links
  feature-icon.tsx               # inline SVG icons
src/content/landing.ts           # every string on the landing page
src/lib/
  types.ts                       # frontend-spec.md §4 types
  defaults.ts                    # settings defaults, presets, fallback limits
  validation.ts                  # path/sample/settings validators
  api.ts                         # BASE, request<T>, infer, preview, createProject
examples/users.json              # demo fixture
```

## Behavior notes

- The landing page (`/landing`) is a server component: it renders without any API call and
  its CTAs point at the builder (`/`).
- The sample is parsed locally before any request. A bad sample disables inference.
- Changing the sample after a successful inference marks the schema stale and disables
  create until inference runs again.
- Create sends `sample` or `schema` per endpoint, never both.
- The edit token is never copied, logged or stored; a small "token returned" note is shown
  only if the backend returns one.
- No `localStorage`/`sessionStorage` persistence.

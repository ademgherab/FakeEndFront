# Five-minute demo script

Two rehearsals are enough to make this smooth. The script assumes the app runs
in mock mode (`pnpm dev:mock`), so no backend, no network and no rate limits
can interrupt it. The same clicks work against a real backend — see
[Running against a real API](#running-against-a-real-api).

## Before you start (30 seconds)

1. `pnpm dev:mock` and open <http://localhost:3000/dev/demo>.
2. Click **Reset demo data**. The log table is now empty and the demo project
   is back to its seeded state.
3. Open <http://localhost:3000/p/demo> in a second tab. The project opens
   because the demo token is stored in this browser.
4. Check the expiry date in the project header. **Never demo a project that
   expires during the session.** If it is close to expiry, create a fresh
   project instead (steps 5–7 below take 30 seconds).

## The demo (4 minutes 30)

| # | Click | Say | Expected outcome |
| --- | --- | --- | --- |
| 1 | **New project** | "Paste a JSON sample, get a live API." | The builder opens with the sample step. |
| 2 | Click the **User list** example | "Any JSON works; inference reads names, types and patterns." | The editor fills with a two-record array and the size counter updates. |
| 3 | Click **Infer schema** | "Inference proposes a schema I can edit." | The schema tree appears with fields, types and generators. |
| 4 | In the tree, select a field and change its name to `full_name` | "Fields are editable before the project exists." | The tree and the preview update; the change is marked as unsaved. |
| 5 | Click **Continue to settings**, set **Minimum (ms)** to `200` and **Maximum (ms)** to `400` | "Delay and error injection are part of the endpoint." | The delay fields show the new bounds. |
| 6 | Set **Error rate (%)** to `0` | "Errors are opt-in; I will show one on the live call." | The status code field stays disabled until the rate is above 0. |
| 7 | Click **Continue to preview** | "The preview is the same generator the runtime uses." | A JSON preview renders, and the project name field is above it. |
| 8 | Type `Demo API` in **Project name (optional)** and click **Create project** | "Creating the project now." | The token screen appears. |
| 9 | Show the **Edit token** | "This token is shown exactly once. I saved it." | The token is visible in the amber panel, with copy and download buttons. |
| 10 | Tick **I saved this token somewhere safe**, then click **Open project** | "Now the project overview." | The overview lists the endpoint, its URL and the daily quota. |
| 11 | Click **Open endpoint** → tab **Try it** | "The runtime needs no token; this is a real HTTP call." | The request panel shows the runtime URL. |
| 12 | Click **Send request** | "Same shape every time, fresh values." | A `200` response with headers, latency and a JSON body appear. |
| 13 | Click the **Logs** tab | "Every call is logged, and the table updates live." | The log row for the call appears within about two seconds, highlighted as new. |
| 14 | Click the log row | "Status, delay, latency and the request id are all here." | The request detail dialog opens. |
| 15 | Back on **Settings**, set **Error rate (%)** to `100` and the code to `500`, click **Save**, then **Try it** → **Send request** | "Injected errors are a real HTTP status, not a broken request." | The response shows a `500` with an “injected” badge, and the log records it. |

## Backup if the API is down

- **Mock mode (default rehearsal):** `pnpm dev:mock` serves the whole flow
  from the contract mocks. `/dev/demo` resets the seeded project and its logs.
- **Recorded flow:** the steps above are deterministic; screen-record one
  clean rehearsal and keep it locally as a fallback.
- **Fresh project:** a new project never depends on the previous one, so a
  failed create can simply be repeated.

## Running against a real API

1. Set `NEXT_PUBLIC_API_BASE_URL` to the management API origin and start
   `pnpm dev`.
2. Create a new project in step 1 of the script; the demo project does not
   exist on a real backend.
3. Everything else is identical. If the API is slow, use the seeded mock
   project for the log part of the demo.

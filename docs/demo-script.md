# Five-minute demo script

Two rehearsals are enough to make this smooth. The script assumes the app runs
against a real backend (`npm run dev` plus a management API on
`http://localhost:5031`), because the whole point of the demo is that the URL
it produces really answers.

## Before you start (30 seconds)

1. `npm run dev` and open <http://localhost:3000>.
2. Check the **API:** line in the header. It shows the origin the page talks
   to. If it points somewhere else, set `NEXT_PUBLIC_API_BASE_URL` and restart.
3. Open a second tab on the runtime origin. The **Test endpoint** button in
   the app calls it from the browser, so a blocked origin shows up as a CORS
   error rather than as a broken demo.

> Optional opener: <http://localhost:3000/landing> is a static page that
> explains the product in one screen. Show it for ten seconds before the
> builder if the audience has not seen FakeEnd before; it needs no backend.

## The demo (4 minutes 30)

| # | Click | Say | Expected outcome |
| --- | --- | --- | --- |
| 1 | Paste a JSON sample in the editor | "Paste JSON, get a live endpoint." | The line under the editor turns green and reads **Valid JSON**. |
| 2 | Click **Infer schema** | "The API reads the sample and proposes a schema." | The schema appears as read-only JSON on the right. |
| 3 | Change the **Path** to `/demo/users` | "The path is part of the endpoint." | The field keeps the value; an invalid path is flagged under it. |
| 4 | Set **Delay min (ms)** to `200` and **Delay max (ms)** to `400` | "Delay is part of the contract." | Both fields keep their values and the field errors stay empty. |
| 5 | Set **Error rate (%)** to `10` and the codes to `500, 503` | "Errors are opt-in and bounded." | The rate field keeps `10`; the codes field is editable because the rate is above 0. |
| 6 | Click the **Flaky demo** preset | "Or start from a preset." | The delay, rate and codes jump to the preset values. |
| 7 | Click **Create mock** | "Creating the project now." | The result panel appears with the base URL and the endpoint URL. |
| 8 | Click **Copy endpoint URL** | "Here is the URL you call." | The button flips to **Copied**. |
| 9 | Click **Test endpoint** | "The runtime needs no token; this is a real HTTP call." | The status, the `X-Request-Id`, the delay header and the JSON body appear. |
| 10 | Click the same URL in the second tab | "Same shape every time, fresh values." | The endpoint answers with a generated body. |

## Backup if the API is down

- **A recorded flow:** the steps above are deterministic; screen-record one
  clean rehearsal and keep it locally as a fallback.
- **A fresh project:** a new project never depends on the previous one, so a
  failed create can simply be repeated.
- **The editor still works:** the sample is parsed and the settings are
  validated in the browser, so the builder can be demonstrated without a
  backend — only **Infer schema** and **Create mock** need the API.

## Running against a staging API

1. Set `NEXT_PUBLIC_API_BASE_URL` to the staging origin and run `npm run dev`.
2. Everything else is identical. The header shows the origin in use, so there
   is never any doubt about which backend the demo is hitting.
3. Remember that `NEXT_PUBLIC_*` values are inlined at build time: a staging
   build needs its own build.

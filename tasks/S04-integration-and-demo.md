# S04 — Integration, smoke test, demo (10 min)

- **Depends on:** S03
- **Files:** `scripts/smoke.sh`, `examples/users.json`

## Checklist

- [ ] `dotnet build` with no errors.
- [ ] `scripts/smoke.sh`: create a project from the sample, call the mock 10×, assert 200/headers/CORS.
- [ ] Verify injected errors with `ratePercent: 100`.
- [ ] Verify delay appears in `X-Mock-Delay-Ms`.
- [ ] Verify nested arrays and a second endpoint.
- [ ] Write the run command in `README.md` (root): `dotnet run --project src/MockApi`.
- [ ] Record the demo script:

```
1. POST /api/v1/projects with sample
2. copy baseUrl
3. GET baseUrl/users
4. repeat to show new data
5. show X-Mock-Delay-Ms and an injected 503
```

## Freeze rule

No new features after S04 starts. Fix only build/runtime blockers.

# T00 — Project setup, configuration, DI

- **Milestone:** M0
- **Depends on:** none
- **Spec refs:** §0.2 (Q2), §2.1, §3, §10.1, §11.2

## Goal

A runnable ASP.NET Core solution with clean project boundaries, typed configuration, and the plumbing the rest of the tasks assume.

## Scope

- Create the solution and the four projects from the README layout.
- Wire `Program.cs` with controllers/minimal APIs, JSON options, DI, and configuration.
- Add `MockApiOptions` bound from configuration (`appsettings.json` + env vars), covering every limit in §11.1.
- Add `.editorconfig`, `Directory.Build.props`, nullable enabled, warnings as errors in CI.
- Add a `GET /health/live` returning `200` (readiness is T03).

## Implementation checklist

- [x] `dotnet new sln`, `dotnet new webapi`, classlibs, xUnit projects.
- [x] Project references flow one way: `Api → Core, Data, Workers`; `Workers → Core, Data`; no cycles.
- [x] `JsonSerializerOptions`: camelCase, enums as strings (custom converter), `MaxDepth = 32`, unknown properties rejected (`JsonUnmappedMemberHandling.Disallow`).
- [x] `MockApiOptions` sections: `Limits`, `Projects`, `RateLimits`, `Cors`, `Runtime`, `Images`, `Workers`. Validate on startup (`ValidateDataAnnotations`, `ValidateOnStart`).
- [x] Default values match the spec table exactly (7 day lifetime, 10 endpoints, 5000/day, 100k values, etc.).
- [x] Bind `ASPNETCORE_ENVIRONMENT`, connection string, and `MockBaseUrl` from config; no secrets in `appsettings.json` committed.
- [x] `dotnet run` starts and `/health/live` responds `200`.

## Acceptance criteria

- [x] `dotnet build` succeeds from clean.
- [x] Changing a limit in configuration changes the value served by `/meta` later (no constants).
- [x] App fails fast at startup on missing/invalid required config.
- [x] No `DateTime.Now`, `Random`, or hard-coded URLs introduced in shared code.

## Tests

- Configuration binding test: defaults equal spec values; env var override wins.
- Serialization test: camelCase, string enums, unknown member rejects.

## Out of scope

Database, endpoints other than liveness, rate limiting, OpenAPI.

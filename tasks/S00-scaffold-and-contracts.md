# S00 — Scaffold, contracts, store (10 min)

- **Depends on:** none
- **Files:** `src/MockApi/MockApi.csproj`, `Contracts.cs`, `Store.cs`, `Program.cs` (skeleton)

## Checklist

- [ ] `dotnet new web -n MockApi -f net9.0 -o src/MockApi`.
- [ ] `Contracts.cs`: `CreateProjectRequest`, `CreateEndpointRequest`, `InferRequest`, `PreviewRequest`, `EndpointSettings`, `Project`, `Endpoint`.
- [ ] Schema represented as `JsonNode`; no 8-type DTO hierarchy.
- [ ] `Store.cs`: `ConcurrentDictionary<string, Project>`, slug generator from `[a-z0-9]` using `RandomNumberGenerator`.
- [ ] `/health/live` returns 200.
- [ ] `dotnet build` passes.

## Contract sketch

```
Project  { Slug, Name, CreatedAt, ExpiresAt, Endpoints }
Endpoint { Id, Method, Path, PathNormalized, Schema(JsonNode), Settings }
Settings { SuccessStatus, Delay{MinMs,MaxMs}, Errors{RatePercent,StatusCodes}, List{Size{Min,Max}} }
```

Keep this file frozen after it compiles; other tasks depend on it.

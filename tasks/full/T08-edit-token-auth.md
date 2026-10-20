# T08 — Edit-token issuance and project auth

- **Milestone:** M2
- **Depends on:** T01, T02
- **Spec refs:** §0.1 (D2), §3, §4.2, §10.2, §11.3

## Goal

Project management protected by a high-entropy bearer token that is shown exactly once and stored only as a hash.

## Scope

- `EditTokenService`: generate, format, hash, verify.
- Authorization filter/endpoint filter for all project-scoped routes.
- Enforced check order: slug exists → token present → token valid → not expired.

## Implementation checklist

- [x] Generate 32 bytes via `RandomNumberGenerator`; format `et_` + base64url (no padding); ~43 chars after prefix.
- [x] Store only SHA-256 (32 bytes) in `projects.edit_token_hash`.
- [x] Verify with `CryptographicOperations.FixedTimeEquals` over the computed digest.
- [ ] Return the raw token only from `POST /projects`; no endpoint ever returns or recovers it.
- [x] Require `Authorization: Bearer <editToken>` on every project-scoped management call.
- [x] `401 missing_token` for absent/malformed header, with `WWW-Authenticate: Bearer`.
- [x] `403 invalid_token` when the token does not match the project.
- [x] `404 project_not_found` for unknown/purged slug, checked before auth.
- [x] `410 project_expired` after `expires_at`, checked after valid auth; no read-only access.
- [x] Distinguish these in tests: unknown slug + no token ⇒ 404, not 401; known slug + no token ⇒ 401; known slug + wrong token ⇒ 403; expired + valid token ⇒ 410.
- [x] Never log the token or its hash; exclude the `Authorization` header (T03).
- [x] Constant-time comparison even for unequal-length inputs (guard before compare).

## Acceptance criteria

- [x] A created project can be read with its token and rejected with any other token.
- [x] The token cannot be obtained from `GET /projects/{slug}` or any log.
- [ ] Expired projects reject both read and write with `410`.
- [x] Auth checks happen in the documented order and each failure has the right `code`.
- [ ] Deleting a project is possible with a valid, non-expired token.

## Tests

- Unit tests: token format/entropy sanity, hash determinism, verify true/false, fixed-time path.
- Integration tests for the four-case order matrix.
- Log-scan test asserting the token never appears.

## Notes

- Plain SHA-256 is sufficient because the token is 32 random bytes (§4.2). Do not add bcrypt/argon2.
- The UI's "save this token" experience is frontend work (missing spec §13.5); the backend contract is "returned once, never recoverable".

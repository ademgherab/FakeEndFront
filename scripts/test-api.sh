#!/usr/bin/env bash
#
# End-to-end smoke tests for the MockAPI HTTP API.
#
# Usage:
#   ./scripts/test-api.sh                 # auto: test what is implemented, skip missing areas
#   ./scripts/test-api.sh --live          # only health endpoints
#   ./scripts/test-api.sh --full          # require every documented route (fails until T07/T09/T11/T13)
#   BASE_URL=http://localhost:5031 ./scripts/test-api.sh
#
# Requires: bash, curl, jq.
#
# The script creates a temporary project and deletes it on exit. Remote URLs are
# refused unless ALLOW_REMOTE=1 is set.
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://localhost:5031}"
MODE="auto"
TIMEOUT="${TIMEOUT:-30}"
REQUIRE_DB="${REQUIRE_DB:-0}"

usage() {
    sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
}

while (($# > 0)); do
    case "$1" in
        --live) MODE="live" ;;
        --auto) MODE="auto" ;;
        --full|--strict) MODE="full" ;;
        --base-url)
            [[ $# -ge 2 ]] || { echo "--base-url requires a value" >&2; exit 2; }
            BASE_URL="$2"
            shift
            ;;
        --timeout)
            [[ $# -ge 2 ]] || { echo "--timeout requires a value" >&2; exit 2; }
            TIMEOUT="$2"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
    shift
done

BASE_URL="${BASE_URL%/}"

if [[ "$BASE_URL" != http://localhost* \
    && "$BASE_URL" != http://127.0.0.1* \
    && "$BASE_URL" != http://\[::1\]* \
    && "${ALLOW_REMOTE:-0}" != "1" ]]; then
    echo "Refusing to run against a remote URL. Set ALLOW_REMOTE=1 to override." >&2
    exit 2
fi

for command in curl jq; do
    command -v "$command" >/dev/null 2>&1 || {
        echo "Missing dependency: $command" >&2
        exit 2
    }
done

TMP_DIR="$(mktemp -d)"
BODY_FILE="$TMP_DIR/body"
HEADERS_FILE="$TMP_DIR/headers"
SCHEMA_FILE="$TMP_DIR/schema.json"
LAST_STATUS=""
LAST_BODY=""
PROJECT_SLUG=""
EDIT_TOKEN=""
RUNTIME_BASE=""
TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_SKIP=0

if [[ -t 1 ]]; then
    C_RESET=$'\033[0m'
    C_GREEN=$'\033[32m'
    C_RED=$'\033[31m'
    C_YELLOW=$'\033[33m'
    C_BLUE=$'\033[34m'
else
    C_RESET=""
    C_GREEN=""
    C_RED=""
    C_YELLOW=""
    C_BLUE=""
fi

ok() {
    TOTAL_PASS=$((TOTAL_PASS + 1))
    printf '%sPASS%s %s\n' "$C_GREEN" "$C_RESET" "$1"
}

bad() {
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
    printf '%sFAIL%s %s\n' "$C_RED" "$C_RESET" "$1"
}

skip() {
    TOTAL_SKIP=$((TOTAL_SKIP + 1))
    printf '%sSKIP%s %s\n' "$C_YELLOW" "$C_RESET" "$1"
}

section() {
    printf '\n%s== %s ==%s\n' "$C_BLUE" "$1" "$C_RESET"
}

show_body() {
    if [[ -z "$LAST_BODY" ]]; then
        printf '       body: <empty>\n'
    elif jq . >/dev/null 2>&1 <<<"$LAST_BODY"; then
        printf '       body: %s\n' "$(jq -c . <<<"$LAST_BODY")"
    else
        printf '       body: %s\n' "$LAST_BODY"
    fi
}

cleanup() {
    local exit_code=$?
    if [[ -n "$PROJECT_SLUG" && -n "$EDIT_TOKEN" ]]; then
        curl -sS -o /dev/null -X DELETE \
            -H "Authorization: Bearer $EDIT_TOKEN" \
            --max-time "$TIMEOUT" \
            "$BASE_URL/api/v1/projects/$PROJECT_SLUG" >/dev/null 2>&1 || true
    fi
    rm -rf "$TMP_DIR"
    exit "$exit_code"
}
trap cleanup EXIT

request() {
    local method="$1"
    local url="$2"
    local data="${3-}"
    local auth="${4-}"
    local args=(
        -sS
        -X "$method"
        -D "$HEADERS_FILE"
        -o "$BODY_FILE"
        -w '%{http_code}'
        --max-time "$TIMEOUT"
    )

    if [[ -n "$auth" ]]; then
        args+=(-H "Authorization: Bearer $auth")
    fi

    if [[ -n "$data" ]]; then
        args+=(-H "Content-Type: application/json" --data-binary "$data")
    fi

    if ! LAST_STATUS="$(curl "${args[@]}" "$url")"; then
        LAST_BODY=""
        bad "curl $method $url"
        return 1
    fi

    LAST_BODY="$(<"$BODY_FILE")"
    return 0
}

api() {
    request "$1" "$BASE_URL$2" "${3-}" "${4-}" || true
}

expect_status() {
    local expected="$1"
    local label="$2"

    if [[ "$LAST_STATUS" == "$expected" ]]; then
        ok "$label"
    else
        bad "$label (expected HTTP $expected, got $LAST_STATUS)"
        show_body
    fi
}

expect_json() {
    local expression="$1"
    local expected="$2"
    local label="$3"
    local actual

    if ! actual="$(jq -r "$expression" <<<"$LAST_BODY" 2>/dev/null)"; then
        bad "$label (response is not valid JSON)"
        show_body
        return
    fi

    if [[ "$actual" == "$expected" ]]; then
        ok "$label"
    else
        bad "$label (expected '$expected', got '$actual')"
    fi
}

expect_json_true() {
    local expression="$1"
    local label="$2"

    if jq -e "$expression" >/dev/null 2>&1 <<<"$LAST_BODY"; then
        ok "$label"
    else
        bad "$label"
        show_body
    fi
}

expect_regex() {
    local value="$1"
    local pattern="$2"
    local label="$3"

    if [[ "$value" =~ $pattern ]]; then
        ok "$label"
    else
        bad "$label (value '$value' does not match '$pattern')"
    fi
}

header_value() {
    awk -v wanted="$1" '
        BEGIN { IGNORECASE = 1 }
        {
            line = $0
            sub(/\r$/, "", line)
            position = index(line, ":")
            if (position == 0) next
            name = substr(line, 1, position - 1)
            if (tolower(name) == tolower(wanted)) {
                value = substr(line, position + 1)
                sub(/^[ \t]+/, "", value)
                print value
                exit
            }
        }
    ' "$HEADERS_FILE"
}

expect_header_eq() {
    local name="$1"
    local expected="$2"
    local label="$3"
    local actual
    actual="$(header_value "$name")"

    if [[ "$actual" == "$expected" ]]; then
        ok "$label"
    else
        bad "$label (header $name: expected '$expected', got '$actual')"
    fi
}

expect_header_regex() {
    local name="$1"
    local pattern="$2"
    local label="$3"
    local actual
    actual="$(header_value "$name")"

    if [[ "$actual" =~ $pattern ]]; then
        ok "$label"
    else
        bad "$label (header $name: '$actual' does not match '$pattern')"
    fi
}

expect_header_present() {
    local name="$1"
    local label="$2"
    local actual
    actual="$(header_value "$name")"

    if [[ -n "$actual" ]]; then
        ok "$label"
    else
        bad "$label (missing header $name)"
    fi
}

request_safe() {
    request "$@" || true
}

SAMPLE='{"id":1,"name":"Ahmed Benali","email":"ahmed@example.com","created_at":"2026-01-15T10:30:00Z","tags":["alpha","beta"],"meta":{"active":true}}'
WRONG_TOKEN="et_$(printf 'A%.0s' {1..43})"

section "Health"
api GET /health/live
expect_status 200 "GET /health/live returns 200"
expect_json '.status' 'Healthy' "liveness reports Healthy"

if api GET /health/ready; then
    if [[ "$LAST_STATUS" == "200" ]]; then
        expect_json '.status' 'Healthy' "readiness reports Healthy"
    elif [[ "$REQUIRE_DB" == "1" ]]; then
        expect_status 200 "GET /health/ready returns 200"
    else
        skip "GET /health/ready returned $LAST_STATUS (database not configured; set REQUIRE_DB=1 to require it)"
    fi
else
    bad "GET /health/ready did not respond"
fi

if [[ "$LAST_STATUS" == "000" || -z "$LAST_STATUS" ]]; then
    printf '\nAPI is not reachable at %s\n' "$BASE_URL" >&2
    printf 'Start it with: dotnet run --project src/MockApi.Api\n' >&2
    exit 1
fi

if [[ "$MODE" == "live" ]]; then
    printf '\nMode=live: management and runtime checks skipped.\n'
    printf 'PASS %d  FAIL %d  SKIP %d\n' "$TOTAL_PASS" "$TOTAL_FAIL" "$TOTAL_SKIP"
    [[ "$TOTAL_FAIL" -eq 0 ]]
    exit $?
fi

section "Route availability"
api GET /api/v1/meta

if [[ "$LAST_STATUS" == "404" ]]; then
    if [[ "$MODE" == "full" ]]; then
        bad "GET /api/v1/meta is missing (T07 not implemented)"
    else
        skip "Management API is not implemented yet (T07/T09); stopping after live checks"
        printf '\nPASS %d  FAIL %d  SKIP %d\n' "$TOTAL_PASS" "$TOTAL_FAIL" "$TOTAL_SKIP"
        [[ "$TOTAL_FAIL" -eq 0 ]]
        exit $?
    fi
elif [[ "$LAST_STATUS" != "200" ]]; then
    bad "GET /api/v1/meta returned $LAST_STATUS"
    show_body
else
    ok "GET /api/v1/meta returns 200"
fi

if [[ "$LAST_STATUS" == "200" ]]; then
    section "Meta"
    expect_json_true '.methods | length >= 4' "meta exposes at least four methods"
    expect_json_true '.successStatuses | index(200) != null' "meta exposes success statuses"
    expect_json_true '.limits.maxListSize > 0' "meta exposes configured limits"
    expect_json_true '.generators | map(.name) | index("randomInt") != null' "meta lists randomInt"
    expect_json_true '.generators | map(.name) | index("uuid") != null' "meta lists uuid"
    expect_json_true '.projectLifetimeDays > 0' "meta exposes project lifetime"

    section "Inference"
    if api POST /api/v1/infer "$(jq -n --argjson sample "$SAMPLE" '{sample: $sample, options: {wrapInList: true}}')"; then
        expect_status 200 "POST /api/v1/infer returns 200"
        expect_json '.schema.version' '1' "inferred schema version is 1"
        expect_json '.schema.root.type' 'array' "wrapInList produces an array root"
        expect_json_true '.warnings | type == "array"' "inference returns warnings"
        expect_json_true '.suggestions | type == "object"' "inference returns suggestions"
        SCHEMA_JSON="$(jq -c '.schema' <<<"$LAST_BODY")"
        printf '%s' "$SCHEMA_JSON" >"$SCHEMA_FILE"
    else
        bad "POST /api/v1/infer failed to send"
        SCHEMA_JSON=""
    fi

    api POST /api/v1/infer '{"sample":42}'
    expect_status 422 "scalar sample returns 422"
    expect_json '.code' 'sample_invalid' "scalar sample uses sample_invalid"

    api POST /api/v1/infer '{}'
    expect_status 400 "missing sample returns 400"
    expect_json '.code' 'validation_failed' "missing sample uses validation_failed"
    expect_json_true '.errors.sample | type == "array"' "missing sample is reported under errors.sample"

    api POST /api/v1/infer '{"sample":{"a":1},"typo":true}'
    expect_status 400 "unknown infer property returns 400"
    expect_json '.code' 'validation_failed' "unknown infer property uses validation_failed"
fi

if [[ -n "${SCHEMA_JSON:-}" ]]; then
    section "Preview"
    PREVIEW_REQUEST="$(jq -n --argjson schema "$SCHEMA_JSON" \
        '{schema: $schema, settings: {list: {size: {min: 3, max: 3}}}}')"

    api POST /api/v1/preview "$PREVIEW_REQUEST"
    expect_status 200 "POST /api/v1/preview returns 200"
    expect_json '.data | length' '3' "preview honours list.size 3..3"
    expect_json '.pagination' 'null' "non-paginated preview has pagination null"

    PAGED_PREVIEW_REQUEST="$(jq -n --argjson schema "$SCHEMA_JSON" \
        '{schema: $schema, page: 2, limit: 10, settings: {pagination: {enabled: true, totalItems: 25, defaultLimit: 10, maxLimit: 100}}}')"

    api POST /api/v1/preview "$PAGED_PREVIEW_REQUEST"
    expect_status 200 "paginated preview returns 200"
    expect_json '.data | length' '10' "paginated preview honours page limit"
    expect_json '.pagination.page' '2' "paginated preview reports page"
    expect_json '.pagination.limit' '10' "paginated preview reports limit"
    expect_json '.pagination.totalItems' '25' "paginated preview reports totalItems"
    expect_json '.pagination.totalPages' '3' "paginated preview reports totalPages"
    expect_header_eq 'X-Page' '2' "preview sends X-Page"
    expect_header_eq 'X-Total-Count' '25' "preview sends X-Total-Count"
    expect_header_regex 'Link' 'rel="next"' "preview sends a next Link"

    api POST /api/v1/preview "$(jq -n --argjson schema "$SCHEMA_JSON" \
        '{schema: $schema, settings: {delay: {minMs: 100, maxMs: 10}}}')"
    expect_status 400 "invalid preview settings return 400"
    expect_json '.code' 'validation_failed' "invalid preview settings use validation_failed"
    expect_json_true '.errors["settings.delay.maxMs"] != null' "invalid delay is reported by settings path"

    section "Create project"
    CREATE_REQUEST="$(jq -n --argjson schema "$SCHEMA_JSON" '
        {
          name: "API smoke test",
          endpoints: [{
            method: "GET",
            path: "/users",
            schema: $schema,
            settings: {
              delay: {minMs: 0, maxMs: 0},
              errors: {ratePercent: 0, statusCodes: [500]},
              list: {size: {min: 3, max: 3}}
            }
          }]
        }')"

    api POST /api/v1/projects "$CREATE_REQUEST"
    expect_status 201 "POST /api/v1/projects returns 201"

    if [[ "$LAST_STATUS" == "201" ]]; then
        PROJECT_SLUG="$(jq -r '.slug // empty' <<<"$LAST_BODY")"
        EDIT_TOKEN="$(jq -r '.editToken // empty' <<<"$LAST_BODY")"

        expect_regex "$PROJECT_SLUG" '^[A-Za-z0-9_-]{4,32}$' "project slug has a valid format"
        expect_regex "$EDIT_TOKEN" '^et_[A-Za-z0-9_-]{43}$' "edit token has the documented format"
        expect_json_true '.endpoints | length == 1' "project contains one endpoint"
        expect_json_true '.endpoints[0].url | endswith("/users")' "endpoint url ends with /users"
        expect_json_true '(. as $p | $p.baseUrl | contains($p.slug))' "baseUrl contains the slug"
        expect_header_eq 'Location' "/api/v1/projects/$PROJECT_SLUG" "project creation returns Location"

        if [[ -z "$PROJECT_SLUG" || -z "$EDIT_TOKEN" ]]; then
            bad "project response did not include slug and editToken"
            show_body
        else
            RUNTIME_BASE="$BASE_URL/m/$PROJECT_SLUG"

            section "Project authentication"
            api GET "/api/v1/projects/$PROJECT_SLUG"
            expect_status 401 "project without token returns 401"
            expect_json '.code' 'missing_token' "project without token uses missing_token"
            expect_header_eq 'WWW-Authenticate' 'Bearer' "401 sends WWW-Authenticate"

            api GET "/api/v1/projects/$PROJECT_SLUG" '' "$WRONG_TOKEN"
            expect_status 403 "project with wrong token returns 403"
            expect_json '.code' 'invalid_token' "wrong token uses invalid_token"

            api GET "/api/v1/projects/nosuchslug" '' "$EDIT_TOKEN"
            expect_status 404 "unknown project returns 404 before auth"
            expect_json '.code' 'project_not_found' "unknown project uses project_not_found"

            api GET "/api/v1/projects/$PROJECT_SLUG" '' "$EDIT_TOKEN"
            expect_status 200 "project with valid token returns 200"
            expect_json '.slug' "$PROJECT_SLUG" "project response has the requested slug"
            expect_json '.name' 'API smoke test' "project response has the requested name"
            expect_json_true '.usage.requestsToday >= 0' "project response includes usage"
            expect_json_true '.endpoints | length == 1' "project response includes endpoints"
        fi
    fi
fi

if [[ -n "$PROJECT_SLUG" && -n "$EDIT_TOKEN" ]]; then
    section "Endpoint CRUD"

    SLOW_REQUEST='{"method":"GET","path":"/slow","sample":{"ok":true},"settings":{"delay":{"minMs":120,"maxMs":120}}}'
    api POST "/api/v1/projects/$PROJECT_SLUG/endpoints" "$SLOW_REQUEST" "$EDIT_TOKEN"
    expect_status 201 "create endpoint returns 201"
    SLOW_ENDPOINT_ID="$(jq -r '.id // empty' <<<"$LAST_BODY")"
    expect_regex "$SLOW_ENDPOINT_ID" '^[0-9a-fA-F-]{36}$' "created endpoint has an id"
    expect_header_eq 'Location' "/api/v1/projects/$PROJECT_SLUG/endpoints/$SLOW_ENDPOINT_ID" "endpoint creation returns Location"

    api POST "/api/v1/projects/$PROJECT_SLUG/endpoints" "$SLOW_REQUEST" "$EDIT_TOKEN"
    expect_status 409 "duplicate endpoint returns 409"
    expect_json '.code' 'duplicate_endpoint' "duplicate endpoint uses duplicate_endpoint"

    if [[ -n "$SLOW_ENDPOINT_ID" ]]; then
        api GET "/api/v1/projects/$PROJECT_SLUG/endpoints/$SLOW_ENDPOINT_ID" '' "$EDIT_TOKEN"
        expect_status 200 "GET endpoint returns 200"
        expect_json '.path' '/slow' "GET endpoint returns the requested path"

        api PUT "/api/v1/projects/$PROJECT_SLUG/endpoints/$SLOW_ENDPOINT_ID/settings" \
            '{"delay":{"minMs":120,"maxMs":120}}' "$EDIT_TOKEN"
        expect_status 200 "PUT endpoint settings returns 200"
        expect_json '.settings.delay.minMs' '120' "endpoint settings were replaced"
    fi

    FLAKY_REQUEST='{"method":"GET","path":"/flaky","sample":{"ok":true},"settings":{"delay":{"minMs":0,"maxMs":0},"errors":{"ratePercent":100,"statusCodes":[503]}}}'
    api POST "/api/v1/projects/$PROJECT_SLUG/endpoints" "$FLAKY_REQUEST" "$EDIT_TOKEN"
    expect_status 201 "create flaky endpoint returns 201"

    PAGED_REQUEST='{"method":"GET","path":"/paged","sample":[{"id":1,"name":"Alpha"}],"settings":{"delay":{"minMs":0,"maxMs":0},"pagination":{"enabled":true,"totalItems":25,"defaultLimit":10,"maxLimit":100}}}'
    api POST "/api/v1/projects/$PROJECT_SLUG/endpoints" "$PAGED_REQUEST" "$EDIT_TOKEN"
    expect_status 201 "create paginated endpoint returns 201"

    DELETE_REQUEST='{"method":"DELETE","path":"/delete-me","sample":{"ok":true}}'
    api POST "/api/v1/projects/$PROJECT_SLUG/endpoints" "$DELETE_REQUEST" "$EDIT_TOKEN"
    expect_status 201 "create disposable endpoint returns 201"
    DISPOSABLE_ID="$(jq -r '.id // empty' <<<"$LAST_BODY")"

    if [[ -n "$DISPOSABLE_ID" ]]; then
        api DELETE "/api/v1/projects/$PROJECT_SLUG/endpoints/$DISPOSABLE_ID" '' "$EDIT_TOKEN"
        expect_status 204 "DELETE endpoint returns 204"

        api GET "/api/v1/projects/$PROJECT_SLUG/endpoints/$DISPOSABLE_ID" '' "$EDIT_TOKEN"
        expect_status 404 "deleted endpoint returns 404"
        expect_json '.code' 'endpoint_not_found' "deleted endpoint uses endpoint_not_found"
    fi

    section "Runtime basics"
    request_safe GET "$RUNTIME_BASE/users"
    expect_status 200 "runtime GET returns 200"
    expect_json '. | length' '3' "runtime honours list.size 3..3"
    expect_header_regex 'X-Request-Id' '^[0-9a-fA-F-]{36}$' "runtime sends X-Request-Id"
    expect_header_eq 'X-Mock-Delay-Ms' '0' "runtime reports zero delay"
    expect_header_eq 'X-Mock-Injected-Error' 'false' "runtime reports no injected error"
    expect_header_eq 'Access-Control-Allow-Origin' '*' "runtime sends CORS origin"
    expect_header_eq 'Cache-Control' 'no-store' "runtime sends no-store"

    request_safe OPTIONS "$RUNTIME_BASE/users"
    expect_status 204 "runtime OPTIONS returns 204"
    expect_header_eq 'Access-Control-Allow-Origin' '*' "preflight sends CORS origin"
    expect_header_regex 'Access-Control-Allow-Methods' 'GET' "preflight allows GET"

    request_safe PATCH "$RUNTIME_BASE/users" '{}'
    expect_status 405 "unsupported runtime method returns 405"
    expect_json '.error.code' 'method_not_allowed' "unsupported method uses method_not_allowed"
    expect_header_regex 'Allow' 'GET' "405 sends Allow"

    request_safe GET "$RUNTIME_BASE/does-not-exist"
    expect_status 404 "unknown runtime path returns 404"
    expect_json '.error.code' 'endpoint_not_found' "unknown runtime path uses endpoint_not_found"

    section "Runtime delay"
    request_safe GET "$RUNTIME_BASE/slow"
    expect_status 200 "delayed runtime endpoint returns 200"
    expect_header_eq 'X-Mock-Delay-Ms' '120' "runtime applies the configured delay"

    section "Injected errors"
    request_safe GET "$RUNTIME_BASE/flaky"
    expect_status 503 "injected error returns the configured status"
    expect_json '.error.status' '503' "injected error body has the status"
    expect_json '.error.code' 'injected_error' "injected error body has the code"
    expect_json_true '.error.injected == true' "injected error body is marked injected"
    expect_json_true '.error.requestId != null' "injected error body has a request id"
    expect_header_eq 'X-Mock-Injected-Error' 'true' "injected error header is true"
    expect_header_eq 'Retry-After' '3' "injected 503 sends Retry-After"

    section "Runtime pagination"
    request_safe GET "$RUNTIME_BASE/paged?page=2&limit=10"
    expect_status 200 "paginated runtime response returns 200"
    expect_json '. | length' '10' "paginated runtime returns the page size"
    expect_json '.[0].id' '11' "autoId continues from the page offset"
    expect_header_eq 'X-Total-Count' '25' "pagination sends X-Total-Count"
    expect_header_eq 'X-Page' '2' "pagination sends X-Page"
    expect_header_eq 'X-Limit' '10' "pagination sends X-Limit"
    expect_header_eq 'X-Total-Pages' '3' "pagination sends X-Total-Pages"
    expect_header_regex 'Link' 'page=3' "pagination Link points to the next page"

    request_safe GET "$RUNTIME_BASE/paged?page=2&limit=1000"
    expect_status 200 "over-limit pagination is accepted"
    expect_header_eq 'X-Limit' '100' "limit is clamped to maxLimit"

    request_safe GET "$RUNTIME_BASE/paged?page=0&limit=10"
    expect_status 400 "invalid page returns 400"
    expect_json '.error.code' 'invalid_pagination' "invalid page uses invalid_pagination"
fi

if [[ -n "$PROJECT_SLUG" && -n "$EDIT_TOKEN" ]]; then
    section "Logs"
    LOGS_AVAILABLE=0

    for _ in 1 2 3 4 5 6 7 8 9 10; do
        api GET "/api/v1/projects/$PROJECT_SLUG/logs?limit=10" '' "$EDIT_TOKEN"

        if [[ "$LAST_STATUS" == "200" ]] && jq -e '.items | length > 0' >/dev/null 2>&1 <<<"$LAST_BODY"; then
            LOGS_AVAILABLE=1
            break
        fi

        if [[ "$LAST_STATUS" == "404" ]]; then
            break
        fi

        if [[ "$LAST_STATUS" != "200" ]]; then
            break
        fi

        sleep 0.5
    done

    if [[ "$LAST_STATUS" == "404" ]]; then
        if [[ "$MODE" == "full" ]]; then
            bad "GET /api/v1/projects/{slug}/logs is missing (T13 not implemented)"
        else
            skip "Request logs are not implemented yet (T13)"
        fi
    elif [[ "$LOGS_AVAILABLE" -eq 1 ]]; then
        ok "GET /api/v1/projects/{slug}/logs returns captured requests"
        expect_json_true '.items | length >= 1' "logs contain at least one item"
        expect_json_true '.items[0].requestId != null' "log item has a request id"
        expect_json_true '.items[0].status >= 100' "log item has a status"
        expect_json_true '.latestId != null' "logs return latestId"

        api DELETE "/api/v1/projects/$PROJECT_SLUG/logs" '' "$EDIT_TOKEN"
        expect_status 204 "DELETE logs returns 204"
    else
        bad "logs did not return captured runtime requests (status $LAST_STATUS)"
        show_body
    fi

    section "Project update and cleanup"
    api PATCH "/api/v1/projects/$PROJECT_SLUG" '{"name":"Renamed smoke test"}' "$EDIT_TOKEN"
    expect_status 200 "PATCH project returns 200"
    expect_json '.name' 'Renamed smoke test' "PATCH project updates the name"

    api DELETE "/api/v1/projects/$PROJECT_SLUG" '' "$EDIT_TOKEN"
    expect_status 204 "DELETE project returns 204"
    DELETED_SLUG="$PROJECT_SLUG"
    PROJECT_SLUG=""
    EDIT_TOKEN=""

    if [[ -n "$DELETED_SLUG" ]]; then
        api GET "/api/v1/projects/$DELETED_SLUG"
        expect_status 404 "deleted project returns 404"
        expect_json '.code' 'project_not_found' "deleted project uses project_not_found"
    fi
fi

printf '\n%sSummary%s\n' "$C_BLUE" "$C_RESET"
printf '  PASS %d\n' "$TOTAL_PASS"
printf '  FAIL %d\n' "$TOTAL_FAIL"
printf '  SKIP %d\n' "$TOTAL_SKIP"
printf '  Base URL %s\n' "$BASE_URL"

if [[ "$TOTAL_FAIL" -gt 0 ]]; then
    exit 1
fi

exit 0

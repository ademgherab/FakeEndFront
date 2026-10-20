namespace MockApi.Core.Errors;

/// <summary>
/// A single entry of the stable error catalog (the missing Appendix B of the technical spec).
/// </summary>
public sealed record ErrorCodeDefinition(string Code, int Status, string Title, string When);

/// <summary>
/// Stable machine-readable error codes. The frontend switches on these values, so existing
/// codes must never change. <see cref="All"/> is the source of truth for
/// <c>docs/error-catalog.md</c> and for the management/runtime error factories.
/// </summary>
public static class ErrorCodes
{
    public const string ValidationFailed = "validation_failed";
    public const string SampleInvalid = "sample_invalid";
    public const string SampleTooComplex = "sample_too_complex";
    public const string ResponseTooLarge = "response_too_large";
    public const string EndpointLimitReached = "endpoint_limit_reached";
    public const string DuplicateEndpoint = "duplicate_endpoint";
    public const string EndpointNotFound = "endpoint_not_found";
    public const string ProjectNotFound = "project_not_found";
    public const string ProjectExpired = "project_expired";
    public const string MissingToken = "missing_token";
    public const string InvalidToken = "invalid_token";
    public const string RateLimited = "rate_limited";
    public const string DailyQuotaExceeded = "daily_quota_exceeded";
    public const string InvalidPagination = "invalid_pagination";
    public const string MethodNotAllowed = "method_not_allowed";
    public const string PayloadTooLarge = "payload_too_large";
    public const string UnsupportedMediaType = "unsupported_media_type";
    public const string GenerationFailed = "generation_failed";
    public const string InjectedError = "injected_error";
    public const string InternalError = "internal_error";

    /// <summary>
    /// Used only for framework-level route misses (for example a request to an unknown
    /// <c>/api/v1</c> path). Domain endpoints must use a more specific code such as
    /// <see cref="ProjectNotFound"/> or <see cref="EndpointNotFound"/>.
    /// </summary>
    public const string NotFound = "not_found";

    /// <summary>
    /// Every code in the catalog, in a stable order suitable for documentation and tests.
    /// </summary>
    public static IReadOnlyList<ErrorCodeDefinition> All { get; } =
    [
        new(
            ValidationFailed,
            400,
            "One or more validation errors occurred.",
            "Malformed JSON, an unknown property, a wrong value type, or a validation rule failed."
        ),
        new(
            SampleInvalid,
            422,
            "The sample is invalid.",
            "The sample root is a scalar or null, or cannot be used to infer a schema."
        ),
        new(
            SampleTooComplex,
            422,
            "The sample is too complex.",
            "The sample exceeds the configured size, node, or depth limits."
        ),
        new(
            ResponseTooLarge,
            422,
            "The generated response would be too large.",
            "Generating the endpoint or preview would exceed the configured value limit."
        ),
        new(
            EndpointLimitReached,
            422,
            "The endpoint limit was reached.",
            "The project already contains the maximum number of endpoints."
        ),
        new(
            DuplicateEndpoint,
            409,
            "The endpoint already exists.",
            "Another endpoint in the project has the same method and normalized path."
        ),
        new(
            EndpointNotFound,
            404,
            "Endpoint not found.",
            "The requested endpoint does not exist in this project."
        ),
        new(
            ProjectNotFound,
            404,
            "Project not found.",
            "The project slug does not exist or the project has been purged."
        ),
        new(
            ProjectExpired,
            410,
            "Project expired.",
            "The project is past its expiry time and no longer accepts requests."
        ),
        new(
            MissingToken,
            401,
            "Authentication required.",
            "The Authorization header is missing or is not a Bearer token."
        ),
        new(
            InvalidToken,
            403,
            "Invalid token.",
            "The Bearer token does not belong to this project."
        ),
        new(
            RateLimited,
            429,
            "Too many requests.",
            "A management or runtime rate limit was exceeded."
        ),
        new(
            DailyQuotaExceeded,
            429,
            "Daily quota exceeded.",
            "The project reached its requests-per-UTC-day quota."
        ),
        new(
            InvalidPagination,
            400,
            "Invalid pagination.",
            "The page or limit query parameter is out of range."
        ),
        new(
            MethodNotAllowed,
            405,
            "Method not allowed.",
            "The route exists but does not support the requested HTTP method."
        ),
        new(
            PayloadTooLarge,
            413,
            "Payload too large.",
            "The request body exceeds the configured size limit."
        ),
        new(
            UnsupportedMediaType,
            415,
            "Unsupported media type.",
            "A request with a body must use application/json."
        ),
        new(
            GenerationFailed,
            500,
            "Generation failed.",
            "Unexpected failure while generating the mock response."
        ),
        new(
            InjectedError,
            503,
            "Injected error.",
            "A simulated error injected by the project's error settings. The actual status is the injected status."
        ),
        new(
            InternalError,
            500,
            "Internal server error.",
            "An unexpected error occurred on the server."
        ),
        new(
            NotFound,
            404,
            "Not found.",
            "No route matched the request. Only used for framework-level route misses."
        ),
    ];

    private static readonly IReadOnlyDictionary<string, ErrorCodeDefinition> ByCode =
        All.ToDictionary(definition => definition.Code, StringComparer.Ordinal);

    public static bool TryGet(string code, out ErrorCodeDefinition definition) =>
        ByCode.TryGetValue(code, out definition!);

    public static ErrorCodeDefinition Get(string code) =>
        ByCode.TryGetValue(code, out var definition)
            ? definition
            : throw new KeyNotFoundException($"Unknown error code '{code}'.");
}

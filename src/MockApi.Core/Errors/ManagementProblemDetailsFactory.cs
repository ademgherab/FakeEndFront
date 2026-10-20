using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using MockApi.Core.Configuration;
using MockApi.Core.Serialization;

namespace MockApi.Core.Errors;

/// <summary>
/// The exact RFC 9457 body required by spec §3.1. <see cref="Errors"/> is serialized only when
/// present (validation_failed / sample_invalid).
/// </summary>
public sealed class ManagementErrorResponse
{
    public required string Type { get; init; }

    public required string Title { get; init; }

    public required int Status { get; init; }

    public required string Code { get; init; }

    public required string Detail { get; init; }

    public required string TraceId { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyDictionary<string, string[]>? Errors { get; init; }
}

/// <summary>
/// Creates and writes the Management API error contract. Also supplies MVC's invalid-model-state
/// response so malformed JSON and unknown properties use the same shape instead of the framework
/// default.
/// </summary>
public sealed class ManagementProblemDetailsFactory
{
    public const string ProblemContentType = "application/problem+json; charset=utf-8";

    private const string ValidationDetail = "See 'errors' for details.";

    private static readonly JsonSerializerOptions SerializerOptions = JsonDefaults.Create();

    private readonly ErrorsOptions _options;

    public ManagementProblemDetailsFactory(IOptions<ErrorsOptions> options)
    {
        ArgumentNullException.ThrowIfNull(options);
        _options = options.Value;
    }

    public ManagementErrorResponse Create(
        int status,
        string code,
        string? detail = null,
        IReadOnlyDictionary<string, string[]>? errors = null,
        string? traceId = null
    )
    {
        var definition = ErrorCodes.Get(code);

        return new ManagementErrorResponse
        {
            Type = _options.BuildTypeUrl(code),
            Title = definition.Title,
            Status = status,
            Code = code,
            Detail = detail ?? definition.Title,
            TraceId = traceId ?? string.Empty,
            Errors = errors,
        };
    }

    public ManagementErrorResponse Create(ApiException exception, string traceId)
    {
        ArgumentNullException.ThrowIfNull(exception);

        return new ManagementErrorResponse
        {
            Type = _options.BuildTypeUrl(exception.Code),
            Title = exception.Title,
            Status = exception.Status,
            Code = exception.Code,
            Detail = exception.Detail,
            TraceId = traceId,
            Errors = exception.Errors,
        };
    }

    public IActionResult ModelStateResult(ActionContext actionContext)
    {
        ArgumentNullException.ThrowIfNull(actionContext);

        var errors = ModelStateErrorMapper.Map(actionContext.ModelState);
        var response = Create(
            400,
            ErrorCodes.ValidationFailed,
            ValidationDetail,
            errors,
            RequestContext.GetRequestId(actionContext.HttpContext)
        );

        return new ContentResult
        {
            StatusCode = 400,
            ContentType = ProblemContentType,
            Content = JsonSerializer.Serialize(response, SerializerOptions),
        };
    }

    public Task WriteAsync(
        HttpContext context,
        ApiException exception,
        int? retryAfterSeconds = null
    )
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(exception);

        var response = Create(exception, RequestContext.GetRequestId(context));
        return WriteAsync(context, response, retryAfterSeconds ?? exception.RetryAfterSeconds);
    }

    public async Task WriteAsync(
        HttpContext context,
        ManagementErrorResponse response,
        int? retryAfterSeconds = null
    )
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(response);

        if (context.Response.HasStarted)
        {
            return;
        }

        ApplyStandardHeaders(context, response.Status, retryAfterSeconds);

        context.Response.StatusCode = response.Status;
        context.Response.ContentType = ProblemContentType;

        var json = JsonSerializer.Serialize(response, SerializerOptions);
        context.Response.ContentLength = Encoding.UTF8.GetByteCount(json);
        await context.Response.WriteAsync(json, context.RequestAborted);
    }

    private static void ApplyStandardHeaders(
        HttpContext context,
        int status,
        int? retryAfterSeconds
    )
    {
        var headers = context.Response.Headers;

        if (status == 401 && !headers.ContainsKey("WWW-Authenticate"))
        {
            headers.WWWAuthenticate = "Bearer";
        }

        if (status == 429 && !headers.ContainsKey("Retry-After"))
        {
            headers.RetryAfter = (retryAfterSeconds ?? 3).ToString(CultureInfo.InvariantCulture);
        }
    }
}

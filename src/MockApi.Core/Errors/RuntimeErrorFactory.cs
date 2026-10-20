using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;
using MockApi.Core.Serialization;

namespace MockApi.Core.Errors;

/// <summary>
/// The exact runtime error body required by spec §9.3. It intentionally has no other members:
/// the six <c>error.*</c> keys are the public runtime contract.
/// </summary>
public sealed class RuntimeErrorResponse
{
    public required RuntimeErrorBody Error { get; init; }
}

public sealed class RuntimeErrorBody
{
    public required int Status { get; init; }

    public required string Code { get; init; }

    public required string Title { get; init; }

    public required string Message { get; init; }

    public required bool Injected { get; init; }

    public required string RequestId { get; init; }
}

/// <summary>
/// Builds and writes the mock runtime error envelope. The runtime routes themselves (T11) only
/// need to call <see cref="WriteInjectedAsync"/> or <see cref="WriteSystemAsync"/>.
/// </summary>
public sealed class RuntimeErrorFactory
{
    public const string JsonContentType = "application/json; charset=utf-8";

    public const string DefaultInjectedMessage = "Simulated error injected by MockAPI.";

    public const int InjectedRetryAfterSeconds = 3;

    private static readonly JsonSerializerOptions SerializerOptions = JsonDefaults.Create();

    public RuntimeErrorResponse CreateSystem(
        int status,
        string code,
        string? message = null,
        string? requestId = null
    )
    {
        var definition = ErrorCodes.Get(code);

        return new RuntimeErrorResponse
        {
            Error = new RuntimeErrorBody
            {
                Status = status,
                Code = code,
                Title = definition.Title,
                Message = message ?? definition.Title,
                Injected = false,
                RequestId = requestId ?? string.Empty,
            },
        };
    }

    public RuntimeErrorResponse CreateInjected(
        int status,
        string? message = null,
        string? requestId = null
    )
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(status, 400);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(status, 599);

        var title = ReasonPhrases.GetReasonPhrase(status);

        return new RuntimeErrorResponse
        {
            Error = new RuntimeErrorBody
            {
                Status = status,
                Code = ErrorCodes.InjectedError,
                Title = string.IsNullOrEmpty(title)
                    ? ErrorCodes.Get(ErrorCodes.InjectedError).Title
                    : title,
                Message = message ?? DefaultInjectedMessage,
                Injected = true,
                RequestId = requestId ?? string.Empty,
            },
        };
    }

    public Task WriteSystemAsync(
        HttpContext context,
        int status,
        string code,
        string? message = null,
        int? retryAfterSeconds = null
    )
    {
        ArgumentNullException.ThrowIfNull(context);

        return WriteAsync(
            context,
            CreateSystem(status, code, message, RequestContext.GetRequestId(context)),
            retryAfterSeconds
        );
    }

    public Task WriteInjectedAsync(
        HttpContext context,
        int status,
        string? message = null,
        int retryAfterSeconds = InjectedRetryAfterSeconds
    )
    {
        ArgumentNullException.ThrowIfNull(context);

        return WriteAsync(
            context,
            CreateInjected(status, message, RequestContext.GetRequestId(context)),
            retryAfterSeconds
        );
    }

    public async Task WriteAsync(
        HttpContext context,
        RuntimeErrorResponse response,
        int? retryAfterSeconds = null
    )
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(response);

        if (context.Response.HasStarted)
        {
            return;
        }

        var error = response.Error;

        context.Response.StatusCode = error.Status;
        context.Response.ContentType = JsonContentType;
        context.Response.Headers.CacheControl = "no-store";

        if (error.Status == 429 || (error.Injected && error.Status == 503))
        {
            var seconds = retryAfterSeconds ?? InjectedRetryAfterSeconds;
            context.Response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);
        }

        var json = JsonSerializer.Serialize(response, SerializerOptions);
        context.Response.ContentLength = Encoding.UTF8.GetByteCount(json);
        await context.Response.WriteAsync(json, context.RequestAborted);
    }
}

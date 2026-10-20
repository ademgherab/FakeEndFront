using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;
using MockApi.Core.Configuration;

namespace MockApi.Core.Errors;

/// <summary>
/// Enforces the management transport contract before MVC reads the body: bodies larger than
/// <see cref="LimitsOptions.MaxRequestBodyBytes"/> return 413 and non-JSON bodies return 415, both
/// with the normal ProblemDetails body.
/// </summary>
public sealed class ManagementTransportMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ManagementProblemDetailsFactory _problems;
    private readonly MockApiOptions _options;

    public ManagementTransportMiddleware(
        RequestDelegate next,
        ManagementProblemDetailsFactory problems,
        IOptions<MockApiOptions> options
    )
    {
        _next = next;
        _problems = problems;
        _options = options.Value;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments("/api/v1", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        if (HasRequestBody(context.Request))
        {
            if (
                context.Request.ContentLength is > 0
                && context.Request.ContentLength > _options.Limits.MaxRequestBodyBytes
            )
            {
                await WriteAsync(
                    context,
                    StatusCodes.Status413PayloadTooLarge,
                    ErrorCodes.PayloadTooLarge,
                    "The request body exceeds the configured size limit."
                );
                return;
            }

            if (!IsJsonContentType(context.Request.ContentType))
            {
                await WriteAsync(
                    context,
                    StatusCodes.Status415UnsupportedMediaType,
                    ErrorCodes.UnsupportedMediaType,
                    "A request with a body must use application/json."
                );
                return;
            }
        }

        await _next(context);
    }

    private Task WriteAsync(HttpContext context, int status, string code, string detail)
    {
        var response = _problems.Create(
            status,
            code,
            detail,
            errors: null,
            traceId: RequestContext.GetRequestId(context)
        );

        return _problems.WriteAsync(context, response);
    }

    private static bool HasRequestBody(HttpRequest request) =>
        request.ContentLength is > 0 || request.Headers.ContainsKey(HeaderNames.TransferEncoding);

    private static bool IsJsonContentType(string? contentType)
    {
        if (string.IsNullOrWhiteSpace(contentType))
        {
            return false;
        }

        var mediaType = contentType.Split(';', 2)[0].Trim();

        return mediaType.Equals("application/json", StringComparison.OrdinalIgnoreCase)
            || (
                mediaType.StartsWith("application/", StringComparison.OrdinalIgnoreCase)
                && mediaType.EndsWith("+json", StringComparison.OrdinalIgnoreCase)
            );
    }
}

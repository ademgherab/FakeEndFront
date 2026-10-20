using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace MockApi.Core.Errors;

/// <summary>
/// Converts every failure into the surface-specific error body. Management errors use RFC 9457
/// ProblemDetails from <see cref="ManagementProblemDetailsFactory"/>; unexpected exceptions never
/// leak stack traces, inner messages, connection strings, or C# type names.
/// </summary>
public sealed class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ManagementProblemDetailsFactory _problems;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    public ErrorHandlingMiddleware(
        RequestDelegate next,
        ManagementProblemDetailsFactory problems,
        ILogger<ErrorHandlingMiddleware> logger
    )
    {
        _next = next;
        _problems = problems;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);

            if (ShouldWriteFallback(context))
            {
                await WriteFallbackAsync(context);
            }
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The client disconnected; there is nobody left to receive an error body.
        }
        catch (ApiException exception)
        {
            await WriteApiExceptionAsync(context, exception);
        }
        catch (BadHttpRequestException exception)
        {
            var status =
                exception.StatusCode == StatusCodes.Status413PayloadTooLarge
                    ? StatusCodes.Status413PayloadTooLarge
                    : StatusCodes.Status400BadRequest;

            await WriteAsync(
                context,
                status,
                status == StatusCodes.Status413PayloadTooLarge
                    ? ErrorCodes.PayloadTooLarge
                    : ErrorCodes.ValidationFailed,
                status == StatusCodes.Status413PayloadTooLarge
                    ? "The request body exceeds the configured size limit."
                    : "The request body is invalid.",
                errors: null
            );
        }
        catch (JsonException exception)
        {
            await WriteJsonExceptionAsync(context, exception);
        }
        catch (Exception exception)
        {
            await WriteUnexpectedAsync(context, exception);
        }
    }

    private async Task WriteApiExceptionAsync(HttpContext context, ApiException exception)
    {
        if (context.Response.HasStarted)
        {
            _logger.LogWarning(
                "Cannot write management error {Code} because the response already started. RequestId: {RequestId}.",
                exception.Code,
                RequestContext.GetRequestId(context)
            );
            return;
        }

        await _problems.WriteAsync(context, exception);
    }

    private async Task WriteJsonExceptionAsync(HttpContext context, JsonException exception)
    {
        var path = ErrorPaths.Normalize(exception.Path);
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            [path] = ["The value is invalid."],
        };

        await WriteAsync(
            context,
            StatusCodes.Status400BadRequest,
            ErrorCodes.ValidationFailed,
            "See 'errors' for details.",
            errors
        );
    }

    private async Task WriteUnexpectedAsync(HttpContext context, Exception exception)
    {
        var requestId = RequestContext.GetRequestId(context);

        _logger.LogError(
            exception,
            "Unhandled exception while processing request {RequestId}.",
            requestId
        );

        if (context.Response.HasStarted)
        {
            _logger.LogWarning(
                "Cannot write internal_error because the response already started. RequestId: {RequestId}.",
                requestId
            );
            return;
        }

        await WriteAsync(
            context,
            StatusCodes.Status500InternalServerError,
            ErrorCodes.InternalError,
            "An unexpected error occurred.",
            errors: null
        );
    }

    private async Task WriteFallbackAsync(HttpContext context)
    {
        var status = context.Response.StatusCode;
        var (code, detail) = MapStatus(status);

        await WriteAsync(context, status, code, detail, errors: null);
    }

    private Task WriteAsync(
        HttpContext context,
        int status,
        string code,
        string detail,
        IReadOnlyDictionary<string, string[]>? errors
    )
    {
        var response = _problems.Create(
            status,
            code,
            detail,
            errors,
            RequestContext.GetRequestId(context)
        );

        return _problems.WriteAsync(context, response);
    }

    private static bool ShouldWriteFallback(HttpContext context)
    {
        var status = context.Response.StatusCode;

        if (
            status < 400
            || status is StatusCodes.Status204NoContent or StatusCodes.Status304NotModified
        )
        {
            return false;
        }

        if (context.Response.HasStarted || context.Response.ContentLength is > 0)
        {
            return false;
        }

        return !context.Request.Path.StartsWithSegments("/health");
    }

    private static (string Code, string Detail) MapStatus(int status) =>
        status switch
        {
            StatusCodes.Status400BadRequest => (
                ErrorCodes.ValidationFailed,
                "The request could not be processed."
            ),
            StatusCodes.Status401Unauthorized => (
                ErrorCodes.MissingToken,
                "Authentication is required."
            ),
            StatusCodes.Status403Forbidden => (
                ErrorCodes.InvalidToken,
                "The token is not valid for this project."
            ),
            StatusCodes.Status404NotFound => (ErrorCodes.NotFound, "No route matched the request."),
            StatusCodes.Status405MethodNotAllowed => (
                ErrorCodes.MethodNotAllowed,
                "The route does not support this HTTP method."
            ),
            StatusCodes.Status410Gone => (
                ErrorCodes.ProjectExpired,
                "The project is no longer available."
            ),
            StatusCodes.Status413PayloadTooLarge => (
                ErrorCodes.PayloadTooLarge,
                "The request body exceeds the configured size limit."
            ),
            StatusCodes.Status415UnsupportedMediaType => (
                ErrorCodes.UnsupportedMediaType,
                "A request with a body must use application/json."
            ),
            StatusCodes.Status429TooManyRequests => (
                ErrorCodes.RateLimited,
                "Too many requests. Retry later."
            ),
            >= StatusCodes.Status500InternalServerError => (
                ErrorCodes.InternalError,
                "An unexpected error occurred."
            ),
            _ => (ErrorCodes.ValidationFailed, "The request could not be processed."),
        };
}

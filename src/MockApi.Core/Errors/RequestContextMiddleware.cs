using Microsoft.AspNetCore.Http;

namespace MockApi.Core.Errors;

/// <summary>
/// Outermost middleware: establishes the correlation id for every request. An inbound
/// <c>X-Request-Id</c> is honoured only when it is a GUID; otherwise a new GUID is generated.
/// The id is written to <see cref="HttpContext.TraceIdentifier"/>, request items, and the
/// response header for both successes and errors.
/// </summary>
public sealed class RequestContextMiddleware
{
    private readonly RequestDelegate _next;

    public RequestContextMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        var requestId = ResolveRequestId(context.Request.Headers[RequestContext.RequestIdHeader]);

        context.TraceIdentifier = requestId;
        context.Items[RequestContext.RequestIdItemKey] = requestId;

        context.Response.Headers[RequestContext.RequestIdHeader] = requestId;
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[RequestContext.RequestIdHeader] = requestId;
            return Task.CompletedTask;
        });

        return _next(context);
    }

    private static string ResolveRequestId(string? inbound)
    {
        if (!string.IsNullOrWhiteSpace(inbound) && Guid.TryParse(inbound, out var parsed))
        {
            return parsed.ToString("D");
        }

        return Guid.NewGuid().ToString("D");
    }
}

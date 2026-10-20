using Microsoft.AspNetCore.Http;

namespace MockApi.Core.Errors;

/// <summary>
/// Well-known keys used to correlate a request across the management and runtime surfaces.
/// </summary>
public static class RequestContext
{
    public const string RequestIdHeader = "X-Request-Id";

    public const string RequestIdItemKey = "MockApi.RequestId";

    public static string GetRequestId(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        return
            context.Items.TryGetValue(RequestIdItemKey, out var value)
            && value is string requestId
            && !string.IsNullOrEmpty(requestId)
            ? requestId
            : context.TraceIdentifier;
    }
}

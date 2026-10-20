using System.Diagnostics;
using Serilog.Context;

namespace MockApi.Api.Observability;

public static class RequestLoggingExtensions
{
    public const string RequestIdHeaderName = "X-Request-Id";

    public static IApplicationBuilder UseMockApiRequestLogging(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        return app.Use(
            async (context, next) =>
            {
                var logger = context
                    .RequestServices.GetRequiredService<ILoggerFactory>()
                    .CreateLogger("MockApi.Requests");

                var requestId = ResolveRequestId(context);
                context.TraceIdentifier = requestId;

                if (!context.Response.Headers.ContainsKey(RequestIdHeaderName))
                {
                    context.Response.Headers[RequestIdHeaderName] = requestId;
                }

                var traceId = Activity.Current?.TraceId.ToString() ?? requestId;
                var stopwatch = Stopwatch.StartNew();

                using (RequestCorrelationContext.Push(requestId, traceId))
                using (LogContext.PushProperty("RequestId", requestId))
                using (LogContext.PushProperty("TraceId", traceId))
                {
                    try
                    {
                        await next(context).ConfigureAwait(false);
                    }
                    catch (Exception exception)
                    {
                        stopwatch.Stop();
                        logger.LogError(
                            exception,
                            "HTTP {Method} {Path} failed after {ElapsedMs} ms",
                            context.Request.Method,
                            context.Request.Path.Value,
                            stopwatch.ElapsedMilliseconds
                        );
                        throw;
                    }

                    stopwatch.Stop();
                    logger.LogInformation(
                        "HTTP {Method} {Path} responded {StatusCode} in {ElapsedMs} ms",
                        context.Request.Method,
                        context.Request.Path.Value,
                        context.Response.StatusCode,
                        stopwatch.ElapsedMilliseconds
                    );
                }
            }
        );
    }

    private static string ResolveRequestId(HttpContext context)
    {
        if (Guid.TryParse(context.TraceIdentifier, out _))
        {
            return context.TraceIdentifier;
        }

        if (
            context.Request.Headers.TryGetValue(RequestIdHeaderName, out var headerValue)
            && Guid.TryParse(headerValue.ToString(), out _)
        )
        {
            return headerValue.ToString();
        }

        return Guid.NewGuid().ToString();
    }
}

using Serilog.Core;
using Serilog.Events;

namespace MockApi.Api.Observability;

internal static class RequestCorrelationContext
{
    private static readonly AsyncLocal<Correlation?> CurrentCorrelation = new();

    public static Correlation? Current => CurrentCorrelation.Value;

    public static IDisposable Push(string requestId, string traceId)
    {
        var previous = CurrentCorrelation.Value;
        CurrentCorrelation.Value = new Correlation(requestId, traceId);
        return new RestoreScope(previous);
    }

    internal sealed record Correlation(string RequestId, string TraceId);

    private sealed class RestoreScope(Correlation? previous) : IDisposable
    {
        public void Dispose() => CurrentCorrelation.Value = previous;
    }
}

/// <summary>
/// Overrides the request id assigned by the ASP.NET Core hosting logger. The hosting scope
/// captures <see cref="HttpContext.TraceIdentifier"/> before user middleware runs, so the
/// outer request-context middleware must be able to replace it with the public
/// <c>X-Request-Id</c> value.
/// </summary>
public sealed class RequestCorrelationEnricher : ILogEventEnricher
{
    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
    {
        ArgumentNullException.ThrowIfNull(logEvent);

        var correlation = RequestCorrelationContext.Current;
        if (correlation is null)
        {
            return;
        }

        logEvent.AddOrUpdateProperty(
            new LogEventProperty("RequestId", new ScalarValue(correlation.RequestId))
        );
        logEvent.AddOrUpdateProperty(
            new LogEventProperty("TraceId", new ScalarValue(correlation.TraceId))
        );
    }
}

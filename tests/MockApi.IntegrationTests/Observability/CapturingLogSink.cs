using System.Collections.Concurrent;
using Serilog.Core;
using Serilog.Events;
using Serilog.Formatting.Json;

namespace MockApi.IntegrationTests.Observability;

internal sealed class CapturingLogSink : ILogEventSink
{
    private readonly ConcurrentQueue<LogEvent> _events = new();
    private readonly ConcurrentQueue<string> _lines = new();
    private readonly JsonFormatter _formatter = new();
    private readonly object _sync = new();

    public IReadOnlyList<LogEvent> Events => _events.ToArray();

    public IReadOnlyList<string> Lines => _lines.ToArray();

    public void Emit(LogEvent logEvent)
    {
        lock (_sync)
        {
            using var writer = new StringWriter();
            _formatter.Format(logEvent, writer);
            _lines.Enqueue(writer.ToString());
        }

        _events.Enqueue(logEvent);
    }

    public void Clear()
    {
        while (_events.TryDequeue(out _)) { }

        while (_lines.TryDequeue(out _)) { }
    }
}

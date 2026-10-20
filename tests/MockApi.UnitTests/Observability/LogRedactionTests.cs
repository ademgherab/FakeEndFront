using System.Collections.Concurrent;
using Microsoft.AspNetCore.Http;
using MockApi.Api.Observability;
using Serilog;
using Serilog.Core;
using Serilog.Events;
using Serilog.Formatting.Json;

namespace MockApi.UnitTests.Observability;

public sealed class LogRedactionTests
{
    private const string Canary = "et_CANARY_9f2c1d7e4b8a6f3d_SHOULD_NEVER_APPEAR";

    [Fact]
    public void Authorization_header_and_token_properties_never_reach_the_output()
    {
        var sink = new InMemoryLogEventSink();

        using var logger = new LoggerConfiguration()
            .Destructure.With<SensitiveDataDestructuringPolicy>()
            .Enrich.With<SensitiveDataEnricher>()
            .WriteTo.Sink(sink)
            .CreateLogger();

        var headers = new HeaderDictionary
        {
            ["Authorization"] = $"Bearer {Canary}",
            ["X-Debug-Token"] = Canary,
        };

        var request = new
        {
            EditToken = Canary,
            edit_token = Canary,
            Nested = new
            {
                Password = Canary,
                Secret = Canary,
                Token = Canary,
            },
            Name = "safe value",
        };

        logger.Information("Request {@Request}", request);
        logger.Information("Headers {@Headers}", headers);
        logger.Information("Authorization {Authorization}", $"Bearer {Canary}");

        Assert.NotEmpty(sink.Lines);
        Assert.All(
            sink.Lines,
            line => Assert.DoesNotContain(Canary, line, StringComparison.Ordinal)
        );
        Assert.Contains(
            sink.Lines,
            line => line.Contains(SensitiveDataRedactionForTests.Redacted, StringComparison.Ordinal)
        );
    }

    private sealed class InMemoryLogEventSink : ILogEventSink
    {
        private readonly JsonFormatter _formatter = new();
        private readonly ConcurrentQueue<string> _lines = new();

        public IReadOnlyCollection<string> Lines => _lines.ToArray();

        public void Emit(LogEvent logEvent)
        {
            using var writer = new StringWriter();
            _formatter.Format(logEvent, writer);
            _lines.Enqueue(writer.ToString());
        }
    }

    private static class SensitiveDataRedactionForTests
    {
        public const string Redacted = "[REDACTED]";
    }
}

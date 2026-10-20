using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MockApi.Api.Observability;
using Serilog.Core;
using Serilog.Events;

namespace MockApi.IntegrationTests.Observability;

public sealed class RequestLoggingTests
{
    private const string BodyCanary = "sample-body-canary-that-must-not-be-logged";

    [Fact]
    public async Task Request_gets_x_request_id_and_all_events_share_the_same_request_id()
    {
        var sink = new CapturingLogSink();
        var builder = WebApplication.CreateBuilder(
            new WebApplicationOptions { EnvironmentName = Environments.Development }
        );

        builder.WebHost.UseTestServer();
        builder.Services.AddSingleton<ILogEventSink>(sink);
        builder.AddMockApiLogging();

        await using var app = builder.Build();

        app.UseMockApiRequestLogging();
        app.MapPost(
            "/probe",
            async (HttpContext context, ILoggerFactory loggerFactory) =>
            {
                using var reader = new StreamReader(context.Request.Body);
                _ = await reader.ReadToEndAsync();
                loggerFactory
                    .CreateLogger("MockApi.Tests.Handler")
                    .LogInformation("Handler executed");

                return Results.Ok(new { ok = true });
            }
        );

        await app.StartAsync();

        try
        {
            sink.Clear();
            using var client = app.GetTestClient();
            using var content = JsonContent.Create(new { canary = BodyCanary });
            using var response = await client.PostAsync("/probe", content);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var requestId = Assert.Single(response.Headers.GetValues("X-Request-Id"));
            Assert.True(Guid.TryParse(requestId, out _));

            var correlatedEvents = sink
                .Events.Where(logEvent => ScalarString(logEvent, "RequestId") == requestId)
                .ToArray();

            Assert.NotEmpty(correlatedEvents);
            Assert.All(
                correlatedEvents,
                logEvent =>
                    Assert.False(string.IsNullOrWhiteSpace(ScalarString(logEvent, "TraceId")))
            );

            Assert.Contains(
                correlatedEvents,
                logEvent =>
                    logEvent.MessageTemplate.Text.Contains(
                        "Handler executed",
                        StringComparison.Ordinal
                    )
            );

            var completionEvent = Assert.Single(
                correlatedEvents,
                logEvent =>
                    logEvent.MessageTemplate.Text.Contains("responded", StringComparison.Ordinal)
            );
            Assert.Equal("POST", ScalarString(completionEvent, "Method"));
            Assert.Equal("/probe", ScalarString(completionEvent, "Path"));
            Assert.Equal("200", ScalarString(completionEvent, "StatusCode"));
            Assert.NotNull(completionEvent.Properties["ElapsedMs"]);

            Assert.DoesNotContain(
                sink.Lines,
                line => line.Contains(BodyCanary, StringComparison.Ordinal)
            );
        }
        finally
        {
            await app.StopAsync();
        }
    }

    private static string? ScalarString(LogEvent logEvent, string propertyName) =>
        logEvent.Properties.TryGetValue(propertyName, out var value)
        && value is ScalarValue { Value: not null } scalar
            ? scalar.Value.ToString()
            : null;
}

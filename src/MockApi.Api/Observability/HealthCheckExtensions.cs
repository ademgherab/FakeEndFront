using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Net.Http.Headers;

namespace MockApi.Api.Observability;

public static class HealthCheckExtensions
{
    private const string LiveTag = "live";
    private const string ReadyTag = "ready";

    public static IServiceCollection AddMockApiHealthChecks(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddOptions<HealthProbeOptions>().BindConfiguration(HealthProbeOptions.SectionName);

        services
            .AddHealthChecks()
            .AddCheck(
                "self",
                () => HealthCheckResult.Healthy("The process is running."),
                tags: [LiveTag]
            )
            .AddCheck<PostgresReadinessHealthCheck>("postgres", tags: [ReadyTag]);

        return services;
    }

    public static IEndpointRouteBuilder MapMockApiHealthChecks(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        endpoints.MapHealthChecks(
            "/health/live",
            new HealthCheckOptions
            {
                Predicate = registration => registration.Tags.Contains(LiveTag),
                ResponseWriter = WriteResponseAsync,
            }
        );

        endpoints.MapHealthChecks(
            "/health/ready",
            new HealthCheckOptions
            {
                Predicate = registration => registration.Tags.Contains(ReadyTag),
                ResponseWriter = WriteResponseAsync,
                ResultStatusCodes =
                {
                    [HealthStatus.Healthy] = StatusCodes.Status200OK,
                    [HealthStatus.Degraded] = StatusCodes.Status200OK,
                    [HealthStatus.Unhealthy] = StatusCodes.Status503ServiceUnavailable,
                },
            }
        );

        return endpoints;
    }

    private static async Task WriteResponseAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json; charset=utf-8";
        context.Response.Headers[HeaderNames.CacheControl] = "no-store, no-cache";
        context.Response.Headers[HeaderNames.Pragma] = "no-cache";

        var response = new
        {
            status = report.Status.ToString(),
            checks = report.Entries.Select(entry => new
            {
                name = entry.Key,
                status = entry.Value.Status.ToString(),
            }),
        };

        await context
            .Response.WriteAsJsonAsync(response, context.RequestAborted)
            .ConfigureAwait(false);
    }
}

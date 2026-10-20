using System.Diagnostics;
using System.Globalization;
using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Xunit.Sdk;

namespace MockApi.IntegrationTests.Observability;

public sealed class HealthProbeTests
{
    private const string LocalConnectionString =
        "Host=localhost;Port=5432;Database=mockapi;Username=mockapi;Password=mockapi_dev";

    private const string UnreachableConnectionString =
        "Host=127.0.0.1;Port=1;Database=mockapi;Username=mockapi;Password=secret-ready-canary";

    [Fact]
    public async Task Liveness_returns_200_without_touching_postgres()
    {
        using var factory = CreateFactory(UnreachableConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store, no-cache", response.Headers.CacheControl?.ToString());
        Assert.Contains(
            "Healthy",
            await response.Content.ReadAsStringAsync(),
            StringComparison.Ordinal
        );
    }

    [Fact]
    public async Task Readiness_returns_503_quickly_when_postgres_is_unreachable_and_hides_details()
    {
        using var factory = CreateFactory(UnreachableConnectionString);
        using var client = factory.CreateClient();

        var stopwatch = Stopwatch.StartNew();
        using var response = await client.GetAsync("/health/ready");
        stopwatch.Stop();

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.True(
            stopwatch.Elapsed < TimeSpan.FromSeconds(10),
            $"Readiness probe took {stopwatch.Elapsed}."
        );
        Assert.Equal("no-store, no-cache", response.Headers.CacheControl?.ToString());

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Unhealthy", body, StringComparison.Ordinal);
        Assert.DoesNotContain("secret-ready-canary", body, StringComparison.Ordinal);
        Assert.DoesNotContain("127.0.0.1", body, StringComparison.Ordinal);
        Assert.DoesNotContain("Npgsql", body, StringComparison.Ordinal);
        Assert.DoesNotContain("Exception", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Readiness_returns_200_when_postgres_is_reachable()
    {
        if (!await CanConnectAsync())
        {
            throw SkipException.ForSkip(
                "PostgreSQL is not reachable on localhost:5432; start docker compose to run this test."
            );
        }

        using var factory = CreateFactory(LocalConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/health/ready");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store, no-cache", response.Headers.CacheControl?.ToString());
        Assert.Contains("Healthy", body, StringComparison.Ordinal);
        Assert.DoesNotContain("mockapi_dev", body, StringComparison.Ordinal);
        Assert.DoesNotContain("Password", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Health_endpoints_are_not_under_the_management_api_prefix()
    {
        using var factory = CreateFactory(UnreachableConnectionString);
        using var client = factory.CreateClient();

        using var live = await client.GetAsync("/health/live");
        using var missing = await client.GetAsync("/api/v1/health/live");

        Assert.Equal(HttpStatusCode.OK, live.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    private static WebApplicationFactory<Program> CreateFactory(string connectionString) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration(
                (_, configuration) =>
                    configuration.AddInMemoryCollection(
                        new Dictionary<string, string?>
                        {
                            ["ConnectionStrings:Default"] = connectionString,
                            ["MockApi:Health:TimeoutSeconds"] = "1",
                        }
                    )
            )
        );

    private static async Task<bool> CanConnectAsync()
    {
        try
        {
            var builder = new NpgsqlConnectionStringBuilder(LocalConnectionString)
            {
                Timeout = 1,
                CommandTimeout = 1,
            };

            await using var connection = new NpgsqlConnection(builder.ConnectionString);
            await connection.OpenAsync();

            await using var command = new NpgsqlCommand("SELECT 1", connection)
            {
                CommandTimeout = 1,
            };

            var result = await command.ExecuteScalarAsync();
            return Convert.ToInt32(result, CultureInfo.InvariantCulture) == 1;
        }
        catch (Exception)
        {
            return false;
        }
    }
}

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MockApi.IntegrationTests.Observability;
using MockApi.IntegrationTests.TestSupport;
using Serilog.Core;

namespace MockApi.IntegrationTests;

/// <summary>
/// Hosts the real pipeline against the test PostgreSQL instance plus a test-only project-scoped
/// controller so T08's authorization contract can be exercised before T09 adds the real routes.
/// </summary>
public sealed class ProjectAuthFactory : WebApplicationFactory<Program>
{
    private readonly string _connectionString;

    public ProjectAuthFactory(string connectionString)
    {
        _connectionString = connectionString;
    }

    internal CapturingLogSink LogSink { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration(
            (_, configuration) =>
                configuration.AddInMemoryCollection(
                    new Dictionary<string, string?>
                    {
                        ["ConnectionStrings:Default"] = _connectionString,
                        ["MockApi:Errors:BaseUrl"] = "https://errors.test",
                    }
                )
        );

        builder.ConfigureServices(services =>
        {
            services.AddSingleton<ILogEventSink>(LogSink);
            services.AddControllers().AddApplicationPart(typeof(ProjectAuthController).Assembly);
        });
    }
}

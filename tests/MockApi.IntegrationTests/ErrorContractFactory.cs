using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MockApi.IntegrationTests.TestSupport;

namespace MockApi.IntegrationTests;

public sealed class ErrorContractFactory : WebApplicationFactory<Program>
{
    public const string ErrorBaseUrl = "https://errors.test";

    public const int MaxRequestBodyBytes = 1024;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration(
            (_, configuration) =>
                configuration.AddInMemoryCollection(
                    new Dictionary<string, string?>
                    {
                        ["ConnectionStrings:Default"] =
                            "Host=localhost;Database=mockapi_test;Username=test",
                        ["MockApi:Errors:BaseUrl"] = ErrorBaseUrl,
                        ["MockApi:Limits:MaxRequestBodyBytes"] = MaxRequestBodyBytes.ToString(),
                        ["MockApi:Limits:MaxMockRequestBodyBytes"] = "512",
                    }
                )
        );

        builder.ConfigureServices(services =>
            services.AddControllers().AddApplicationPart(typeof(ErrorContractController).Assembly)
        );
    }
}

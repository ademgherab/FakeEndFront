using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using MockApi.Core.Configuration;

namespace MockApi.UnitTests.Configuration;

public sealed class MockApiOptionsTests
{
    [Fact]
    public void Defaults_match_the_specification()
    {
        var options = Bind(new Dictionary<string, string?>());

        Assert.Equal(10, options.Limits.MaxEndpointsPerProject);
        Assert.Equal(102_400, options.Limits.MaxSampleBytes);
        Assert.Equal(262_144, options.Limits.MaxRequestBodyBytes);
        Assert.Equal(65_536, options.Limits.MaxMockRequestBodyBytes);
        Assert.Equal(200, options.Limits.MaxPathLength);
        Assert.Equal(10_000, options.Limits.MaxDelayMs);
        Assert.Equal(1_000, options.Limits.MaxListSize);
        Assert.Equal(10_000, options.Limits.MaxPaginationTotalItems);
        Assert.Equal(100, options.Limits.MaxPaginationLimit);
        Assert.Equal(10, options.Limits.MaxErrorStatusCodes);
        Assert.Equal(5_000, options.Limits.DailyRequestsPerProject);
        Assert.Equal(1_000, options.Limits.MaxLogEntriesPerProject);
        Assert.Equal(100_000, options.Limits.MaxGeneratedValuesPerResponse);
        Assert.Equal(2_000, options.Limits.MaxSchemaNodes);
        Assert.Equal(10, options.Limits.MaxSchemaDepth);
        Assert.Equal(100, options.Limits.MaxFieldNameLength);
        Assert.Equal(50, options.Limits.MaxEnumValues);

        Assert.Equal(7, options.Projects.LifetimeDays);
        Assert.Equal(3, options.Projects.ExpiryGraceDays);
        Assert.Equal(10, options.Projects.SlugLength);

        Assert.Equal(10, options.RateLimits.CreateProjectPerHour);
        Assert.Equal(30, options.RateLimits.InferPreviewPerMinute);
        Assert.Equal(60, options.RateLimits.ManagementWritePerMinute);
        Assert.Equal(120, options.RateLimits.ManagementReadPerMinute);
        Assert.Equal(120, options.RateLimits.RuntimeSlugPerMinute);
        Assert.Equal(600, options.RateLimits.RuntimeIpPerMinute);

        Assert.Equal(["http://localhost:3000"], options.Cors.ManagementOrigins);
        Assert.Equal("https://api.example.com/m", options.Runtime.MockBaseUrl);
        Assert.Equal("https://picsum.photos/seed/{seed}/200/200", options.Images.ImageUrlTemplate);
        Assert.Equal("https://i.pravatar.cc/150?u={seed}", options.Images.AvatarUrlTemplate);

        Assert.Equal(10_000, options.Workers.LogQueueCapacity);
        Assert.Equal(200, options.Workers.LogBatchSize);
        Assert.Equal(2_000, options.Workers.LogFlushIntervalMs);
        Assert.Equal(5_000, options.Workers.UsageFlushIntervalMs);
        Assert.Equal(60, options.Workers.CleanupIntervalSeconds);
        Assert.Equal(3_600, options.Workers.PurgeIntervalSeconds);
    }

    [Fact]
    public void Configuration_values_override_defaults()
    {
        var values = new Dictionary<string, string?>
        {
            ["MockApi:Limits:MaxEndpointsPerProject"] = "25",
            ["MockApi:Projects:LifetimeDays"] = "14",
            ["MockApi:Runtime:MockBaseUrl"] = "http://localhost:9000/m",
        };

        var options = Bind(values);

        Assert.Equal(25, options.Limits.MaxEndpointsPerProject);
        Assert.Equal(14, options.Projects.LifetimeDays);
        Assert.Equal("http://localhost:9000/m", options.Runtime.MockBaseUrl);
    }

    [Fact]
    public void Environment_variables_override_appsettings_values()
    {
        const string variable = "MockApi__Limits__MaxEndpointsPerProject";
        var values = new Dictionary<string, string?>
        {
            ["MockApi:Limits:MaxEndpointsPerProject"] = "25",
        };

        var previous = Environment.GetEnvironmentVariable(variable);
        Environment.SetEnvironmentVariable(variable, "40");

        try
        {
            var configuration = new ConfigurationBuilder()
                .SetBasePath(AppContext.BaseDirectory)
                .AddJsonFile("appsettings.json", optional: false)
                .AddInMemoryCollection(values)
                .AddEnvironmentVariables()
                .Build();

            var options = Bind(configuration);

            Assert.Equal(40, options.Limits.MaxEndpointsPerProject);
        }
        finally
        {
            Environment.SetEnvironmentVariable(variable, previous);
        }
    }

    [Fact]
    public void Default_configuration_passes_validation()
    {
        var options = Bind(new Dictionary<string, string?>());

        Assert.Empty(Validate(options));
    }

    [Theory]
    [InlineData("MockApi:Runtime:MockBaseUrl", "")]
    [InlineData("MockApi:Runtime:MockBaseUrl", "not-a-url")]
    [InlineData("MockApi:Limits:MaxDelayMs", "0")]
    [InlineData("MockApi:Limits:MaxEndpointsPerProject", "-1")]
    [InlineData("MockApi:Projects:LifetimeDays", "0")]
    [InlineData("MockApi:Cors:ManagementOrigins:0", "https://example.com/path")]
    public void Invalid_configuration_fails_validation(string key, string value)
    {
        var values = new Dictionary<string, string?> { [key] = value };
        var options = Bind(values);

        Assert.NotEmpty(Validate(options));
    }

    [Fact]
    public void Missing_configuration_fails_validation()
    {
        var options = new MockApiOptions();

        Assert.NotEmpty(Validate(options));
    }

    [Fact]
    public void Empty_management_origins_fail_validation()
    {
        var options = new CorsOptions { ManagementOrigins = [] };

        Assert.NotEmpty(Validate(options));
    }

    [Fact]
    public void Workers_batch_must_not_exceed_queue_capacity()
    {
        var values = new Dictionary<string, string?>
        {
            ["MockApi:Workers:LogQueueCapacity"] = "10",
            ["MockApi:Workers:LogBatchSize"] = "11",
        };

        var options = Bind(values);

        Assert.NotEmpty(Validate(options));
    }

    private static MockApiOptions Bind(IReadOnlyDictionary<string, string?> values) =>
        Bind(
            new ConfigurationBuilder()
                .SetBasePath(AppContext.BaseDirectory)
                .AddJsonFile("appsettings.json", optional: false)
                .AddInMemoryCollection(values)
                .Build()
        );

    private static MockApiOptions Bind(IConfiguration configuration)
    {
        var services = new ServiceCollection();
        services
            .AddOptions<MockApiOptions>()
            .Bind(configuration.GetSection(MockApiOptions.SectionName));

        using var provider = services.BuildServiceProvider();
        return provider.GetRequiredService<IOptions<MockApiOptions>>().Value;
    }

    private static IReadOnlyList<ValidationResult> Validate(object options)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(
            options,
            new ValidationContext(options),
            results,
            validateAllProperties: true
        );
        return results;
    }
}

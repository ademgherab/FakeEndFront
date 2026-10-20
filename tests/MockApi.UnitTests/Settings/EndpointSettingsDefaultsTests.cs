using System.Text.Json;
using MockApi.Core.Serialization;
using MockApi.Core.Settings;

namespace MockApi.UnitTests.Settings;

public sealed class EndpointSettingsDefaultsTests
{
    private static readonly JsonSerializerOptions Json = JsonDefaults.Create();

    [Theory]
    [InlineData("GET", 200)]
    [InlineData("POST", 201)]
    [InlineData("PUT", 200)]
    [InlineData("DELETE", 204)]
    [InlineData("get", 200)]
    public void Success_status_defaults_follow_the_method(string method, int expected)
    {
        var settings = EndpointSettingsDefaults.Create(method);

        Assert.Equal(expected, settings.SuccessStatus);
    }

    [Fact]
    public void Empty_input_produces_the_exact_default_object()
    {
        const string expected =
            """{"successStatus":200,"delay":{"minMs":0,"maxMs":0},"errors":{"ratePercent":0,"statusCodes":[500]},"list":{"path":null,"size":{"min":10,"max":10}},"pagination":{"enabled":false,"totalItems":100,"defaultLimit":10,"maxLimit":100,"bindings":{"page":null,"limit":null,"total":null,"totalPages":null,"hasNext":null,"hasPrev":null}},"seed":null}""";

        var fromFactory = JsonSerializer.Serialize(EndpointSettingsDefaults.Create("GET"), Json);
        var fromService = JsonSerializer.Serialize(
            EndpointSettingsService.ResolveAndValidate(
                SettingsTestSupport.Settings("{}"),
                "GET",
                SettingsTestSupport.RootArrayListSchema(),
                SettingsTestSupport.Options(),
                100_000
            ),
            Json
        );

        Assert.Equal(expected, fromFactory);
        Assert.Equal(expected, fromService);
    }

    [Fact]
    public void Defaults_are_clamped_to_smaller_configured_limits()
    {
        var options = SettingsTestSupport.Options();
        options = new MockApi.Core.Configuration.MockApiOptions
        {
            Limits = new MockApi.Core.Configuration.LimitsOptions
            {
                MaxDelayMs = 10_000,
                MaxListSize = 5,
                MaxPaginationTotalItems = 50,
                MaxPaginationLimit = 5,
                MaxErrorStatusCodes = 10,
                MaxGeneratedValuesPerResponse = 100_000,
            },
        };

        var settings = EndpointSettingsDefaults.Create("GET", options.Limits);

        Assert.Equal(5, settings.List!.Size!.Min);
        Assert.Equal(5, settings.List.Size.Max);
        Assert.Equal(50, settings.Pagination!.TotalItems);
        Assert.Equal(5, settings.Pagination.DefaultLimit);
        Assert.Equal(5, settings.Pagination.MaxLimit);
    }
}

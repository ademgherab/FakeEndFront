using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using MockApi.Core.Serialization;
using HttpJsonOptions = Microsoft.AspNetCore.Http.Json.JsonOptions;
using MvcJsonOptions = Microsoft.AspNetCore.Mvc.JsonOptions;

namespace MockApi.ContractTests;

public sealed class JsonContractTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public JsonContractTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public void Management_json_options_are_strict()
    {
        var options = _factory
            .Services.GetRequiredService<IOptions<MvcJsonOptions>>()
            .Value.JsonSerializerOptions;

        AssertStrict(options);
    }

    [Fact]
    public void Minimal_api_json_options_are_strict()
    {
        var options = _factory
            .Services.GetRequiredService<IOptions<HttpJsonOptions>>()
            .Value.SerializerOptions;

        AssertStrict(options);
    }

    private static void AssertStrict(JsonSerializerOptions options)
    {
        Assert.Equal(JsonNamingPolicy.CamelCase, options.PropertyNamingPolicy);
        Assert.Equal(JsonDefaults.MaxDepth, options.MaxDepth);
        Assert.Equal(JsonUnmappedMemberHandling.Disallow, options.UnmappedMemberHandling);
        Assert.Contains(
            options.Converters,
            converter => converter is StrictStringEnumConverterFactory
        );
    }
}

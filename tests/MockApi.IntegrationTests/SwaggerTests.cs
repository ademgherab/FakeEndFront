using System.Net;
using System.Text.Json;

namespace MockApi.IntegrationTests;

public sealed class SwaggerTests : IClassFixture<ErrorContractFactory>
{
    private readonly HttpClient _client;

    public SwaggerTests(ErrorContractFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Swagger_document_is_served_with_health_probes()
    {
        using var response = await _client.GetAsync("/swagger/v1/swagger.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        await using var stream = await response.Content.ReadAsStreamAsync();
        using var document = await JsonDocument.ParseAsync(stream);
        var root = document.RootElement;

        Assert.Equal("MockAPI", root.GetProperty("info").GetProperty("title").GetString());
        Assert.True(root.GetProperty("paths").TryGetProperty("/health/live", out _));
        Assert.True(root.GetProperty("paths").TryGetProperty("/health/ready", out _));
        Assert.True(
            root.GetProperty("components")
                .GetProperty("securitySchemes")
                .TryGetProperty("Bearer", out _)
        );
    }

    [Fact]
    public async Task Swagger_ui_is_served()
    {
        using var response = await _client.GetAsync("/swagger/index.html");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
    }
}

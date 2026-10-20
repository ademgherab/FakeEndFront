using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using MockApi.Core.Security;
using MockApi.Data.Entities;

namespace MockApi.IntegrationTests;

public sealed class ProjectAuthTests : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private const string RoutePrefix = "/api/v1/test-auth/projects";

    private readonly PostgresFixture _fixture;
    private readonly ProjectAuthFactory _factory;
    private readonly EditTokenService _tokens = new();

    public ProjectAuthTests(PostgresFixture fixture)
    {
        _fixture = fixture;
        _factory = new ProjectAuthFactory(fixture.ConnectionString);
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    [Fact]
    public async Task Unknown_slug_without_token_returns_404_project_not_found()
    {
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync($"{RoutePrefix}/doesnotexist");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("project_not_found", await ReadCodeAsync(response));
        Assert.False(response.Headers.Contains("WWW-Authenticate"));
    }

    [Fact]
    public async Task Known_slug_without_token_returns_401_missing_token_with_challenge()
    {
        var seeded = await SeedProjectAsync();
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync($"{RoutePrefix}/{seeded.Project.Slug}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("missing_token", await ReadCodeAsync(response));
        var challenge = Assert.Single(response.Headers.WwwAuthenticate);
        Assert.Equal("Bearer", challenge.Scheme);
    }

    [Fact]
    public async Task Known_slug_with_malformed_authorization_returns_401_missing_token()
    {
        var seeded = await SeedProjectAsync();
        using var client = _factory.CreateClient();

        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"{RoutePrefix}/{seeded.Project.Slug}"
        );
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", "dXNlcjpwYXNz");

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("missing_token", await ReadCodeAsync(response));
        Assert.Equal("Bearer", Assert.Single(response.Headers.WwwAuthenticate).Scheme);
    }

    [Fact]
    public async Task Known_slug_with_wrong_token_returns_403_invalid_token()
    {
        var seeded = await SeedProjectAsync();
        using var client = _factory.CreateClient();

        using var request = Request(
            $"{RoutePrefix}/{seeded.Project.Slug}",
            _tokens.Generate().Value
        );
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("invalid_token", await ReadCodeAsync(response));
    }

    [Fact]
    public async Task Expired_project_with_valid_token_returns_410_project_expired()
    {
        var seeded = await SeedProjectAsync(DateTimeOffset.UtcNow.AddMinutes(-1));
        using var client = _factory.CreateClient();

        using var request = Request($"{RoutePrefix}/{seeded.Project.Slug}", seeded.Token);
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Gone, response.StatusCode);
        Assert.Equal("project_expired", await ReadCodeAsync(response));
    }

    [Fact]
    public async Task Valid_token_on_live_project_returns_200_and_exposes_loaded_project()
    {
        var seeded = await SeedProjectAsync(name: "Auth demo");
        using var client = _factory.CreateClient();

        using var request = Request($"{RoutePrefix}/{seeded.Project.Slug}", seeded.Token);
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(seeded.Project.Slug, document.RootElement.GetProperty("slug").GetString());
        Assert.Equal("Auth demo", document.RootElement.GetProperty("name").GetString());
    }

    [Fact]
    public async Task Auth_request_never_logs_the_raw_token()
    {
        var seeded = await SeedProjectAsync();
        using var client = _factory.CreateClient();

        _factory.LogSink.Clear();

        using var request = Request($"{RoutePrefix}/{seeded.Project.Slug}", seeded.Token);
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotEmpty(_factory.LogSink.Lines);
        Assert.All(
            _factory.LogSink.Lines,
            line => Assert.DoesNotContain(seeded.Token, line, StringComparison.Ordinal)
        );
    }

    private static HttpRequestMessage Request(string path, string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        return request;
    }

    private static async Task<string?> ReadCodeAsync(HttpResponseMessage response)
    {
        var content = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(content);

        return document.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private async Task<SeededProject> SeedProjectAsync(
        DateTimeOffset? expiresAt = null,
        string? name = null
    )
    {
        var generated = _tokens.Generate();
        var project = new Project
        {
            Id = Guid.NewGuid(),
            Slug = Guid.NewGuid().ToString("N")[..10],
            Name = name,
            EditTokenHash = generated.Hash,
            CreatedAt = DateTimeOffset.UtcNow,
            ExpiresAt = expiresAt ?? DateTimeOffset.UtcNow.AddDays(7),
        };

        await using (var context = _fixture.CreateContext())
        {
            context.Projects.Add(project);
            await context.SaveChangesAsync();
        }

        return new SeededProject(project, generated.Value);
    }

    private sealed record SeededProject(Project Project, string Token);
}

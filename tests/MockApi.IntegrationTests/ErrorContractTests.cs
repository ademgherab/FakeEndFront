using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace MockApi.IntegrationTests;

public sealed class ErrorContractTests : IClassFixture<ErrorContractFactory>
{
    private static readonly HashSet<string> ProblemKeys = new(StringComparer.Ordinal)
    {
        "type",
        "title",
        "status",
        "code",
        "detail",
        "traceId",
        "errors",
    };

    private readonly HttpClient _client;

    public ErrorContractTests(ErrorContractFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Malformed_json_returns_validation_failed_problem_details()
    {
        using var response = await _client.PostAsync(
            "/api/v1/test/echo",
            new StringContent("{ \"name\": ", Encoding.UTF8, "application/json")
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        AssertProblemContentType(response);
        AssertRequestId(response);

        using var document = await ReadJsonAsync(response);
        var root = document.RootElement;

        Assert.Equal("validation_failed", root.GetProperty("code").GetString());
        Assert.Equal(
            $"{ErrorContractFactory.ErrorBaseUrl}/errors/validation_failed",
            root.GetProperty("type").GetString()
        );
        Assert.Equal(
            "One or more validation errors occurred.",
            root.GetProperty("title").GetString()
        );
        Assert.Equal(400, root.GetProperty("status").GetInt32());
        Assert.Contains("See 'errors'", root.GetProperty("detail").GetString());
        Assert.True(Guid.TryParse(root.GetProperty("traceId").GetString(), out _));
        Assert.Equal(
            ProblemKeys,
            root.EnumerateObject()
                .Select(property => property.Name)
                .ToHashSet(StringComparer.Ordinal)
        );
    }

    [Fact]
    public async Task Unknown_property_maps_to_dotted_body_path_without_leaking_types()
    {
        const string json =
            """{"name":"demo","endpoints":[{"settings":{"delay":{"maxMs":500}}}]}""";

        using var response = await _client.PostAsync(
            "/api/v1/test/echo",
            new StringContent(json, Encoding.UTF8, "application/json")
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        AssertProblemContentType(response);

        using var document = await ReadJsonAsync(response);
        var root = document.RootElement;
        var errors = root.GetProperty("errors");

        Assert.True(
            errors.TryGetProperty("endpoints[0].settings.delay.maxMs", out var messages),
            $"Actual errors: {errors.GetRawText()}"
        );
        Assert.Equal(JsonValueKind.Array, messages.ValueKind);
        Assert.Equal("Unknown property.", messages[0].GetString());

        var body = root.GetRawText();
        Assert.DoesNotContain("EchoDelay", body, StringComparison.Ordinal);
        Assert.DoesNotContain("System.", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Missing_token_returns_401_with_www_authenticate()
    {
        using var response = await _client.GetAsync("/api/v1/test/no-body-401");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        AssertProblemContentType(response);
        AssertRequestId(response);
        Assert.Contains(
            "Bearer",
            response.Headers.WwwAuthenticate.Select(value => value.Scheme)
        );

        using var document = await ReadJsonAsync(response);
        Assert.Equal("missing_token", document.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Method_not_allowed_returns_405_and_preserves_allow()
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/test/only-get");
        using var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
        AssertProblemContentType(response);

        IEnumerable<string> allow = response.Content.Headers.Allow;

        if (!allow.Any() && response.Headers.TryGetValues("Allow", out var headerValues))
        {
            allow = headerValues;
        }

        Assert.Contains("GET", allow);

        using var document = await ReadJsonAsync(response);
        Assert.Equal("method_not_allowed", document.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Oversized_request_returns_413_payload_too_large()
    {
        var body = new string('x', ErrorContractFactory.MaxRequestBodyBytes + 1);

        using var response = await _client.PostAsync(
            "/api/v1/test/echo",
            new StringContent(body, Encoding.UTF8, "application/json")
        );

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        AssertProblemContentType(response);

        using var document = await ReadJsonAsync(response);
        Assert.Equal("payload_too_large", document.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Non_json_body_returns_415_unsupported_media_type()
    {
        using var response = await _client.PostAsync(
            "/api/v1/test/echo",
            new StringContent("hello", Encoding.UTF8, "text/plain")
        );

        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
        AssertProblemContentType(response);

        using var document = await ReadJsonAsync(response);
        Assert.Equal(
            "unsupported_media_type",
            document.RootElement.GetProperty("code").GetString()
        );
    }

    [Fact]
    public async Task Rate_limited_returns_429_with_retry_after()
    {
        using var response = await _client.GetAsync(
            "/api/v1/test/api-error?status=429&code=rate_limited&retry=7"
        );

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        AssertProblemContentType(response);
        Assert.True(response.Headers.TryGetValues("Retry-After", out var retryAfter));
        Assert.Equal("7", Assert.Single(retryAfter));

        using var document = await ReadJsonAsync(response);
        Assert.Equal("rate_limited", document.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Unhandled_exception_returns_500_without_leaking_details()
    {
        using var response = await _client.GetAsync("/api/v1/test/boom");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        AssertProblemContentType(response);
        var requestId = AssertRequestId(response);

        var body = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(body);
        var root = document.RootElement;

        Assert.Equal("internal_error", root.GetProperty("code").GetString());
        Assert.Equal(requestId, root.GetProperty("traceId").GetString());
        Assert.Equal("An unexpected error occurred.", root.GetProperty("detail").GetString());

        Assert.DoesNotContain("ConnectionStrings", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Password", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("InvalidOperationException", body, StringComparison.Ordinal);
        Assert.DoesNotContain("System.", body, StringComparison.Ordinal);
        Assert.DoesNotContain("Host=", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Unknown_route_returns_404_not_found_problem_details()
    {
        using var response = await _client.GetAsync("/api/v1/test/does-not-exist");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        AssertProblemContentType(response);

        using var document = await ReadJsonAsync(response);
        Assert.Equal("not_found", document.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Inbound_guid_request_id_is_accepted_and_echoed()
    {
        const string inbound = "11111111-2222-3333-4444-555555555555";
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/test/success");
        request.Headers.Add("X-Request-Id", inbound);

        using var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(inbound, AssertRequestId(response));
    }

    [Fact]
    public async Task Invalid_inbound_request_id_is_replaced_with_a_guid()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/test/success");
        request.Headers.Add("X-Request-Id", "not-a-guid");

        using var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var requestId = AssertRequestId(response);
        Assert.NotEqual("not-a-guid", requestId);
    }

    [Fact]
    public async Task Runtime_injected_error_has_exact_envelope_and_request_id()
    {
        using var response = await _client.GetAsync("/api/v1/test/runtime-injected");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("utf-8", response.Content.Headers.ContentType?.CharSet);
        Assert.Equal("3", Assert.Single(response.Headers.GetValues("Retry-After")));
        var requestId = AssertRequestId(response);

        using var document = await ReadJsonAsync(response);
        var error = document.RootElement.GetProperty("error");

        Assert.Equal(
            new HashSet<string>(StringComparer.Ordinal)
            {
                "status",
                "code",
                "title",
                "message",
                "injected",
                "requestId",
            },
            error
                .EnumerateObject()
                .Select(property => property.Name)
                .ToHashSet(StringComparer.Ordinal)
        );

        Assert.Equal(503, error.GetProperty("status").GetInt32());
        Assert.Equal("injected_error", error.GetProperty("code").GetString());
        Assert.True(error.GetProperty("injected").GetBoolean());
        Assert.Equal(requestId, error.GetProperty("requestId").GetString());
    }

    [Fact]
    public async Task Validation_error_has_request_id_header()
    {
        using var response = await _client.PostAsync(
            "/api/v1/test/echo",
            new StringContent("{", Encoding.UTF8, "application/json")
        );

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        AssertRequestId(response);
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(body);
    }

    private static void AssertProblemContentType(HttpResponseMessage response)
    {
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("utf-8", response.Content.Headers.ContentType?.CharSet);
    }

    private static string AssertRequestId(HttpResponseMessage response, string? expected = null)
    {
        Assert.True(response.Headers.TryGetValues("X-Request-Id", out var values));
        var requestId = Assert.Single(values);

        Assert.True(Guid.TryParse(requestId, out _));

        if (expected is not null)
        {
            Assert.Equal(expected, requestId);
        }

        return requestId;
    }
}

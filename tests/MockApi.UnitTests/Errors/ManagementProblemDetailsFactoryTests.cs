using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using MockApi.Core.Configuration;
using MockApi.Core.Errors;

namespace MockApi.UnitTests.Errors;

public sealed class ManagementProblemDetailsFactoryTests
{
    private const string TraceId = "b2f1c2a0-5a4f-4c0a-9a43-3f5a8a7a1e11";

    public static TheoryData<string, int, string> CatalogCodes
    {
        get
        {
            var data = new TheoryData<string, int, string>();

            foreach (var definition in ErrorCodes.All)
            {
                data.Add(definition.Code, definition.Status, definition.Title);
            }

            return data;
        }
    }

    [Theory]
    [MemberData(nameof(CatalogCodes))]
    public void Create_uses_catalog_metadata_and_configured_type_base(
        string code,
        int status,
        string title
    )
    {
        var factory = CreateFactory();

        var response = factory.Create(status, code, traceId: TraceId);

        Assert.Equal($"https://errors.test/errors/{code}", response.Type);
        Assert.Equal(title, response.Title);
        Assert.Equal(status, response.Status);
        Assert.Equal(code, response.Code);
        Assert.Equal(TraceId, response.TraceId);
    }

    [Fact]
    public async Task Validation_problem_has_exact_contract_shape()
    {
        var factory = CreateFactory();
        var context = CreateContext();
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            ["endpoints[0].settings.delay.maxMs"] = ["The value is invalid."],
            ["endpoints[0].path"] = ["The value is required."],
        };

        await factory.WriteAsync(
            context,
            new ApiException(
                400,
                ErrorCodes.ValidationFailed,
                "See 'errors' for details.",
                errors: errors
            )
        );

        Assert.Equal(400, context.Response.StatusCode);
        Assert.Equal(
            ManagementProblemDetailsFactory.ProblemContentType,
            context.Response.ContentType
        );

        using var document = JsonDocument.Parse(ReadBody(context));
        var root = document.RootElement;

        Assert.Equal(
            new HashSet<string>(StringComparer.Ordinal)
            {
                "type",
                "title",
                "status",
                "code",
                "detail",
                "traceId",
                "errors",
            },
            root.EnumerateObject()
                .Select(property => property.Name)
                .ToHashSet(StringComparer.Ordinal)
        );

        Assert.Equal(
            "https://errors.test/errors/validation_failed",
            root.GetProperty("type").GetString()
        );
        Assert.Equal(
            "One or more validation errors occurred.",
            root.GetProperty("title").GetString()
        );
        Assert.Equal(400, root.GetProperty("status").GetInt32());
        Assert.Equal("validation_failed", root.GetProperty("code").GetString());
        Assert.Equal("See 'errors' for details.", root.GetProperty("detail").GetString());
        Assert.Equal(TraceId, root.GetProperty("traceId").GetString());

        var errorObject = root.GetProperty("errors");
        Assert.Equal(
            "The value is invalid.",
            errorObject.GetProperty("endpoints[0].settings.delay.maxMs")[0].GetString()
        );
        Assert.Equal(
            "The value is required.",
            errorObject.GetProperty("endpoints[0].path")[0].GetString()
        );
    }

    [Fact]
    public async Task Problem_without_errors_omits_the_errors_property()
    {
        var factory = CreateFactory();
        var context = CreateContext();

        await factory.WriteAsync(
            context,
            new ApiException(500, ErrorCodes.InternalError, "An unexpected error occurred.")
        );

        using var document = JsonDocument.Parse(ReadBody(context));
        Assert.False(document.RootElement.TryGetProperty("errors", out _));
        Assert.Equal(
            new HashSet<string>(StringComparer.Ordinal)
            {
                "type",
                "title",
                "status",
                "code",
                "detail",
                "traceId",
            },
            document
                .RootElement.EnumerateObject()
                .Select(property => property.Name)
                .ToHashSet(StringComparer.Ordinal)
        );
    }

    [Fact]
    public async Task Unauthorized_problem_sets_www_authenticate_bearer()
    {
        var factory = CreateFactory();
        var context = CreateContext();

        await factory.WriteAsync(context, new ApiException(401, ErrorCodes.MissingToken));

        Assert.Equal("Bearer", context.Response.Headers.WWWAuthenticate.ToString());
    }

    [Fact]
    public async Task Too_many_requests_uses_exception_retry_after()
    {
        var factory = CreateFactory();
        var context = CreateContext();

        await factory.WriteAsync(
            context,
            new ApiException(429, ErrorCodes.RateLimited, retryAfterSeconds: 7)
        );

        Assert.Equal("7", context.Response.Headers.RetryAfter.ToString());
    }

    [Fact]
    public async Task Too_many_requests_defaults_retry_after_to_three()
    {
        var factory = CreateFactory();
        var context = CreateContext();

        await factory.WriteAsync(context, new ApiException(429, ErrorCodes.RateLimited));

        Assert.Equal("3", context.Response.Headers.RetryAfter.ToString());
    }

    [Fact]
    public async Task Method_not_allowed_preserves_existing_allow_header()
    {
        var factory = CreateFactory();
        var context = CreateContext();
        context.Response.Headers.Allow = "GET, POST";

        await factory.WriteAsync(context, new ApiException(405, ErrorCodes.MethodNotAllowed));

        Assert.Equal("GET, POST", context.Response.Headers.Allow.ToString());
        Assert.Equal(405, context.Response.StatusCode);
    }

    [Fact]
    public void Api_exception_validation_helper_uses_validation_contract()
    {
        var exception = ApiException.Validation(
            new Dictionary<string, string[]> { ["name"] = ["The value is required."] }
        );

        Assert.Equal(400, exception.Status);
        Assert.Equal(ErrorCodes.ValidationFailed, exception.Code);
        Assert.Equal("One or more validation errors occurred.", exception.Title);
        Assert.Single(exception.Errors!);
    }

    [Fact]
    public void Api_exception_rejects_unknown_code()
    {
        Assert.Throws<KeyNotFoundException>(() => new ApiException(400, "not_in_catalog"));
    }

    private static ManagementProblemDetailsFactory CreateFactory() =>
        new(Options.Create(new ErrorsOptions { BaseUrl = "https://errors.test" }));

    private static DefaultHttpContext CreateContext()
    {
        var context = new DefaultHttpContext { TraceIdentifier = TraceId };
        context.Items[RequestContext.RequestIdItemKey] = TraceId;
        context.Response.Body = new MemoryStream();
        return context;
    }

    private static string ReadBody(HttpContext context)
    {
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body, leaveOpen: true);
        return reader.ReadToEnd();
    }
}

using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using MockApi.Core.Errors;

namespace MockApi.UnitTests.Errors;

public sealed class RuntimeErrorFactoryTests
{
    private const string RequestId = "b2f1c2a0-5a4f-4c0a-9a43-3f5a8a7a1e11";

    [Fact]
    public async Task Injected_error_envelope_has_exactly_six_error_keys()
    {
        var factory = new RuntimeErrorFactory();
        var context = CreateContext();

        await factory.WriteInjectedAsync(context, 503);

        using var document = JsonDocument.Parse(ReadBody(context));
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
        Assert.Equal(ErrorCodes.InjectedError, error.GetProperty("code").GetString());
        Assert.Equal("Service Unavailable", error.GetProperty("title").GetString());
        Assert.Equal(
            RuntimeErrorFactory.DefaultInjectedMessage,
            error.GetProperty("message").GetString()
        );
        Assert.True(error.GetProperty("injected").GetBoolean());
        Assert.Equal(RequestId, error.GetProperty("requestId").GetString());
    }

    [Fact]
    public async Task Injected_503_sets_retry_after_three()
    {
        var factory = new RuntimeErrorFactory();
        var context = CreateContext();

        await factory.WriteInjectedAsync(context, 503);

        Assert.Equal("3", context.Response.Headers.RetryAfter.ToString());
        Assert.Equal(RuntimeErrorFactory.JsonContentType, context.Response.ContentType);
        Assert.Equal("no-store", context.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public async Task Every_429_gets_retry_after()
    {
        var factory = new RuntimeErrorFactory();
        var context = CreateContext();

        await factory.WriteSystemAsync(
            context,
            429,
            ErrorCodes.DailyQuotaExceeded,
            retryAfterSeconds: 120
        );

        Assert.Equal("120", context.Response.Headers.RetryAfter.ToString());

        using var document = JsonDocument.Parse(ReadBody(context));
        var error = document.RootElement.GetProperty("error");
        Assert.Equal(ErrorCodes.DailyQuotaExceeded, error.GetProperty("code").GetString());
        Assert.False(error.GetProperty("injected").GetBoolean());
    }

    [Fact]
    public void System_error_uses_catalog_title()
    {
        var factory = new RuntimeErrorFactory();

        var response = factory.CreateSystem(404, ErrorCodes.ProjectNotFound, requestId: RequestId);

        Assert.Equal("Project not found.", response.Error.Title);
        Assert.False(response.Error.Injected);
        Assert.Equal(RequestId, response.Error.RequestId);
    }

    [Fact]
    public void Injected_error_uses_http_reason_phrase_for_title()
    {
        var factory = new RuntimeErrorFactory();

        var response = factory.CreateInjected(429, requestId: RequestId);

        Assert.Equal("Too Many Requests", response.Error.Title);
        Assert.Equal(ErrorCodes.InjectedError, response.Error.Code);
        Assert.True(response.Error.Injected);
    }

    private static DefaultHttpContext CreateContext()
    {
        var context = new DefaultHttpContext { TraceIdentifier = RequestId };
        context.Items[RequestContext.RequestIdItemKey] = RequestId;
        context.Response.Body = new MemoryStream();
        return context;
    }

    private static string ReadBody(HttpContext context)
    {
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(
            context.Response.Body,
            Encoding.UTF8,
            detectEncodingFromByteOrderMarks: false,
            bufferSize: 1024,
            leaveOpen: true
        );
        return reader.ReadToEnd();
    }
}

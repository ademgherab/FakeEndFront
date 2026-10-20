using MockApi.Core.Errors;

namespace MockApi.UnitTests.Errors;

public sealed class ErrorCodesTests
{
    public static TheoryData<string, int> RequiredCodes =>
        new()
        {
            { ErrorCodes.ValidationFailed, 400 },
            { ErrorCodes.SampleInvalid, 422 },
            { ErrorCodes.SampleTooComplex, 422 },
            { ErrorCodes.ResponseTooLarge, 422 },
            { ErrorCodes.EndpointLimitReached, 422 },
            { ErrorCodes.DuplicateEndpoint, 409 },
            { ErrorCodes.EndpointNotFound, 404 },
            { ErrorCodes.ProjectNotFound, 404 },
            { ErrorCodes.ProjectExpired, 410 },
            { ErrorCodes.MissingToken, 401 },
            { ErrorCodes.InvalidToken, 403 },
            { ErrorCodes.RateLimited, 429 },
            { ErrorCodes.DailyQuotaExceeded, 429 },
            { ErrorCodes.InvalidPagination, 400 },
            { ErrorCodes.MethodNotAllowed, 405 },
            { ErrorCodes.PayloadTooLarge, 413 },
            { ErrorCodes.UnsupportedMediaType, 415 },
            { ErrorCodes.GenerationFailed, 500 },
            { ErrorCodes.InjectedError, 503 },
            { ErrorCodes.InternalError, 500 },
        };

    [Theory]
    [MemberData(nameof(RequiredCodes))]
    public void Required_codes_exist_with_expected_default_status(string code, int status)
    {
        Assert.True(ErrorCodes.TryGet(code, out var definition));
        Assert.Equal(code, definition.Code);
        Assert.Equal(status, definition.Status);
        Assert.False(string.IsNullOrWhiteSpace(definition.Title));
        Assert.False(string.IsNullOrWhiteSpace(definition.When));
    }

    [Fact]
    public void Catalog_has_unique_codes()
    {
        Assert.Equal(
            ErrorCodes.All.Count,
            ErrorCodes.All.Select(item => item.Code).Distinct().Count()
        );
    }

    [Fact]
    public void Framework_not_found_code_is_documented_separately()
    {
        Assert.True(ErrorCodes.TryGet(ErrorCodes.NotFound, out var definition));
        Assert.Equal(404, definition.Status);
        Assert.Contains("framework", definition.When, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Unknown_code_throws()
    {
        Assert.Throws<KeyNotFoundException>(() => ErrorCodes.Get("does_not_exist"));
    }
}

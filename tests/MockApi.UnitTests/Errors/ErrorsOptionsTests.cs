using System.ComponentModel.DataAnnotations;
using MockApi.Core.Configuration;

namespace MockApi.UnitTests.Errors;

public sealed class ErrorsOptionsTests
{
    [Fact]
    public void Build_type_url_uses_base_without_trailing_slash()
    {
        var options = new ErrorsOptions { BaseUrl = "https://errors.test/base/" };

        Assert.Equal(
            "https://errors.test/base/errors/validation_failed",
            options.BuildTypeUrl("validation_failed")
        );
    }

    [Theory]
    [InlineData("https://example.com")]
    [InlineData("http://localhost:5031")]
    [InlineData("https://example.com/some/path/")]
    public void Valid_base_urls_pass_validation(string baseUrl)
    {
        Assert.Empty(Validate(new ErrorsOptions { BaseUrl = baseUrl }));
    }

    [Theory]
    [InlineData("example.com")]
    [InlineData("/errors")]
    [InlineData("ftp://example.com")]
    [InlineData("https://example.com?query=1")]
    [InlineData("https://example.com#fragment")]
    public void Invalid_base_urls_fail_validation(string baseUrl)
    {
        Assert.NotEmpty(Validate(new ErrorsOptions { BaseUrl = baseUrl }));
    }

    private static List<ValidationResult> Validate(ErrorsOptions options)
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

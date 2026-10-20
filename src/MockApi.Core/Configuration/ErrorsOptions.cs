using System.ComponentModel.DataAnnotations;

namespace MockApi.Core.Configuration;

/// <summary>
/// Configuration for the error contract, bound from <c>MockApi:Errors</c>.
/// </summary>
public sealed class ErrorsOptions : IValidatableObject
{
    public const string SectionName = "MockApi:Errors";

    public const string DefaultBaseUrl = "https://example.com";

    [Required]
    public string BaseUrl { get; init; } = DefaultBaseUrl;

    /// <summary>
    /// Builds the RFC 9457 <c>type</c> URL for an error code, e.g.
    /// <c>https://example.com/errors/validation_failed</c>.
    /// </summary>
    public string BuildTypeUrl(string code)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);

        return $"{BaseUrl.TrimEnd('/')}/errors/{code}";
    }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (
            !Uri.TryCreate(BaseUrl, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
        )
        {
            yield return new ValidationResult(
                $"{nameof(BaseUrl)} must be an absolute http or https URL.",
                [nameof(BaseUrl)]
            );
            yield break;
        }

        if (!string.IsNullOrEmpty(uri.Query))
        {
            yield return new ValidationResult(
                $"{nameof(BaseUrl)} must not contain a query string.",
                [nameof(BaseUrl)]
            );
        }

        if (!string.IsNullOrEmpty(uri.Fragment))
        {
            yield return new ValidationResult(
                $"{nameof(BaseUrl)} must not contain a fragment.",
                [nameof(BaseUrl)]
            );
        }
    }
}

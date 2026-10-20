using System.ComponentModel.DataAnnotations;

namespace MockApi.Core.Configuration;

/// <summary>Public mock runtime settings from spec §9.</summary>
public sealed class RuntimeOptions : IValidatableObject
{
    /// <summary>
    /// Public base URL of the mock surface, without a trailing slash (for example
    /// <c>https://api.example.com/m</c>).
    /// </summary>
    [Required(AllowEmptyStrings = false)]
    public string MockBaseUrl { get; init; } = string.Empty;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (
            !Uri.TryCreate(MockBaseUrl, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            || !string.IsNullOrEmpty(uri.Query)
            || !string.IsNullOrEmpty(uri.Fragment)
        )
        {
            yield return new ValidationResult(
                $"{nameof(MockBaseUrl)} must be an absolute http(s) URL without a query string or fragment.",
                [nameof(MockBaseUrl)]
            );
        }
    }
}

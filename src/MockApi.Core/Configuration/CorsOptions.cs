using System.ComponentModel.DataAnnotations;

namespace MockApi.Core.Configuration;

/// <summary>Management API CORS origins from spec §10.6.</summary>
public sealed class CorsOptions : IValidatableObject
{
    public string[] ManagementOrigins { get; init; } = [];

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (ManagementOrigins is null || ManagementOrigins.Length == 0)
        {
            yield return new ValidationResult(
                "At least one management origin is required.",
                [nameof(ManagementOrigins)]
            );
            yield break;
        }

        foreach (var origin in ManagementOrigins)
        {
            if (!TryParseOrigin(origin, out _))
            {
                yield return new ValidationResult(
                    $"'{origin}' is not a valid absolute http(s) origin.",
                    [nameof(ManagementOrigins)]
                );
            }
        }
    }

    private static bool TryParseOrigin(string? origin, out Uri? uri)
    {
        uri = null;

        if (
            string.IsNullOrWhiteSpace(origin)
            || !Uri.TryCreate(origin, UriKind.Absolute, out var parsed)
            || (parsed.Scheme != Uri.UriSchemeHttp && parsed.Scheme != Uri.UriSchemeHttps)
            || parsed.AbsolutePath != "/"
            || !string.IsNullOrEmpty(parsed.Query)
            || !string.IsNullOrEmpty(parsed.Fragment)
        )
        {
            return false;
        }

        uri = parsed;
        return true;
    }
}

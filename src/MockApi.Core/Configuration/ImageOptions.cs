using System.ComponentModel.DataAnnotations;

namespace MockApi.Core.Configuration;

/// <summary>External placeholder image hosts from spec §7.4.</summary>
public sealed class ImageOptions : IValidatableObject
{
    public const string SeedPlaceholder = "{seed}";

    [Required(AllowEmptyStrings = false)]
    public string ImageUrlTemplate { get; init; } = string.Empty;

    [Required(AllowEmptyStrings = false)]
    public string AvatarUrlTemplate { get; init; } = string.Empty;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (
            var (name, value) in new[]
            {
                (nameof(ImageUrlTemplate), ImageUrlTemplate),
                (nameof(AvatarUrlTemplate), AvatarUrlTemplate),
            }
        )
        {
            if (!value.Contains(SeedPlaceholder, StringComparison.Ordinal))
            {
                yield return new ValidationResult(
                    $"{name} must contain the '{SeedPlaceholder}' placeholder.",
                    [name]
                );
                continue;
            }

            if (
                !value.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
                && !value.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            )
            {
                yield return new ValidationResult(
                    $"{name} must be an absolute http(s) URL template.",
                    [name]
                );
            }
        }
    }
}

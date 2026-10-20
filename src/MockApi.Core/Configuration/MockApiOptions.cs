using System.ComponentModel.DataAnnotations;

namespace MockApi.Core.Configuration;

/// <summary>
/// Root configuration for the MockAPI backend, bound from the <c>MockApi</c> section.
/// Every numeric limit from the technical specification lives here; nothing is hard-coded
/// in the application code.
/// </summary>
public sealed class MockApiOptions : IValidatableObject
{
    public const string SectionName = "MockApi";

    [Required]
    public LimitsOptions Limits { get; init; } = new();

    [Required]
    public ProjectsOptions Projects { get; init; } = new();

    [Required]
    public RateLimitsOptions RateLimits { get; init; } = new();

    [Required]
    public CorsOptions Cors { get; init; } = new();

    [Required]
    public RuntimeOptions Runtime { get; init; } = new();

    [Required]
    public ImageOptions Images { get; init; } = new();

    [Required]
    public WorkersOptions Workers { get; init; } = new();

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in ValidateSection(nameof(Limits), Limits))
        {
            yield return result;
        }

        foreach (var result in ValidateSection(nameof(Projects), Projects))
        {
            yield return result;
        }

        foreach (var result in ValidateSection(nameof(RateLimits), RateLimits))
        {
            yield return result;
        }

        foreach (var result in ValidateSection(nameof(Cors), Cors))
        {
            yield return result;
        }

        foreach (var result in ValidateSection(nameof(Runtime), Runtime))
        {
            yield return result;
        }

        foreach (var result in ValidateSection(nameof(Images), Images))
        {
            yield return result;
        }

        foreach (var result in ValidateSection(nameof(Workers), Workers))
        {
            yield return result;
        }
    }

    private static IEnumerable<ValidationResult> ValidateSection(string prefix, object? section)
    {
        if (section is null)
        {
            yield return new ValidationResult($"{prefix} configuration is required.", [prefix]);
            yield break;
        }

        var results = new List<ValidationResult>();
        var context = new ValidationContext(section);

        if (Validator.TryValidateObject(section, context, results, validateAllProperties: true))
        {
            yield break;
        }

        foreach (var result in results)
        {
            var members = result.MemberNames.ToArray();
            var memberNames =
                members.Length == 0
                    ? [prefix]
                    : members.Select(member => $"{prefix}.{member}").ToArray();

            yield return new ValidationResult(result.ErrorMessage, memberNames);
        }
    }
}

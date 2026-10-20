using System.ComponentModel.DataAnnotations;

namespace MockApi.Core.Configuration;

/// <summary>
/// Limits from spec §11.1. All values are configuration driven and surface through
/// <c>GET /api/v1/meta</c>.
/// </summary>
public sealed class LimitsOptions : IValidatableObject
{
    [Range(1, 1000)]
    public int MaxEndpointsPerProject { get; init; }

    [Range(1, int.MaxValue)]
    public int MaxSampleBytes { get; init; }

    [Range(1, int.MaxValue)]
    public int MaxRequestBodyBytes { get; init; }

    [Range(1, int.MaxValue)]
    public int MaxMockRequestBodyBytes { get; init; }

    [Range(1, int.MaxValue)]
    public int MaxPathLength { get; init; }

    [Range(1, int.MaxValue)]
    public int MaxDelayMs { get; init; }

    [Range(1, int.MaxValue)]
    public int MaxListSize { get; init; }

    [Range(1, int.MaxValue)]
    public int MaxPaginationTotalItems { get; init; }

    [Range(1, int.MaxValue)]
    public int MaxPaginationLimit { get; init; }

    [Range(1, 100)]
    public int MaxErrorStatusCodes { get; init; }

    [Range(1, int.MaxValue)]
    public int DailyRequestsPerProject { get; init; }

    [Range(1, int.MaxValue)]
    public int MaxLogEntriesPerProject { get; init; }

    [Range(1, int.MaxValue)]
    public int MaxGeneratedValuesPerResponse { get; init; }

    [Range(1, 10_000)]
    public int MaxSchemaNodes { get; init; }

    [Range(1, 100)]
    public int MaxSchemaDepth { get; init; }

    [Range(1, 1000)]
    public int MaxFieldNameLength { get; init; }

    [Range(1, 1000)]
    public int MaxFieldsPerObject { get; init; }

    [Range(1, 1000)]
    public int MaxEnumValues { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (MaxMockRequestBodyBytes > MaxRequestBodyBytes)
        {
            yield return new ValidationResult(
                $"{nameof(MaxMockRequestBodyBytes)} must not exceed {nameof(MaxRequestBodyBytes)}.",
                [nameof(MaxMockRequestBodyBytes)]
            );
        }

        if (MaxPaginationLimit > MaxPaginationTotalItems)
        {
            yield return new ValidationResult(
                $"{nameof(MaxPaginationLimit)} must not exceed {nameof(MaxPaginationTotalItems)}.",
                [nameof(MaxPaginationLimit)]
            );
        }

        if (MaxErrorStatusCodes > 100)
        {
            yield return new ValidationResult(
                $"{nameof(MaxErrorStatusCodes)} cannot exceed the number of error statuses (400-599).",
                [nameof(MaxErrorStatusCodes)]
            );
        }
    }
}

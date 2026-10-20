using System.ComponentModel.DataAnnotations;

namespace MockApi.Core.Configuration;

/// <summary>Background worker cadence from spec §2.1 and §11.1.</summary>
public sealed class WorkersOptions : IValidatableObject
{
    [Range(1, 1_000_000)]
    public int LogQueueCapacity { get; init; }

    [Range(1, 10_000)]
    public int LogBatchSize { get; init; }

    [Range(1, 600_000)]
    public int LogFlushIntervalMs { get; init; }

    [Range(1, 600_000)]
    public int UsageFlushIntervalMs { get; init; }

    [Range(1, 86_400)]
    public int CleanupIntervalSeconds { get; init; }

    [Range(1, 86_400)]
    public int PurgeIntervalSeconds { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (LogBatchSize > LogQueueCapacity)
        {
            yield return new ValidationResult(
                $"{nameof(LogBatchSize)} must not exceed {nameof(LogQueueCapacity)}.",
                [nameof(LogBatchSize)]
            );
        }
    }
}

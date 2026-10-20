using System.ComponentModel.DataAnnotations;

namespace MockApi.Core.Configuration;

/// <summary>Rate-limit defaults from spec §11.2.</summary>
public sealed class RateLimitsOptions
{
    [Range(1, int.MaxValue)]
    public int CreateProjectPerHour { get; init; }

    [Range(1, int.MaxValue)]
    public int InferPreviewPerMinute { get; init; }

    [Range(1, int.MaxValue)]
    public int ManagementWritePerMinute { get; init; }

    [Range(1, int.MaxValue)]
    public int ManagementReadPerMinute { get; init; }

    [Range(1, int.MaxValue)]
    public int RuntimeSlugPerMinute { get; init; }

    [Range(1, int.MaxValue)]
    public int RuntimeIpPerMinute { get; init; }
}

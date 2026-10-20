using System.ComponentModel.DataAnnotations;

namespace MockApi.Core.Configuration;

/// <summary>Project lifetime and slug rules from spec §0.2 (Q7) and §3.</summary>
public sealed class ProjectsOptions
{
    [Range(1, 3650)]
    public int LifetimeDays { get; init; }

    [Range(0, 365)]
    public int ExpiryGraceDays { get; init; }

    [Range(4, 64)]
    public int SlugLength { get; init; }
}

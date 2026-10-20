using System.ComponentModel.DataAnnotations;

namespace MockApi.Data.Configuration;

/// <summary>
/// PostgreSQL connection string, bound from the standard <c>ConnectionStrings</c> section.
/// Production values are supplied by the environment; the repository never stores real
/// credentials.
/// </summary>
public sealed class DatabaseOptions
{
    public const string SectionName = "ConnectionStrings";

    [Required(AllowEmptyStrings = false)]
    public string Default { get; init; } = string.Empty;
}

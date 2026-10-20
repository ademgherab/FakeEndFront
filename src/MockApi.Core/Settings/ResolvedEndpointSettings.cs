using System.Text.Json.Serialization;
using MockApi.Core.Generation;
using MockApi.Core.Schemas;

namespace MockApi.Core.Settings;

/// <summary>
/// The full settings object returned to clients (technical spec §8.1) with every default applied.
/// The generation plan is intentionally not serialized: it is runtime information only.
/// </summary>
public sealed class ResolvedEndpointSettings
{
    public int SuccessStatus { get; init; }

    [JsonIgnore]
    public bool HasBody => SuccessStatus != 204;

    public ResolvedDelaySettings Delay { get; init; } = new();

    public ResolvedErrorSettings Errors { get; init; } = new();

    public ResolvedListSettings List { get; init; } = new();

    public ResolvedPaginationSettings Pagination { get; init; } = new();

    public int? Seed { get; init; }

    [JsonIgnore]
    public EndpointSettingsPlan Plan { get; init; } = new();
}

public sealed class ResolvedDelaySettings
{
    public int MinMs { get; init; }

    public int MaxMs { get; init; }
}

public sealed class ResolvedErrorSettings
{
    public double RatePercent { get; init; }

    public IReadOnlyList<int> StatusCodes { get; init; } = [];
}

public sealed class ResolvedListSettings
{
    public string? Path { get; init; }

    public ResolvedListSizeSettings Size { get; init; } = new();
}

public sealed class ResolvedListSizeSettings
{
    public int Min { get; init; }

    public int Max { get; init; }
}

public sealed class ResolvedPaginationSettings
{
    public bool Enabled { get; init; }

    public int TotalItems { get; init; }

    public int DefaultLimit { get; init; }

    public int MaxLimit { get; init; }

    public ResolvedPaginationBindings Bindings { get; init; } = new();
}

public sealed class ResolvedPaginationBindings
{
    public string? Page { get; init; }

    public string? Limit { get; init; }

    public string? Total { get; init; }

    public string? TotalPages { get; init; }

    public string? HasNext { get; init; }

    public string? HasPrev { get; init; }
}

/// <summary>
/// Information the preview and runtime need to generate the list consistently. The node reference
/// identifies the array whose length comes from settings/pagination instead of the schema's
/// <c>length</c> (technical spec §5.3).
/// </summary>
public sealed class EndpointSettingsPlan
{
    public ArrayNode? ListNode { get; init; }

    public bool PaginationEnabled { get; init; }

    public int ListMin { get; init; }

    public int ListMax { get; init; }

    public long WorstCaseValueCount { get; init; }

    public bool HasList => ListNode is not null;

    /// <summary>
    /// Builds the generator options for one concrete page. <paramref name="count"/> is the number
    /// of items on the page and <paramref name="offset"/> is its zero-based list offset.
    /// </summary>
    public GenerationOptions CreateGenerationOptions(
        int count,
        int offset,
        int maxValues,
        DateTimeOffset? referenceTime = null
    ) =>
        new()
        {
            ListMin = Math.Max(0, count),
            ListMax = Math.Max(0, count),
            ListIndexOffset = Math.Max(0, offset),
            MaxValues = maxValues,
            ReferenceTime = referenceTime,
        };
}

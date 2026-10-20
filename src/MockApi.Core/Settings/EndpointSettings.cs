namespace MockApi.Core.Settings;

/// <summary>
/// The input shape of an endpoint's settings (technical spec §8.1). Every property is optional;
/// <see cref="EndpointSettingsService"/> applies the method-specific defaults and returns a fully
/// populated <see cref="ResolvedEndpointSettings"/>.
/// </summary>
public sealed class EndpointSettings
{
    public int? SuccessStatus { get; init; }

    public DelaySettings? Delay { get; init; }

    public ErrorSettings? Errors { get; init; }

    public ListSettings? List { get; init; }

    public PaginationSettings? Pagination { get; init; }

    public int? Seed { get; init; }
}

public sealed class DelaySettings
{
    public int? MinMs { get; init; }

    public int? MaxMs { get; init; }
}

public sealed class ErrorSettings
{
    public double? RatePercent { get; init; }

    public IReadOnlyList<int>? StatusCodes { get; init; }
}

public sealed class ListSettings
{
    public string? Path { get; init; }

    public ListSizeSettings? Size { get; init; }
}

public sealed class ListSizeSettings
{
    public int? Min { get; init; }

    public int? Max { get; init; }
}

public sealed class PaginationSettings
{
    public bool? Enabled { get; init; }

    public int? TotalItems { get; init; }

    public int? DefaultLimit { get; init; }

    public int? MaxLimit { get; init; }

    public PaginationBindings? Bindings { get; init; }
}

public sealed class PaginationBindings
{
    public string? Page { get; init; }

    public string? Limit { get; init; }

    public string? Total { get; init; }

    public string? TotalPages { get; init; }

    public string? HasNext { get; init; }

    public string? HasPrev { get; init; }
}
